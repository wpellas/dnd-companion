<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Document;
use App\Models\ItemGift;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Passing an item between characters that belong to different accounts. The giver's browser removes the item from its own character and leaves it here;
 * the receiving account's browser collects it with the sync poll (SyncController::pull), adds it to its own character and deletes it again. Each account
 * therefore only ever writes its own characters. The item is the browser's JSON, kept as the string it arrived as.
 */
class GiftController extends Controller
{
    /** Every character at the table (name and who plays it), so a player can pick who to give to. Members only; nothing but a name is shown. */
    public function party(Request $request, Campaign $campaign): JsonResponse
    {
        $campaign->roleOrFail($request->user());
        $docs = Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'deleted' => false])->get(['key', 'data', 'owner_id']);
        $owners = User::whereIn('id', $docs->pluck('owner_id')->filter()->all())->pluck('name', 'id');

        return response()->json($docs->map(fn ($d) => [
            'key' => $d->key,
            'name' => $this->nameOf($d),
            'owner' => $owners[$d->owner_id] ?? null,
        ])->values());
    }

    public function store(Request $request, Campaign $campaign): JsonResponse
    {
        $user = $request->user();
        $role = $campaign->roleOrFail($user);
        $data = $request->validate([
            'from' => ['required', 'string', 'max:190'],
            'to' => ['required', 'string', 'max:190', 'different:from'],
            'item' => ['required', 'string', 'max:20000'],
        ]);
        $item = json_decode($data['item'], true);
        if (! is_array($item) || ! is_string($item['name'] ?? null) || ! is_int($item['qty'] ?? null) || $item['qty'] < 1) {
            throw ValidationException::withMessages(['item' => 'That is not an item.']);
        }
        // a player gives from their own characters; the DM from any
        $from = Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'key' => $data['from'], 'deleted' => false])
            ->when($role !== 'dm', fn ($q) => $q->where('owner_id', $user->id))->first();
        abort_unless($from, 403);
        if (! Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'key' => $data['to'], 'deleted' => false])->exists()) {
            throw ValidationException::withMessages(['to' => 'That character is not in this campaign.']);
        }
        if (ItemGift::where('campaign_id', $campaign->id)->count() >= ItemGift::MAX_WAITING) {
            throw ValidationException::withMessages(['to' => 'Too many gifts are waiting to be collected.']);
        }

        $gift = ItemGift::create([
            'campaign_id' => $campaign->id,
            'to_character' => $data['to'],
            'from_name' => mb_substr($this->nameOf($from), 0, 120),
            'item' => $data['item'],
        ]);

        return response()->json(['id' => $gift->id], 201);
    }

    /** The receiving account has added the item to its character. */
    public function destroy(Request $request, Campaign $campaign, int $gift): JsonResponse
    {
        $user = $request->user();
        $campaign->roleOrFail($user);
        $row = ItemGift::where(['campaign_id' => $campaign->id, 'id' => $gift])->firstOrFail();
        $mine = Document::where(['campaign_id' => $campaign->id, 'collection' => 'characters', 'key' => $row->to_character, 'owner_id' => $user->id])->exists();
        abort_unless($mine, 403);
        $row->delete();

        return response()->json(['ok' => true]);
    }

    /** Read-only peek at the name inside a character's JSON (the stored string itself is never changed). */
    private function nameOf(Document $doc): string
    {
        return (string) ((json_decode((string) $doc->data, true) ?? [])['name'] ?? '');
    }
}
