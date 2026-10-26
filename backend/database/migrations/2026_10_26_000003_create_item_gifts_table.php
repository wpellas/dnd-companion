<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An item one player passes to a character owned by someone else. A player can only write their own characters, so the giver's browser
        // leaves the item here and the receiver's browser (the account that owns the target character) picks it up with its sync poll, adds it
        // to its own character and deletes the row. `item` is the item's JSON, stored untouched like the documents.
        Schema::create('item_gifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->string('to_character', 190); // the receiving character's key in the campaign
            $table->string('from_name', 120); // who gave it, for the notice the receiver sees
            $table->longText('item');
            $table->timestamps();
            $table->index(['campaign_id', 'to_character']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('item_gifts');
    }
};
