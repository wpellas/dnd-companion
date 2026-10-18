<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A number a player typed on their phone for the DM's screen. The player rolled the physical die; the DM uses it or ignores it, and
        // nothing ever waits for it. One per character and kind: sending again replaces it.
        Schema::create('player_rolls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('character_key', 190); // the character's id in the campaign, as the browser knows it
            $table->string('kind', 12); // initiative | attack | save
            $table->unsignedSmallInteger('value');
            $table->timestamps();
            $table->unique(['campaign_id', 'character_key', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('player_rolls');
    }
};
