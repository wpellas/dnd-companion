<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignsTest extends TestCase
{
    use RefreshDatabase;

    /** A DM with a campaign, plus a player who joined it with an invite code. */
    private function table(): array
    {
        $dm = User::factory()->create();
        $player = User::factory()->create();
        $id = $this->actingAs($dm)->postJson('/api/campaigns', ['name' => 'Lost Mine'])->assertCreated()->assertJsonPath('role', 'dm')->json('id');
        $code = $this->postJson("/api/campaigns/{$id}/invites")->assertCreated()->json('code');
        $this->actingAs($player)->postJson('/api/campaigns/join', ['code' => $code])->assertOk()->assertJsonPath('role', 'player');

        return [$dm, $player, $id, $code];
    }

    public function test_any_account_can_be_dm_of_its_own_campaign_and_a_player_in_another(): void
    {
        [$dm, $player, $id] = $this->table();
        $this->actingAs($player)->postJson('/api/campaigns', ['name' => 'Second'])->assertJsonPath('role', 'dm');

        $roles = $this->actingAs($player)->getJson('/api/campaigns')->assertOk()->json();
        $this->assertEqualsCanonicalizing(['dm', 'player'], array_column($roles, 'role'));
        $this->actingAs($dm)->getJson("/api/campaigns/{$id}")->assertJsonCount(2, 'members');
    }

    public function test_strangers_cannot_see_a_campaign_and_players_cannot_manage_it(): void
    {
        [, $player, $id] = $this->table();
        $this->actingAs(User::factory()->create())->getJson("/api/campaigns/{$id}")->assertNotFound();
        $this->actingAs($player)->getJson("/api/campaigns/{$id}")->assertOk();
        $this->patchJson("/api/campaigns/{$id}", ['name' => 'x'])->assertForbidden();
        $this->postJson("/api/campaigns/{$id}/invites")->assertForbidden();
        $this->deleteJson("/api/campaigns/{$id}")->assertForbidden();
    }

    public function test_joining_twice_does_not_use_up_the_invite(): void
    {
        [, $player, $id, $code] = $this->table();
        $this->actingAs($player)->postJson('/api/campaigns/join', ['code' => $code])->assertOk();
        $this->assertDatabaseHas('invites', ['code' => $code, 'used_count' => 1]);
        $this->actingAs($player)->postJson('/api/campaigns/join', ['code' => 'WRONG'])->assertStatus(422);
    }

    public function test_the_dm_can_remove_a_player_and_a_player_can_leave_but_the_last_dm_cannot(): void
    {
        [$dm, $player, $id] = $this->table();
        $other = User::factory()->create();
        $this->actingAs($player)->deleteJson("/api/campaigns/{$id}/members/{$dm->id}")->assertForbidden();
        $this->deleteJson("/api/campaigns/{$id}/members/{$player->id}")->assertOk(); // leaving
        $this->actingAs($dm)->deleteJson("/api/campaigns/{$id}/members/{$dm->id}")->assertStatus(422);
        $this->deleteJson("/api/campaigns/{$id}/members/{$other->id}")->assertNotFound();
    }

    public function test_the_dm_can_rename_and_delete(): void
    {
        [$dm, $player, $id] = $this->table();
        $this->actingAs($dm)->patchJson("/api/campaigns/{$id}", ['name' => 'Renamed'])->assertJsonPath('name', 'Renamed');
        $this->deleteJson("/api/campaigns/{$id}")->assertOk();
        $this->actingAs($player)->getJson('/api/campaigns')->assertExactJson([]);
    }

    public function test_guests_are_turned_away(): void
    {
        $this->getJson('/api/campaigns')->assertUnauthorized();
    }
}
