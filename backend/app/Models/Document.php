<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    /** What the browser keeps in its own database: the sync endpoints accept nothing else. */
    public const COLLECTIONS = ['characters', 'monsters', 'combat', 'encounters', 'journal', 'kv', 'avatars', 'maps'];

    protected $guarded = [];

    protected function casts(): array
    {
        return ['deleted' => 'boolean'];
    }
}
