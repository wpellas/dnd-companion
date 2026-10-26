<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\ItemGift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GiftTest extends TestCase
{
    use RefreshDatabase;

    private Campaign $campaign;

    private User $dm;

    private User $ann;

    private User $bob;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dm = User::factory()->create(['can_dm' => true]);
        $this->ann = User::factory()->create();
        $this->bob = User::factory()->create();
        $this->campaign = Campaign::create(['name' => 'Table']);
        foreach ([[$this->dm, 'dm'], [$this->ann, 'player'], [$this->bob, 'player']] as [$u, $role]) {
            $this->campaign->members()->attach($u->id, ['role' => $role]);
        }
        $character = fn (string $key, string $name, User $owner) => $this->actingAs($this->dm)->postJson("/api/campaigns/{$this->campaign->id}/sync", [
            'docs' => [['collection' => 'characters', 'key' => $key, 'data' => json_encode(['name' => $name]), 'owner_id' => $owner->id]],
        ]);
        $character('7', 'Thorin', $this->ann);
        $character('8', 'Lyra', $this->bob);
        $character('9', 'Kobold King', $this->dm);
    }

    private function give(User $as, string $from, string $to, int $qty = 2)
    {
        $item = json_encode(['id' => 'x1', 'name' => 'Potion', 'kind' => 'gear', 'qty' => $qty]);

        return $this->actingAs($as)->postJson("/api/campaigns/{$this->campaign->id}/gifts", ['from' => $from, 'to' => $to, 'item' => $item]);
    }

    private function waitingFor(User $as): array
    {
        return $this->actingAs($as)->getJson("/api/campaigns/{$this->campaign->id}/sync?since=0")->assertOk()->json('gifts');
    }

    public function test_players_see_who_is_at_the_table(): void
    {
        $party = $this->actingAs($this->ann)->getJson("/api/campaigns/{$this->campaign->id}/party")->assertOk()->json();
        $this->assertEqualsCanonicalizing(['Thorin', 'Lyra', 'Kobold King'], array_column($party, 'name'));
        $this->assertSame($this->bob->name, collect($party)->firstWhere('key', '8')['owner']);
        $this->actingAs(User::factory()->create())->getJson("/api/campaigns/{$this->campaign->id}/party")->assertNotFound();
    }

    public function test_a_gift_is_collected_only_by_the_account_that_owns_the_receiving_character(): void
    {
        $this->give($this->ann, '7', '8')->assertCreated();

        $mine = $this->waitingFor($this->bob);
        $this->assertCount(1, $mine);
        $this->assertSame('Thorin', $mine[0]['from']);
        $this->assertSame('8', $mine[0]['to']);
        $this->assertSame([], $this->waitingFor($this->ann)); // the giver gets nothing back
        $this->assertSame([], $this->waitingFor($this->dm)); // and the DM's device must not apply a player's gift
    }

    public function test_a_gift_to_a_character_the_dm_plays_goes_to_the_dm(): void
    {
        $this->give($this->ann, '7', '9')->assertCreated();
        $this->assertCount(1, $this->waitingFor($this->dm));
        $this->assertSame([], $this->waitingFor($this->bob));
    }

    public function test_collecting_it_removes_it_and_only_the_receiver_may(): void
    {
        $id = $this->give($this->ann, '7', '8')->json('id');
        $this->actingAs($this->ann)->deleteJson("/api/campaigns/{$this->campaign->id}/gifts/{$id}")->assertForbidden();
        $this->actingAs($this->bob)->deleteJson("/api/campaigns/{$this->campaign->id}/gifts/{$id}")->assertOk();
        $this->assertSame(0, ItemGift::count());
    }

    public function test_you_can_only_give_from_your_own_character_to_a_real_other_one(): void
    {
        $this->give($this->ann, '8', '7')->assertForbidden(); // Lyra is Bob's
        $this->give($this->ann, '7', '404')->assertUnprocessable();
        $this->give($this->ann, '7', '7')->assertUnprocessable();
        $this->give($this->dm, '8', '7')->assertCreated(); // the DM may give from any
        $this->actingAs($this->ann)->postJson("/api/campaigns/{$this->campaign->id}/gifts", ['from' => '7', 'to' => '8', 'item' => '{"name":"x","qty":0}'])->assertUnprocessable();
        $this->assertSame(1, ItemGift::count());
    }
}
