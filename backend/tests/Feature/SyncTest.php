<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    private Campaign $campaign;

    private User $dm;

    private User $player;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dm = User::factory()->create();
        $this->player = User::factory()->create();
        $this->campaign = Campaign::create(['name' => 'Table']);
        $this->campaign->members()->attach($this->dm->id, ['role' => 'dm']);
        $this->campaign->members()->attach($this->player->id, ['role' => 'player']);
    }

    private function push(User $as, array $docs)
    {
        return $this->actingAs($as)->postJson("/api/campaigns/{$this->campaign->id}/sync", ['docs' => $docs]);
    }

    private function pull(User $as, int $since = 0)
    {
        return $this->actingAs($as)->getJson("/api/campaigns/{$this->campaign->id}/sync?since={$since}");
    }

    private function doc(string $collection, string $key, ?string $data, ?int $owner = null): array
    {
        return ['collection' => $collection, 'key' => $key, 'data' => $data] + ($owner ? ['owner_id' => $owner] : []);
    }

    public function test_the_dm_pushes_and_pulls_and_the_json_comes_back_untouched(): void
    {
        $raw = '{"spent":{},"list":[],"n":1.5,"name":"Ålfred"}'; // `{}` must not turn into `[]`
        $this->push($this->dm, [$this->doc('combat', 'current', $raw), $this->doc('characters', '1000000001', '{"id":1000000001}')])
            ->assertOk()->assertJsonPath('rev', 1)->assertJsonPath('rejected', []);

        $docs = $this->pull($this->dm)->assertOk()->assertJsonPath('rev', 1)->json('docs');
        $this->assertCount(2, $docs);
        $this->assertSame($raw, collect($docs)->firstWhere('collection', 'combat')['data']);
    }

    public function test_pulling_since_a_revision_returns_only_what_changed_and_tombstones(): void
    {
        $this->push($this->dm, [$this->doc('journal', '1', '{"a":1}'), $this->doc('journal', '2', '{"a":2}')]);
        $this->push($this->dm, [$this->doc('journal', '2', '{"a":3}'), $this->doc('journal', '1', null)])->assertJsonPath('rev', 2);

        $docs = collect($this->pull($this->dm, 1)->json('docs'));
        $this->assertCount(2, $docs);
        $this->assertTrue($docs->firstWhere('key', '1')['deleted']);
        $this->assertSame('{"a":3}', $docs->firstWhere('key', '2')['data']);
        $this->assertCount(1, $this->pull($this->dm)->json('docs')); // a full pull leaves deleted records out
        $this->assertCount(0, $this->pull($this->dm, 2)->json('docs'));
    }

    public function test_a_player_only_sees_and_changes_their_own_characters(): void
    {
        $mine = '1000000002';
        $this->push($this->dm, [$this->doc('characters', '5', '{"n":"Npc"}'), $this->doc('combat', 'current', '{}'), $this->doc('kv', 'settings', '{}')]);
        $this->push($this->player, [$this->doc('characters', $mine, '{"n":"Mine"}')])->assertJsonPath('rejected', []);

        $docs = $this->pull($this->player)->json('docs');
        $this->assertSame([$mine], array_column($docs, 'key'));

        // not theirs, and not a character
        $this->push($this->player, [$this->doc('characters', '5', '{"n":"Hacked"}'), $this->doc('combat', 'current', '{"x":1}'), $this->doc('characters', $mine, '{"n":"Edited"}')])
            ->assertJsonCount(2, 'rejected');
        $this->assertSame('{"n":"Npc"}', collect($this->pull($this->dm)->json('docs'))->firstWhere('key', '5')['data']);
        $this->assertSame('{"n":"Edited"}', collect($this->pull($this->player)->json('docs'))->firstWhere('key', $mine)['data']);
        // the DM may edit it too, and it stays the player's
        $this->push($this->dm, [$this->doc('characters', $mine, '{"n":"DM edit"}')]);
        $this->assertSame('{"n":"DM edit"}', $this->pull($this->player)->json('docs.0.data'));
    }

    public function test_only_the_dm_hands_a_character_to_a_player(): void
    {
        $this->push($this->dm, [$this->doc('characters', '7', '{}', $this->player->id)]);
        $this->assertSame(['7'], array_column($this->pull($this->player)->json('docs'), 'key'));

        $this->push($this->player, [$this->doc('characters', '8', '{}', $this->dm->id)]);
        $this->assertSame(['7', '8'], array_column($this->pull($this->player)->json('docs'), 'key')); // still the player's own
        $this->push($this->dm, [$this->doc('characters', '9', '{}', User::factory()->create()->id)]); // not a member: stays the DM's
        $this->assertNotContains('9', array_column($this->pull($this->player)->json('docs'), 'key'));
    }

    public function test_a_player_is_told_which_characters_are_theirs_so_a_handed_over_one_can_vanish(): void
    {
        $this->push($this->dm, [$this->doc('characters', '7', '{}', $this->player->id), $this->doc('characters', '8', '{}')]);
        $this->assertSame(['7'], $this->pull($this->player)->json('owned'));
        $this->assertNull($this->pull($this->dm)->json('owned'));

        $this->push($this->dm, [$this->doc('characters', '7', '{}', $this->dm->id)]); // handed back
        $this->assertSame([], $this->pull($this->player)->json('owned'));
        $this->push($this->player, [$this->doc('characters', '7', '{"edited":1}')])->assertJsonCount(1, 'rejected'); // and no longer theirs to change
    }

    public function test_enemy_pictures_sync_for_the_dm_but_are_never_sent_to_players(): void
    {
        $this->push($this->dm, [$this->doc('avatars', 'goblin', '{"key":"goblin","imageData":"data:image/jpeg;base64,AAAA"}')])->assertOk()->assertJsonPath('rejected', []);
        $this->assertSame(['goblin'], array_column($this->pull($this->dm)->json('docs'), 'key'));
        $this->assertSame([], $this->pull($this->player)->json('docs')); // players get theirs from the live view
        $this->push($this->player, [$this->doc('avatars', 'goblin', '{}')])->assertJsonCount(1, 'rejected');
    }

    public function test_strangers_are_turned_away_and_an_empty_push_does_not_move_the_revision(): void
    {
        $this->pull(User::factory()->create())->assertNotFound();
        $this->push(User::factory()->create(), [$this->doc('kv', 'a', '{}')])->assertNotFound();
        $this->push($this->dm, [$this->doc('kv', 'a', null)])->assertJsonPath('rev', 0); // deleting what was never there
        $this->push($this->dm, [$this->doc('nope', 'a', '{}')])->assertStatus(422);
    }

    public function test_prune_removes_what_is_not_kept_and_is_for_the_dm(): void
    {
        $this->push($this->dm, [$this->doc('journal', '1', '{}'), $this->doc('journal', '2', '{}'), $this->doc('kv', 'settings', '{}')]);
        $this->actingAs($this->player)->postJson("/api/campaigns/{$this->campaign->id}/sync/prune", ['keep' => ['journal' => []]])->assertForbidden();

        $this->actingAs($this->dm)->postJson("/api/campaigns/{$this->campaign->id}/sync/prune", ['keep' => ['journal' => ['2']]])->assertOk()->assertJsonPath('rev', 2);
        $keys = collect($this->pull($this->dm)->json('docs'))->map(fn ($d) => $d['collection'].':'.$d['key'])->all();
        $this->assertEqualsCanonicalizing(['journal:2', 'kv:settings'], $keys); // kv was not listed, so it stays
    }
}
