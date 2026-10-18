<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayerRoll extends Model
{
    /** A roll nobody picked up for this long is stale (the fight moved on). */
    public const STALE_MINUTES = 120;

    protected $guarded = [];
}
