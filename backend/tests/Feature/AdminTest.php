<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Invite;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create();
        $this->admin->forceFill(['is_admin' => true])->save();
    }

    public function test_none_of_it_is_open_to_ordinary_users(): void
    {
        $this->actingAs(User::factory()->create());
        foreach (['invites', 'users', 'campaigns'] as $what) {
            $this->getJson("/api/admin/{$what}")->assertForbidden();
        }
        $this->patchJson("/api/admin/users/{$this->admin->id}", ['disabled' => true])->assertForbidden();
        $this->deleteJson("/api/admin/users/{$this->admin->id}")->assertForbidden();
        $this->postJson("/api/admin/users/{$this->admin->id}/reset-link")->assertForbidden();
    }

    public function test_site_invites_are_listed_and_can_be_revoked(): void
    {
        $this->actingAs($this->admin);
        $made = $this->postJson('/api/admin/invites', ['max_uses' => 3, 'days' => 5])->assertCreated()->json();
        $campaign = Campaign::create(['name' => 'T']);
        Invite::create(['campaign_id' => $campaign->id, 'created_by' => $this->admin->id]); // a campaign invite is not a site invite

        $list = $this->getJson('/api/admin/invites')->assertOk()->json();
        $this->assertSame([$made['code']], array_column($list, 'code'));
        $this->assertSame(3, $list[0]['max_uses']);

        $this->deleteJson("/api/admin/invites/{$made['id']}")->assertOk();
        $this->getJson('/api/admin/invites')->assertExactJson([]);
        $this->postJson('/api/register', ['name' => 'X', 'email' => 'x@x.se', 'password' => 'longenough', 'invite' => $made['code']])->assertStatus(422);
    }

    public function test_users_are_listed_and_a_disabled_one_is_locked_out_everywhere(): void
    {
        $user = User::factory()->create(['email' => 'a@x.se', 'password' => 'longenough']);
        $this->actingAs($this->admin)->getJson('/api/admin/users')->assertOk()->assertJsonCount(2)->assertJsonPath('1.disabled', false);

        $this->patchJson("/api/admin/users/{$user->id}", ['disabled' => true])->assertOk();
        $this->getJson('/api/admin/users')->assertJsonPath('1.disabled', true);

        // already signed in: the next request is refused and ends the session
        $this->app['auth']->forgetGuards();
        $this->actingAs($user->fresh())->getJson('/api/me')->assertUnauthorized();
        // and signing in again fails like a wrong password
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'longenough'])->assertStatus(422);

        $this->actingAs($this->admin)->patchJson("/api/admin/users/{$user->id}", ['disabled' => false])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => 'a@x.se', 'password' => 'longenough'])->assertOk();
    }

    public function test_administrator_rights_can_be_given_and_taken_but_not_from_yourself(): void
    {
        $user = User::factory()->create();
        $this->actingAs($this->admin)->patchJson("/api/admin/users/{$user->id}", ['is_admin' => true])->assertOk();
        $this->assertTrue($user->fresh()->is_admin);
        $this->patchJson("/api/admin/users/{$user->id}", ['is_admin' => false])->assertOk();

        $this->patchJson("/api/admin/users/{$this->admin->id}", ['is_admin' => false])->assertStatus(422);
        $this->patchJson("/api/admin/users/{$this->admin->id}", ['disabled' => true])->assertStatus(422);
        $this->assertTrue($this->admin->fresh()->is_admin);
    }

    public function test_an_administrator_allows_and_stops_accounts_from_being_a_dm(): void
    {
        $user = User::factory()->create();
        $this->actingAs($this->admin)->getJson('/api/me')->assertJsonPath('can_dm', true); // administrators can always start campaigns

        $this->patchJson("/api/admin/users/{$user->id}", ['can_dm' => true])->assertOk();
        $this->getJson('/api/admin/users')->assertJsonPath('1.can_dm', true);
        $this->app['auth']->forgetGuards();
        $this->actingAs($user->fresh())->postJson('/api/campaigns', ['name' => 'Mine'])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->patchJson("/api/admin/users/{$user->id}", ['can_dm' => false])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->actingAs($user->fresh())->postJson('/api/campaigns', ['name' => 'Another'])->assertForbidden();
    }

    public function test_every_change_is_written_to_the_log_with_who_did_it_and_to_what(): void
    {
        Notification::fake();
        $user = User::factory()->create(['name' => 'Ann', 'email' => 'ann@x.se']);
        $campaign = Campaign::create(['name' => 'Doomed']);
        $this->actingAs($this->admin);
        $invite = $this->postJson('/api/admin/invites', ['max_uses' => 2])->json();
        $this->patchJson("/api/admin/users/{$user->id}", ['disabled' => true]);
        $this->patchJson("/api/admin/users/{$user->id}", ['disabled' => false, 'is_admin' => true]);
        $this->patchJson("/api/admin/users/{$user->id}", ['is_admin' => false]);
        $this->postJson("/api/admin/users/{$user->id}/reset-link");
        $this->deleteJson("/api/admin/invites/{$invite['id']}");
        $this->deleteJson("/api/admin/campaigns/{$campaign->id}");
        $this->deleteJson("/api/admin/users/{$user->id}");
        $this->patchJson("/api/admin/users/{$this->admin->id}", ['disabled' => true])->assertStatus(422); // refused: not logged

        $entries = $this->getJson('/api/admin/log')->assertOk()->assertJsonPath('more', false)->json('entries');
        $this->assertSame(
            ['user.delete', 'campaign.delete', 'invite.revoke', 'user.reset_link', 'user.admin_revoke', 'user.admin_grant', 'user.unlock', 'user.lock', 'invite.create'],
            array_column($entries, 'action'), // newest first
        );
        $this->assertSame('Ann <ann@x.se>', $entries[0]['subject']);
        $this->assertSame('Doomed', $entries[1]['subject']);
        $this->assertSame($this->admin->name, $entries[0]['admin']);

        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create())->getJson('/api/admin/log')->assertForbidden();
    }

    public function test_the_log_is_paged_and_keeps_the_admin_name_after_the_account_is_gone(): void
    {
        $this->actingAs($this->admin);
        foreach (range(1, 55) as $i) {
            $this->postJson('/api/admin/invites');
        }
        $first = $this->getJson('/api/admin/log')->assertJsonPath('more', true)->json();
        $this->assertCount(50, $first['entries']);
        $last = end($first['entries'])['id'];
        $second = $this->getJson("/api/admin/log?before={$last}")->assertJsonPath('more', false)->json('entries');
        $this->assertCount(5, $second);

        $this->admin->delete();
        $this->assertSame($this->admin->name, \App\Models\AdminLog::first()->admin_name);
    }

    public function test_the_admin_can_send_a_user_a_reset_link(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $this->actingAs($this->admin)->postJson("/api/admin/users/{$user->id}/reset-link")->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_deleting_a_user_keeps_campaigns_alive_and_refuses_to_orphan_one(): void
    {
        $dm = User::factory()->create(['name' => 'Dana']);
        $co = User::factory()->create();
        $player = User::factory()->create();
        $solo = Campaign::create(['name' => 'Solo']);
        $solo->members()->attach($dm->id, ['role' => 'dm']);
        $solo->members()->attach($player->id, ['role' => 'player']);

        $this->actingAs($this->admin)->deleteJson("/api/admin/users/{$dm->id}")->assertStatus(422)->assertJsonValidationErrors('user');
        $this->deleteJson("/api/admin/users/{$this->admin->id}")->assertStatus(422); // not yourself

        $solo->members()->attach($co->id, ['role' => 'dm']); // now there is another DM
        $this->deleteJson("/api/admin/users/{$dm->id}")->assertOk();
        $this->assertNull(User::find($dm->id));
        $this->assertSame('dm', $solo->roleOf($co));
        $this->deleteJson("/api/admin/users/{$player->id}")->assertOk(); // players can always go
    }

    public function test_campaigns_are_listed_with_their_dms_and_can_be_deleted(): void
    {
        $dm = User::factory()->create(['name' => 'Dana']);
        $campaign = Campaign::create(['name' => 'Lost Mine']);
        $campaign->members()->attach($dm->id, ['role' => 'dm']);
        $campaign->members()->attach(User::factory()->create()->id, ['role' => 'player']);

        $row = $this->actingAs($this->admin)->getJson('/api/admin/campaigns')->assertOk()->json('0');
        $this->assertSame(['Lost Mine', 2, ['Dana']], [$row['name'], $row['members'], $row['dms']]);

        $this->deleteJson("/api/admin/campaigns/{$campaign->id}")->assertOk();
        $this->getJson('/api/admin/campaigns')->assertExactJson([]);
    }
}
