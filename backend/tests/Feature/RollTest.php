<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RollTest extends TestCase
{
    use RefreshDatabase;

    private Campaign $campaign;

    private User $dm;

    private User $player;

    private User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dm = User::factory()->create();
        $this->player = User::factory()->create();
        $this->other = User::factory()->create();
        $this->campaign = Campaign::create(['name' => 'Table']);
        foreach ([[$this->dm, 'dm'], [$this->player, 'player'], [$this->other, 'player']] as [$u, $role]) {
            $this->campaign->members()->attach($u->id, ['role' => $role]);
        }
        $doc = fn (string $key, int $owner) => $this->actingAs($this->dm)->postJson("/api/campaigns/{$this->campaign->id}/sync", ['docs' => [['collection' => 'characters', 'key' => $key, 'data' => '{}', 'owner_id' => $owner]]]);
        $doc('7', $this->player->id);
        $doc('8', $this->other->id);
    }

    private function send(User $as, array $roll)
    {
        return $this->actingAs($as)->postJson("/api/campaigns/{$this->campaign->id}/rolls", $roll);
    }

    private function dmSees(): array
    {
        return $this->actingAs($this->dm)->getJson("/api/campaigns/{$this->campaign->id}/sync?since=0")->assertOk()->json('rolls');
    }

    public function test_a_player_sends_a_roll_for_their_own_character_and_only_the_dm_gets_it(): void
    {
        $this->send($this->player, ['character' => '7', 'kind' => 'attack', 'value' => 17])->assertOk();

        $rolls = $this->dmSees();
        $this->assertCount(1, $rolls);
        $this->assertSame(['character' => '7', 'kind' => 'attack', 'value' => 17], array_intersect_key($rolls[0], array_flip(['character', 'kind', 'value'])));
        $this->assertNull($this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/sync?since=0")->json('rolls'));
    }

    public function test_sending_again_replaces_it_and_each_kind_is_its_own(): void
    {
        $this->send($this->player, ['character' => '7', 'kind' => 'save', 'value' => 4]);
        $this->send($this->player, ['character' => '7', 'kind' => 'save', 'value' => 19]);
        $this->send($this->player, ['character' => '7', 'kind' => 'initiative', 'value' => 23]);

        $rolls = collect($this->dmSees())->keyBy('kind');
        $this->assertCount(2, $rolls);
        $this->assertSame(19, $rolls['save']['value']);
        $this->assertSame(23, $rolls['initiative']['value']);
    }

    public function test_only_the_owner_may_send_for_a_character_and_only_sensible_numbers_are_accepted(): void
    {
        $this->send($this->player, ['character' => '8', 'kind' => 'attack', 'value' => 10])->assertForbidden(); // somebody else's
        $this->send($this->player, ['character' => '999', 'kind' => 'attack', 'value' => 10])->assertForbidden(); // no such character
        $this->send(User::factory()->create(), ['character' => '7', 'kind' => 'attack', 'value' => 10])->assertNotFound(); // not at the table
        $this->send($this->player, ['character' => '7', 'kind' => 'attack', 'value' => 21])->assertStatus(422); // a d20 has no 21
        $this->send($this->player, ['character' => '7', 'kind' => 'initiative', 'value' => 21])->assertOk(); // but an initiative total can
        $this->send($this->player, ['character' => '7', 'kind' => 'initiative', 'value' => 61])->assertStatus(422);
        $this->send($this->player, ['character' => '7', 'kind' => 'attack', 'value' => 0])->assertStatus(422);
        $this->send($this->player, ['character' => '7', 'kind' => 'death', 'value' => 20])->assertOk(); // a death save is a bare d20
        $this->send($this->player, ['character' => '7', 'kind' => 'death', 'value' => 21])->assertStatus(422);
        $this->send($this->player, ['character' => '7', 'kind' => 'damage', 'value' => 5])->assertStatus(422);
        $this->assertCount(2, $this->dmSees());
    }

    public function test_the_dm_clears_a_roll_and_players_cannot(): void
    {
        $this->send($this->player, ['character' => '7', 'kind' => 'attack', 'value' => 12]);
        $id = $this->dmSees()[0]['id'];

        $this->actingAs($this->player)->deleteJson("/api/campaigns/{$this->campaign->id}/rolls/{$id}")->assertForbidden();
        $this->assertCount(1, $this->dmSees());
        $this->actingAs($this->dm)->deleteJson("/api/campaigns/{$this->campaign->id}/rolls/{$id}")->assertOk();
        $this->assertSame([], $this->dmSees());
    }

    public function test_stale_rolls_are_not_offered(): void
    {
        $this->send($this->player, ['character' => '7', 'kind' => 'attack', 'value' => 12]);
        $this->travel(121)->minutes();
        $this->assertSame([], $this->dmSees());
    }
}
