<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['name'])]
class Campaign extends Model
{
    protected static function booted(): void
    {
        static::creating(fn (Campaign $campaign) => $campaign->view_token ??= Str::random(32));
    }

    public function liveParts(): HasMany
    {
        return $this->hasMany(LivePart::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('role')->withTimestamps();
    }

    public function invites(): HasMany
    {
        return $this->hasMany(Invite::class);
    }

    /** The user's role, or a 404 for strangers so campaign ids do not leak. */
    public function roleOrFail(User $user): string
    {
        return $this->roleOf($user) ?? abort(404);
    }

    /** 'dm', 'player' or null when the user is not at this table. */
    public function roleOf(User $user): ?string
    {
        return $this->members()->where('users.id', $user->id)->first()?->pivot->role;
    }
}
