<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Document;
use App\Models\PlayerRoll;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Keeps a campaign's records in step with the browsers. The DM reads and writes everything; a player only sees and changes
 * their own characters. `data` is a JSON string that is stored and returned untouched (decoding it in PHP would turn `{}` into `[]`).
 */
class SyncController extends Controller
{
    /** Everything that changed after revision `since` (0 = the whole campaign, without deleted records). */
    public function pull(Request $request, Campaign $campaign): JsonResponse
    {
        $user = $request->user();
        $role = $campaign->roleOrFail($user);
        $since = (int) $request->query('since', 0);

        // read the revision first: a push that lands while we query is simply fetched again next time
        $rev = (int) Campaign::whereKey($campaign->id)->value('rev');
        $query = Document::where('campaign_id', $campaign->id)->where('rev', '>', $since)->where('rev', '<=', $rev)->orderBy('rev')->orderBy('id');
        if ($since === 0) {
            $query->where('deleted', false);
        }
        if ($role !== 'dm') {
            $query->where('collection', 'characters')->where('owner_id', $user->id);
        }

        // A player's list of their own characters, so a character the DM hands to someone else disappears from their device.
        $owned = $role === 'dm' ? null : Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'owner_id' => $user->id, 'deleted' => false])->pluck('key')->all();

        // What players typed for the DM's screen (fresh ones only); players get nothing here.
        $rolls = $role !== 'dm' ? null : PlayerRoll::where('campaign_id', $campaign->id)
            ->where('updated_at', '>', now()->subMinutes(PlayerRoll::STALE_MINUTES))->orderBy('id')->get()
            ->map(fn ($r) => ['id' => $r->id, 'character' => $r->character_key, 'kind' => $r->kind, 'value' => $r->value, 'at' => $r->updated_at])->values();

        return response()->json([
            'rev' => $rev,
            'owned' => $owned,
            'rolls' => $rolls,
            'docs' => $query->get(['collection', 'key', 'data', 'deleted', 'owner_id'])->map(fn ($d) => [
                'collection' => $d->collection, 'key' => $d->key, 'data' => $d->data, 'deleted' => $d->deleted, 'owner_id' => $d->owner_id,
            ])->values(),
        ]);
    }

    /** Store a batch of records. `data: null` deletes. Answers with the new revision and the keys it refused. */
    public function push(Request $request, Campaign $campaign): JsonResponse
    {
        $user = $request->user();
        $role = $campaign->roleOrFail($user);
        $docs = $request->validate([
            'docs' => ['required', 'array', 'max:100'],
            'docs.*.collection' => ['required', Rule::in(Document::COLLECTIONS)],
            'docs.*.key' => ['required', 'string', 'max:190'],
            'docs.*.data' => ['nullable', 'string'],
            'docs.*.owner_id' => ['nullable', 'integer'],
        ])['docs'];

        return DB::transaction(function () use ($campaign, $user, $role, $docs) {
            $locked = Campaign::whereKey($campaign->id)->lockForUpdate()->first();
            $rev = $locked->rev + 1;
            $rejected = [];
            $changed = false;

            foreach ($docs as $in) {
                $doc = Document::where(['campaign_id' => $campaign->id, 'collection' => $in['collection'], 'key' => $in['key']])->first();
                if ($role !== 'dm' && ($in['collection'] !== 'characters' || ($doc && $doc->owner_id !== $user->id))) {
                    $rejected[] = ['collection' => $in['collection'], 'key' => $in['key']];

                    continue;
                }
                $data = $in['data'] ?? null;
                if ($data === null && (! $doc || $doc->deleted)) {
                    continue; // deleting something the server never had, or already deleted
                }
                $owner = $doc?->owner_id ?? $user->id;
                // only the DM hands a character to another member of the campaign
                if ($role === 'dm' && ! empty($in['owner_id']) && $campaign->members()->where('users.id', $in['owner_id'])->exists()) {
                    $owner = (int) $in['owner_id'];
                }
                Document::updateOrCreate(
                    ['campaign_id' => $campaign->id, 'collection' => $in['collection'], 'key' => $in['key']],
                    ['data' => $data, 'deleted' => $data === null, 'owner_id' => $owner, 'rev' => $rev],
                );
                $changed = true;
            }
            if ($changed) {
                $locked->forceFill(['rev' => $rev])->save();
            }

            return response()->json(['rev' => $changed ? $rev : $locked->rev, 'rejected' => $rejected]);
        });
    }

    /** DM only: delete every record of the listed collections that is not in the list (used after a restore or an import). */
    public function prune(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->roleOrFail($request->user()) === 'dm', 403);
        $keep = $request->validate([
            'keep' => ['required', 'array'],
            'keep.*' => ['array'],
            'keep.*.*' => ['string', 'max:190'],
        ])['keep'];

        return DB::transaction(function () use ($campaign, $keep) {
            $locked = Campaign::whereKey($campaign->id)->lockForUpdate()->first();
            $rev = $locked->rev + 1;
            $changed = false;
            foreach ($keep as $collection => $keys) {
                abort_unless(in_array($collection, Document::COLLECTIONS, true), 422);
                $stale = Document::where(['campaign_id' => $campaign->id, 'collection' => $collection, 'deleted' => false])->whereNotIn('key', $keys);
                $changed = $stale->update(['data' => null, 'deleted' => true, 'rev' => $rev]) > 0 || $changed;
            }
            if ($changed) {
                $locked->forceFill(['rev' => $rev])->save();
            }

            return response()->json(['rev' => $changed ? $rev : $locked->rev]);
        });
    }
}
