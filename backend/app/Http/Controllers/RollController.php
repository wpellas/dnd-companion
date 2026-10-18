<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Document;
use App\Models\PlayerRoll;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Players who like to can type what they rolled on their phone; it shows up on the DM's screen ready to use. Strictly optional and never waited for.
 * The DM's browser reads the waiting rolls with its sync poll (SyncController::pull), so only sending and clearing live here.
 */
class RollController extends Controller
{
    /** Initiative is a total (d20 plus bonus); an attack roll or a save is the d20 itself, because the DM's panel adds the bonus. */
    private const MAX = ['initiative' => 60, 'attack' => 20, 'save' => 20];

    public function store(Request $request, Campaign $campaign): JsonResponse
    {
        $user = $request->user();
        $role = $campaign->roleOrFail($user);
        $data = $request->validate([
            'character' => ['required', 'string', 'max:190'],
            'kind' => ['required', Rule::in(array_keys(self::MAX))],
            'value' => ['required', 'integer', 'min:1'],
        ]);
        if ($data['value'] > self::MAX[$data['kind']]) {
            throw ValidationException::withMessages(['value' => 'That number is too high for this kind of roll.']);
        }
        // a player sends for their own characters; the DM's own screen does not need this
        $mine = Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'key' => $data['character'], 'deleted' => false])
            ->when($role !== 'dm', fn ($q) => $q->where('owner_id', $user->id))->exists();
        abort_unless($mine, 403);

        PlayerRoll::updateOrCreate(
            ['campaign_id' => $campaign->id, 'character_key' => $data['character'], 'kind' => $data['kind']],
            ['user_id' => $user->id, 'value' => $data['value']],
        )->touch(); // a repeated number is still a new roll

        return response()->json(['ok' => true]);
    }

    /** The DM used the roll (or does not want it). */
    public function destroy(Request $request, Campaign $campaign, int $roll): JsonResponse
    {
        abort_unless($campaign->roleOrFail($request->user()) === 'dm', 403);
        PlayerRoll::where(['campaign_id' => $campaign->id, 'id' => $roll])->delete();

        return response()->json(['ok' => true]);
    }
}
