<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LiveTest extends TestCase
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

    private function push(User $as, array $parts)
    {
        return $this->actingAs($as)->postJson("/api/campaigns/{$this->campaign->id}/live", ['parts' => $parts]);
    }

    public function test_the_dm_pushes_and_players_get_only_what_changed_since_their_versions(): void
    {
        $this->push($this->dm, ['combat' => '{"round":1}', 'lang' => '"sv"'])->assertOk();

        $first = $this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/live")->assertOk();
        $first->assertJsonPath('parts.combat.data', '{"round":1}')->assertJsonPath('parts.lang.version', 1);

        // nothing new: nothing sent
        $this->getJson("/api/campaigns/{$this->campaign->id}/live?combat=1&lang=1")->assertJsonPath('parts', []);

        $this->push($this->dm, ['combat' => '{"round":2}']);
        $again = $this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/live?combat=1&lang=1")->json('parts');
        $this->assertSame(['combat'], array_keys($again));
        $this->assertSame(2, $again['combat']['version']);
    }

    public function test_a_part_can_be_cleared_and_the_viewer_hears_about_it(): void
    {
        $this->push($this->dm, ['sheet' => '{"name":"Merlin"}']);
        $this->push($this->dm, ['sheet' => null]);
        $this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/live?sheet=1")->assertJsonPath('parts.sheet.data', null)->assertJsonPath('parts.sheet.version', 2);
    }

    public function test_a_shown_map_is_a_live_part_and_a_big_one_fits(): void
    {
        $map = json_encode(['name' => 'Cave', 'imageData' => 'data:image/jpeg;base64,'.str_repeat('A', 900000)]);
        $this->push($this->dm, ['map' => $map])->assertOk();
        $this->assertSame($map, $this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/live")->json('parts.map.data'));
        $this->push($this->dm, ['map' => null]);
        $this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}/live?map=1")->assertJsonPath('parts.map.data', null);
    }

    public function test_only_the_dm_pushes_and_only_known_parts(): void
    {
        $this->push($this->player, ['combat' => '{}'])->assertForbidden();
        $this->push(User::factory()->create(), ['combat' => '{}'])->assertNotFound();
        $this->push($this->dm, ['secrets' => '{}'])->assertStatus(422);
        $this->actingAs(User::factory()->create())->getJson("/api/campaigns/{$this->campaign->id}/live")->assertNotFound();
    }

    public function test_the_heartbeat_tells_whether_the_dms_app_is_open_and_is_not_sent_as_a_part(): void
    {
        $url = "/api/campaigns/{$this->campaign->id}/live";
        $this->actingAs($this->player)->getJson($url)->assertJsonPath('host_online', false);
        $this->push($this->dm, ['ping' => '1']);
        $this->actingAs($this->player)->getJson($url)->assertJsonPath('host_online', true)->assertJsonPath('parts', []);
        $this->travel(2)->minutes();
        $this->getJson($url)->assertJsonPath('host_online', false);
    }

    public function test_the_table_screen_link_needs_no_login_and_can_be_replaced(): void
    {
        $this->push($this->dm, ['combat' => '{"round":3}']);
        $token = $this->actingAs($this->dm)->getJson("/api/campaigns/{$this->campaign->id}")->json('view_token');
        $this->assertSame(32, strlen($token));
        $this->assertNull($this->actingAs($this->player)->getJson("/api/campaigns/{$this->campaign->id}")->json('view_token')); // players do not get the DM's link

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/table/{$token}/live")->assertOk()->assertJsonPath('parts.combat.data', '{"round":3}');
        $this->getJson('/api/table/not-a-real-token/live')->assertNotFound();

        $new = $this->actingAs($this->dm)->postJson("/api/campaigns/{$this->campaign->id}/live-link")->assertOk()->json('view_token');
        $this->assertNotSame($token, $new);
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/table/{$token}/live")->assertNotFound();
        $this->getJson("/api/table/{$new}/live")->assertOk();
        $this->actingAs($this->player)->postJson("/api/campaigns/{$this->campaign->id}/live-link")->assertForbidden();
    }
}
