<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemGift extends Model
{
    /** Gifts nobody has collected: more than this per campaign are refused (someone's account never opens the app). */
    public const MAX_WAITING = 100;

    protected $guarded = [];
}
