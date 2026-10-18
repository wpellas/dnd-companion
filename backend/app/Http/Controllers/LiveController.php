<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The live view for the table. The DM's browser pushes the player-safe parts (it strips monster HP and AC itself, so the server never
 * holds them); players poll them while signed in, and a TV polls them with the secret link. Parts are stored as the JSON string the browser sent.
 */
class LiveController extends Controller
{
    public const PARTS = ['combat', 'portraits', 'sheet', 'lang', 'ping'];

    /** A DM's browser sends one or more parts; a null value clears that part (e.g. no sheet is being shown). */
    public function push(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->roleOrFail($request->user()) === 'dm', 403);
        $parts = $request->validate(['parts' => ['required', 'array', 'min:1'], 'parts.*' => ['nullable', 'string']])['parts'];
        foreach (array_keys($parts) as $name) {
            abort_unless(in_array($name, self::PARTS, true), 422);
        }

        DB::transaction(function () use ($campaign, $parts) {
            foreach ($parts as $name => $data) {
                $row = $campaign->liveParts()->where('part', $name)->lockForUpdate()->first();
                if ($row) {
                    $row->update(['data' => $data, 'version' => $row->version + 1]);
                } else {
                    $campaign->liveParts()->create(['part' => $name, 'data' => $data]);
                }
            }
        });

        return response()->json(['ok' => true]);
    }

    /** For signed-in members of the campaign. */
    public function pull(Request $request, Campaign $campaign): JsonResponse
    {
        $campaign->roleOrFail($request->user());

        return $this->snapshot($request, $campaign);
    }

    /** For the table screen: the secret in the link stands in for a login. Unknown tokens get a plain 404. */
    public function table(Request $request, string $token): JsonResponse
    {
        return $this->snapshot($request, Campaign::where('view_token', $token)->firstOrFail());
    }

    /** A new link; the old one stops working at once (for when it leaked). */
    public function newLink(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->roleOrFail($request->user()) === 'dm', 403);
        $campaign->forceFill(['view_token' => Str::random(32)])->save();

        return response()->json(['view_token' => $campaign->view_token]);
    }

    /** Only the parts whose version differs from the one the viewer already has (`?combat=3&lang=1`). */
    private function snapshot(Request $request, Campaign $campaign): JsonResponse
    {
        $rows = $campaign->liveParts()->get()->keyBy('part');
        $changed = [];
        foreach ($rows as $name => $row) {
            if ((int) $request->query($name, -1) !== $row->version) {
                $changed[$name] = ['version' => $row->version, 'data' => $row->data];
            }
        }
        unset($changed['ping']); // only used for "is the DM's app open"

        return response()->json([
            'parts' => $changed,
            'host_online' => (bool) $rows->get('ping')?->updated_at?->gt(now()->subSeconds(60)),
        ]);
    }
}
