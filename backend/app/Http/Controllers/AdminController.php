<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\Campaign;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/** What the administrator can do: site invites, accounts and campaigns. Every route here sits behind the `admin` middleware, and every change is written to the admin log. */
class AdminController extends Controller
{
    /** A site invite: lets one person (or `max_uses`) register without joining any campaign. */
    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate(['max_uses' => ['nullable', 'integer', 'min:1', 'max:50'], 'days' => ['nullable', 'integer', 'min:1', 'max:365']]);
        $invite = Invite::create([
            'created_by' => $request->user()->id,
            'max_uses' => $data['max_uses'] ?? 1,
            'expires_at' => now()->addDays($data['days'] ?? 14),
        ]);
        $this->log($request, 'invite.create', "{$invite->code} ({$invite->max_uses}x)");

        return response()->json($this->presentInvite($invite), 201);
    }

    public function invites(): JsonResponse
    {
        return response()->json(Invite::whereNull('campaign_id')->latest('id')->get()->map(fn ($i) => $this->presentInvite($i))->values());
    }

    public function revokeInvite(Request $request, Invite $invite): JsonResponse
    {
        $invite->delete();
        $this->log($request, 'invite.revoke', $invite->code);

        return response()->json(['ok' => true]);
    }

    public function users(): JsonResponse
    {
        return response()->json(User::withCount('campaigns')->orderBy('id')->get()->map(fn ($u) => [
            'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'is_admin' => $u->is_admin,
            'disabled' => $u->disabled_at !== null, 'campaigns' => $u->campaigns_count, 'created_at' => $u->created_at,
        ])->values());
    }

    /** Lock or unlock an account, or hand over / take away administrator rights. Not for yourself: that is how people lock everyone out. */
    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['disabled' => ['sometimes', 'boolean'], 'is_admin' => ['sometimes', 'boolean']]);
        if ($user->is($request->user()) && (($data['disabled'] ?? false) || (array_key_exists('is_admin', $data) && ! $data['is_admin']))) {
            throw ValidationException::withMessages(['user' => 'You cannot lock yourself out or take away your own administrator rights.']);
        }
        if (array_key_exists('disabled', $data)) {
            $user->disabled_at = $data['disabled'] ? now() : null;
            $this->log($request, $data['disabled'] ? 'user.lock' : 'user.unlock', $this->who($user));
        }
        if (array_key_exists('is_admin', $data)) {
            $user->is_admin = $data['is_admin'];
            $this->log($request, $data['is_admin'] ? 'user.admin_grant' : 'user.admin_revoke', $this->who($user));
        }
        $user->save();

        return response()->json(['ok' => true]);
    }

    /** Sends the user the same reset e-mail "Forgot your password?" does. */
    public function resetLink(Request $request, User $user): JsonResponse
    {
        Password::sendResetLink(['email' => $user->email]);
        $this->log($request, 'user.reset_link', $this->who($user));

        return response()->json(['ok' => true]);
    }

    /** Deletes the account; its characters stay in the campaigns (as the DM's to handle). A campaign must not be left without a DM. */
    public function deleteUser(Request $request, User $user): JsonResponse
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'You cannot delete your own account here.']);
        }
        foreach ($user->campaigns()->wherePivot('role', 'dm')->get() as $campaign) {
            if ($campaign->members()->wherePivot('role', 'dm')->count() === 1) {
                throw ValidationException::withMessages(['user' => "{$user->name} is the only DM of \"{$campaign->name}\": delete that campaign first."]);
            }
        }
        $this->log($request, 'user.delete', $this->who($user));
        $user->delete();

        return response()->json(['ok' => true]);
    }

    public function campaigns(): JsonResponse
    {
        return response()->json(Campaign::with('members')->orderBy('id')->get()->map(fn ($c) => [
            'id' => $c->id, 'name' => $c->name, 'members' => $c->members->count(),
            'dms' => $c->members->where('pivot.role', 'dm')->pluck('name')->values(), 'created_at' => $c->created_at,
        ])->values());
    }

    public function deleteCampaign(Request $request, Campaign $campaign): JsonResponse
    {
        $this->log($request, 'campaign.delete', $campaign->name);
        $campaign->delete();

        return response()->json(['ok' => true]);
    }

    /** Newest first, 50 at a time: pass the id of the last line you have as `before` for the next page. */
    public function auditLog(Request $request): JsonResponse
    {
        $before = (int) $request->query('before', 0);
        $rows = AdminLog::when($before > 0, fn ($q) => $q->where('id', '<', $before))->orderByDesc('id')->limit(51)->get();

        return response()->json([
            'more' => $rows->count() > 50,
            'entries' => $rows->take(50)->map(fn ($r) => ['id' => $r->id, 'admin' => $r->admin_name, 'action' => $r->action, 'subject' => $r->subject, 'at' => $r->created_at])->values(),
        ]);
    }

    private function log(Request $request, string $action, string $subject): void
    {
        $admin = $request->user();
        AdminLog::create(['admin_id' => $admin->id, 'admin_name' => $admin->name, 'action' => $action, 'subject' => mb_substr($subject, 0, 255)]);
    }

    private function who(User $user): string
    {
        return "{$user->name} <{$user->email}>";
    }

    private function presentInvite(Invite $invite): array
    {
        return ['id' => $invite->id, 'code' => $invite->code, 'max_uses' => $invite->max_uses, 'used_count' => $invite->used_count, 'expires_at' => $invite->expires_at];
    }
}
