<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Invite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->campaigns->map(fn ($c) => $this->present($c, $c->pivot->role))->values());
    }

    /** Whoever makes a campaign is its DM. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $campaign = Campaign::create($data);
        $campaign->members()->attach($request->user()->id, ['role' => 'dm']);

        return response()->json($this->present($campaign, 'dm'), 201);
    }

    public function show(Request $request, Campaign $campaign): JsonResponse
    {
        $role = $this->role($request, $campaign);

        return response()->json($this->present($campaign, $role) + [
            'view_token' => $role === 'dm' ? $campaign->view_token : null, // the table-screen link is the DM's to share
            'members' => $campaign->members->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->pivot->role])->values(),
        ]);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        $this->role($request, $campaign, dm: true);
        $campaign->update($request->validate(['name' => ['required', 'string', 'max:80']]));

        return response()->json($this->present($campaign, 'dm'));
    }

    public function destroy(Request $request, Campaign $campaign): JsonResponse
    {
        $this->role($request, $campaign, dm: true);
        $campaign->delete();

        return response()->json(['ok' => true]);
    }

    /** The DM invites players: a code (valid a week by default) that also works for people without an account. */
    public function invite(Request $request, Campaign $campaign): JsonResponse
    {
        $this->role($request, $campaign, dm: true);
        $data = $request->validate(['max_uses' => ['nullable', 'integer', 'min:1', 'max:50'], 'days' => ['nullable', 'integer', 'min:1', 'max:90']]);
        $invite = Invite::create([
            'campaign_id' => $campaign->id,
            'created_by' => $request->user()->id,
            'max_uses' => $data['max_uses'] ?? 5,
            'expires_at' => now()->addDays($data['days'] ?? 7),
        ]);

        return response()->json(['code' => $invite->code, 'max_uses' => $invite->max_uses, 'expires_at' => $invite->expires_at], 201);
    }

    /** An existing account joins a table with a campaign invite code. */
    public function join(Request $request): JsonResponse
    {
        $code = strtoupper(trim($request->validate(['code' => ['required', 'string']])['code']));
        $user = $request->user();

        return DB::transaction(function () use ($code, $user) {
            $invite = Invite::usable()->whereNotNull('campaign_id')->where('code', $code)->first();
            if (! $invite) {
                throw ValidationException::withMessages(['code' => 'That invite code is not valid.']);
            }
            $campaign = Campaign::findOrFail($invite->campaign_id);
            // already at the table: nothing is used up
            if ($campaign->roleOf($user) === null) {
                $invite->consume();
                $campaign->members()->attach($user->id, ['role' => 'player']);
            }

            return response()->json($this->present($campaign, $campaign->roleOf($user)));
        });
    }

    /** The DM removes a player, or anyone leaves; a table is never left without a DM. */
    public function removeMember(Request $request, Campaign $campaign, int $user): JsonResponse
    {
        $role = $this->role($request, $campaign);
        abort_unless($role === 'dm' || $user === $request->user()->id, 403);
        $target = $campaign->members()->where('users.id', $user)->first();
        abort_unless($target, 404);
        if ($target->pivot->role === 'dm' && $campaign->members()->wherePivot('role', 'dm')->count() === 1) {
            throw ValidationException::withMessages(['user' => 'The last DM cannot leave: delete the campaign instead.']);
        }
        $campaign->members()->detach($user);

        return response()->json(['ok' => true]);
    }

    /** The caller's role at this table; strangers get a 404 so campaign ids do not leak. */
    private function role(Request $request, Campaign $campaign, bool $dm = false): string
    {
        $role = $campaign->roleOf($request->user());
        abort_if($role === null, 404);
        abort_if($dm && $role !== 'dm', 403);

        return $role;
    }

    private function present(Campaign $campaign, ?string $role): array
    {
        return ['id' => $campaign->id, 'name' => $campaign->name, 'role' => $role];
    }
}
