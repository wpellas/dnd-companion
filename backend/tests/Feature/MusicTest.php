<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MusicTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function upload(User $as, string $name = 'Battle.mp3', int $kb = 40)
    {
        return $this->actingAs($as)->post('/api/music', ['file' => UploadedFile::fake()->create($name, $kb, 'audio/mpeg')], ['Accept' => 'application/json']);
    }

    public function test_guests_get_nothing(): void
    {
        $this->getJson('/api/music')->assertUnauthorized();
        $this->getJson('/api/music/1/stream')->assertUnauthorized();
    }

    public function test_an_upload_is_stored_and_every_account_sees_and_streams_it(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $id = $this->upload($alice)->assertCreated()->json('track.id');

        $list = $this->actingAs($bob)->getJson('/api/music')->assertOk()->json('tracks');
        $this->assertCount(1, $list);
        $this->assertSame('Battle', $list[0]['name']);
        $this->assertSame($alice->name, $list[0]['uploader']);
        $this->assertFalse($list[0]['can_edit']);
        $this->actingAs($bob)->get("/api/music/{$id}/stream")->assertOk();
        Storage::disk('local')->assertExists(Track::find($id)->path);
    }

    public function test_the_same_file_is_one_track(): void
    {
        $alice = User::factory()->create();
        $file = UploadedFile::fake()->createWithContent('Same.mp3', 'identical bytes');
        $again = UploadedFile::fake()->createWithContent('Other name.mp3', 'identical bytes');
        $this->actingAs($alice)->post('/api/music', ['file' => $file], ['Accept' => 'application/json'])->assertCreated();
        $this->actingAs($alice)->post('/api/music', ['file' => $again], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('duplicate', true);
        $this->assertSame(1, Track::count());
    }

    public function test_only_audio_files_are_accepted(): void
    {
        $alice = User::factory()->create();
        $this->actingAs($alice)->post('/api/music', ['file' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain')], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertSame(0, Track::count());
    }

    public function test_only_the_uploader_or_an_admin_renames_and_deletes(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $admin = User::factory()->create(['is_admin' => true]);
        $id = $this->upload($alice)->json('track.id');

        $this->actingAs($bob)->patchJson("/api/music/{$id}", ['name' => 'Mine now'])->assertForbidden();
        $this->actingAs($bob)->deleteJson("/api/music/{$id}")->assertForbidden();
        $this->actingAs($alice)->patchJson("/api/music/{$id}", ['name' => 'Boss theme'])->assertOk()->assertJsonPath('track.name', 'Boss theme');

        $path = Track::find($id)->path;
        $this->actingAs($admin)->deleteJson("/api/music/{$id}")->assertOk();
        $this->assertSame(0, Track::count());
        Storage::disk('local')->assertMissing($path);
    }
}
