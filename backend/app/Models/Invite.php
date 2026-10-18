<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

#[Fillable(['campaign_id', 'created_by', 'max_uses', 'expires_at'])]
class Invite extends Model
{
    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(fn (Invite $invite) => $invite->code ??= strtoupper(Str::random(10)));
    }

    /** Not expired and not used up. */
    public function scopeUsable(Builder $query): Builder
    {
        return $query
            ->whereColumn('used_count', '<', 'max_uses')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    /** Count one use. The condition sits in the UPDATE so two people can't both take the last use. */
    public function consume(): bool
    {
        return static::whereKey($this->id)->usable()->increment('used_count') === 1;
    }
}
