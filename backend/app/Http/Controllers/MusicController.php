<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\Track;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The shared music library: every signed-in account sees every track and can use it in its own campaigns' scenes (the scenes themselves are campaign data
 * in the browser's synced `music` record and only name track ids). Anyone can upload; the uploader (or an administrator) renames and deletes.
 * The audio is streamed from the private disk with range support, so the browser can seek and start before the file has arrived.
 */
class MusicController extends Controller
{
    private const TYPES = ['mp3', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'wav', 'flac', 'webm'];

    public function index(Request $request): JsonResponse
    {
        $me = $request->user();

        return response()->json([
            'tracks' => Track::with('uploader:id,name')->orderBy('name')->get()->map(fn (Track $t) => $this->present($t, $me)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $me = $request->user();
        $request->validate([
            'file' => ['required', 'file', 'mimes:'.implode(',', [...self::TYPES, 'mpga', 'mp4']), 'max:51200'], // 50 MB; the host's PHP limits may be lower
            'name' => ['nullable', 'string', 'max:190'],
        ]);
        $file = $request->file('file');
        $hash = hash_file('sha256', $file->getRealPath());

        // the same file again is the same track
        if ($existing = Track::where('hash', $hash)->first()) {
            return response()->json(['track' => $this->present($existing, $me), 'duplicate' => true]);
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $ext = ['mpga' => 'mp3', 'mp4' => 'm4a'][$ext] ?? $ext;
        if (! in_array($ext, self::TYPES, true)) {
            $ext = 'mp3'; // the content passed the type check; the name only decides the file's extension
        }
        $name = trim((string) $request->input('name')) ?: trim(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $track = Track::create([
            'user_id' => $me->id,
            'name' => mb_substr($name ?: 'Track', 0, 190),
            'hash' => $hash,
            'path' => $file->storeAs('music', "{$hash}.{$ext}", 'local'),
            'mime' => $file->getMimeType() ?: 'audio/mpeg',
            'size' => $file->getSize(),
        ]);

        return response()->json(['track' => $this->present($track->load('uploader:id,name'), $me)], 201);
    }

    public function stream(Track $track): BinaryFileResponse
    {
        $path = Storage::disk('local')->path($track->path);
        abort_unless(is_file($path), 404);

        // the file never changes under its id, so the browser may keep it
        return response()->file($path, ['Content-Type' => $track->mime, 'Cache-Control' => 'private, max-age=86400']);
    }

    public function update(Request $request, Track $track): JsonResponse
    {
        $me = $request->user();
        $this->mayEdit($me, $track);
        $data = $request->validate(['name' => ['required', 'string', 'max:190']]);
        $track->update(['name' => trim($data['name'])]);

        return response()->json(['track' => $this->present($track->load('uploader:id,name'), $me)]);
    }

    public function destroy(Request $request, Track $track): JsonResponse
    {
        $me = $request->user();
        $this->mayEdit($me, $track);
        if ($track->user_id !== $me->id) {
            AdminLog::create(['admin_id' => $me->id, 'admin_name' => $me->name, 'action' => 'music.delete', 'subject' => mb_substr($track->name, 0, 255)]);
        }
        Storage::disk('local')->delete($track->path);
        $track->delete();

        return response()->json(['ok' => true]);
    }

    private function mayEdit(User $user, Track $track): void
    {
        abort_unless($user->is_admin || $track->user_id === $user->id, 403);
    }

    /** @return array{id: int, name: string, size: int, uploader: ?string, can_edit: bool} */
    private function present(Track $track, User $me): array
    {
        return [
            'id' => $track->id,
            'name' => $track->name,
            'size' => (int) $track->size,
            'uploader' => $track->uploader?->name,
            'can_edit' => (bool) $me->is_admin || $track->user_id === $me->id,
        ];
    }
}
