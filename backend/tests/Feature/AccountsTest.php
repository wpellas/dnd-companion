<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Invite;
use App\Models\User;
use App\Notifications\ConfirmEmailChange;
use App\Notifications\EmailChanged;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AccountsTest extends TestCase
{
    use RefreshDatabase;

    private function siteInvite(int $uses = 1): Invite
    {
        return Invite::create(['created_by' => User::factory()->create()->id, 'max_uses' => $uses]);
    }

    private function signup(string $code, string $email = 'a@x.se')
    {
        return $this->postJson('/api/register', ['name' => 'Ann', 'email' => $email, 'password' => 'longenough', 'invite' => $code]);
    }

    public function test_registration_needs_a_valid_invite(): void
    {
        $this->signup('NOPE')->assertStatus(422)->assertJsonValidationErrors('invite');
        $this->assertDatabaseCount('users', 0);

        $this->signup($this->siteInvite()->code)->assertCreated()->assertJsonPath('is_admin', false);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('email', 'a@x.se'); // signed in straight away
    }

    public function test_an_invite_cannot_be_used_more_than_max_uses_or_after_it_expires(): void
    {
        $invite = $this->siteInvite(1);
        $this->signup($invite->code)->assertCreated();
        auth()->logout();
        $this->signup($invite->code, 'b@x.se')->assertStatus(422);

        $old = $this->siteInvite(5);
        $old->update(['expires_at' => now()->subMinute()]);
        $this->signup($old->code, 'c@x.se')->assertStatus(422);
    }

    public function test_a_campaign_invite_seats_the_new_player_and_is_case_insensitive(): void
    {
        $dm = User::factory()->create();
        $campaign = Campaign::create(['name' => 'Table']);
        $campaign->members()->attach($dm->id, ['role' => 'dm']);
        $invite = Invite::create(['campaign_id' => $campaign->id, 'created_by' => $dm->id, 'max_uses' => 5]);

        $this->signup(strtolower($invite->code))->assertCreated();
        $this->assertSame('player', $campaign->roleOf(User::where('email', 'a@x.se')->first()));
    }

    public function test_login_logout_and_wrong_password(): void
    {
        User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'wrong'])->assertStatus(422);
        $this->getJson('/api/me')->assertUnauthorized();

        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'longenough'])->assertOk();
        $this->getJson('/api/me')->assertOk();
        $this->postJson('/api/logout')->assertOk();
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_password_reset_by_mail(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'a@x.se']);
        $this->postJson('/api/forgot-password', ['email' => 'nobody@x.se'])->assertOk(); // same answer for strangers
        $this->postJson('/api/forgot-password', ['email' => 'a@x.se'])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function ($n) use ($user) {
            $url = $n->toMail($user)->actionUrl;
            $this->assertStringContainsString('/#reset?token='.$n->token, $url);
            $this->postJson('/api/reset-password', ['token' => $n->token, 'email' => 'a@x.se', 'password' => 'brandnewpass'])->assertOk();

            return true;
        });
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'brandnewpass'])->assertOk();
    }

    public function test_changing_the_password_needs_the_current_one(): void
    {
        $user = User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $this->actingAs($user)->patchJson('/api/me/password', ['current_password' => 'wrong', 'password' => 'brandnewpass'])->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->patchJson('/api/me/password', ['current_password' => 'longenough', 'password' => 'short'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->patchJson('/api/me/password', ['current_password' => 'longenough', 'password' => 'brandnewpass'])->assertOk();

        $this->postJson('/api/logout');
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'longenough'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'brandnewpass'])->assertOk();
    }

    public function test_asking_for_a_new_email_needs_the_password_and_a_free_address_and_changes_nothing_yet(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'taken@x.se']);
        $user = User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $this->actingAs($user)->patchJson('/api/me/email', ['current_password' => 'wrong', 'email' => 'new@x.se'])->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->patchJson('/api/me/email', ['current_password' => 'longenough', 'email' => 'taken@x.se'])->assertStatus(422)->assertJsonValidationErrors('email');
        Notification::assertNothingSent();

        $this->patchJson('/api/me/email', ['current_password' => 'longenough', 'email' => 'new@x.se'])->assertOk()->assertJsonPath('pending', 'new@x.se');
        $this->assertSame('a@x.se', $user->fresh()->email); // still the old one until the link is opened
        Notification::assertSentOnDemand(ConfirmEmailChange::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'new@x.se');
    }

    private function emailLink(User $user, string $new): string
    {
        $url = '';
        Notification::fake();
        $this->actingAs($user)->patchJson('/api/me/email', ['current_password' => 'longenough', 'email' => $new])->assertOk();
        Notification::assertSentOnDemand(ConfirmEmailChange::class, function ($n) use (&$url) {
            $url = $n->url;

            return true;
        });
        $this->assertStringContainsString('/#confirm-email?token=', $url);

        return substr($url, strpos($url, 'token=') + 6);
    }

    public function test_opening_the_link_changes_the_email_once_without_a_login_and_tells_the_old_address(): void
    {
        $user = User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $token = $this->emailLink($user, 'new@x.se');

        $this->app['auth']->forgetGuards(); // another browser: nobody is signed in
        Notification::fake();
        $this->postJson('/api/confirm-email', ['token' => $token])->assertOk()->assertJsonPath('email', 'new@x.se');
        $this->assertSame('new@x.se', $user->fresh()->email);
        Notification::assertSentOnDemand(EmailChanged::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'a@x.se');

        $this->postJson('/api/confirm-email', ['token' => $token])->assertStatus(422); // used up
        $this->postJson('/api/login', ['email' => 'new@x.se', 'password' => 'longenough'])->assertOk();
    }

    public function test_a_link_stops_working_when_it_expires_is_replaced_or_the_address_is_taken(): void
    {
        $user = User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $first = $this->emailLink($user, 'one@x.se');
        $second = $this->emailLink($user, 'two@x.se'); // asking again replaces the first
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/confirm-email', ['token' => $first])->assertStatus(422);
        $this->postJson('/api/confirm-email', ['token' => 'garbage'])->assertStatus(422);

        User::factory()->create(['email' => 'two@x.se']); // someone registers it before the link is opened
        $this->postJson('/api/confirm-email', ['token' => $second])->assertStatus(422);
        $this->assertSame('a@x.se', $user->fresh()->email);

        $third = $this->emailLink($user, 'three@x.se');
        $this->app['auth']->forgetGuards();
        $this->travel(61)->minutes();
        $this->postJson('/api/confirm-email', ['token' => $third])->assertStatus(422);
        $this->assertSame('a@x.se', $user->fresh()->email);
    }

    public function test_only_an_administrator_can_make_site_invites(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/admin/invites')->assertForbidden();

        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $code = $this->actingAs($admin)->postJson('/api/admin/invites')->assertCreated()->json('code');
        $this->assertNotNull(Invite::where('code', $code)->whereNull('campaign_id')->first());
    }

    public function test_the_seeder_creates_the_administrator_once(): void
    {
        config(['app.admin_email' => 'boss@x.se', 'app.admin_password' => 'supersecret1']);
        $this->seed();
        $this->seed();

        $this->assertSame(1, User::where('email', 'boss@x.se')->where('is_admin', true)->count());
        $this->postJson('/api/login', ['email' => 'boss@x.se', 'password' => 'supersecret1'])->assertOk();
    }
}
