<?php

namespace App\Http\Controllers;

use App\Models\EmailChange;
use App\Models\Invite;
use App\Models\User;
use App\Notifications\ConfirmEmailChange;
use App\Notifications\EmailChanged;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const CONFIRM_MINUTES = 60;

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', PasswordRule::min(8)],
            'invite' => ['required', 'string'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $invite = Invite::usable()->where('code', strtoupper(trim($data['invite'])))->first();
            if (! $invite || ! $invite->consume()) {
                throw ValidationException::withMessages(['invite' => 'That invite code is not valid.']);
            }
            $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']]);
            // a campaign invite also seats the new player at that table
            if ($invite->campaign_id) {
                $user->campaigns()->attach($invite->campaign_id, ['role' => 'player']);
            }

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json($this->present($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required']]);
        // a disabled account fails like a wrong password, so the form does not say which accounts exist
        if (! Auth::attempt($credentials + ['disabled_at' => null], true)) {
            throw ValidationException::withMessages(['email' => 'Wrong e-mail or password.']);
        }
        $request->session()->regenerate();

        return response()->json($this->present($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->present($request->user()));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate(['current_password' => ['required'], 'password' => ['required', PasswordRule::min(8)]]);
        $user = $request->user();
        $this->requirePassword($user, $data['current_password']);
        // a new remember token also ends "stay signed in" cookies on other devices
        $user->forceFill(['password' => Hash::make($data['password']), 'remember_token' => Str::random(60)])->save();

        return response()->json(['ok' => true]);
    }

    public function changeEmail(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        $this->requirePassword($user, $data['current_password']);

        // nothing changes yet: the link goes to the NEW address, and only opening it proves the address is theirs
        $secret = Str::random(40);
        EmailChange::updateOrCreate(
            ['user_id' => $user->id],
            ['new_email' => $data['email'], 'token' => hash('sha256', $secret), 'expires_at' => now()->addMinutes(self::CONFIRM_MINUTES)],
        );
        Notification::route('mail', $data['email'])->notify(new ConfirmEmailChange(config('app.url').'/#confirm-email?token='.$secret, self::CONFIRM_MINUTES));

        return response()->json(['pending' => $data['email']]);
    }

    /** Opened from the link in the mail, possibly in another browser than the one that asked, so the secret is the only credential. */
    public function confirmEmail(Request $request): JsonResponse
    {
        $token = $request->validate(['token' => ['required', 'string']])['token'];
        $change = EmailChange::where('token', hash('sha256', $token))->where('expires_at', '>', now())->first();
        if (! $change) {
            throw ValidationException::withMessages(['token' => 'This link is not valid any more. Ask for a new one in Settings.']);
        }
        if (User::where('email', $change->new_email)->where('id', '!=', $change->user_id)->exists()) {
            throw ValidationException::withMessages(['token' => 'Someone else has taken that address in the meantime.']);
        }

        $user = User::findOrFail($change->user_id);
        $old = $user->email;
        $user->forceFill(['email' => $change->new_email])->save();
        $change->delete();
        Notification::route('mail', $old)->notify(new EmailChanged($user->email));

        return response()->json(['ok' => true, 'email' => $user->email]);
    }

    /** Changing how you sign in needs the current password, so a borrowed open browser is not enough to take the account. */
    private function requirePassword(User $user, string $password): void
    {
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'That is not your current password.']);
        }
    }

    /** Always answers the same, so the form cannot be used to find out who has an account. */
    public function forgot(Request $request): JsonResponse
    {
        Password::sendResetLink($request->validate(['email' => ['required', 'email']]));

        return response()->json(['ok' => true]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required'], 'email' => ['required', 'email'], 'password' => ['required', PasswordRule::min(8)]]);
        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
        });
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is not valid any more.']);
        }

        return response()->json(['ok' => true]);
    }

    private function present(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_admin' => (bool) $user->is_admin];
    }
}
