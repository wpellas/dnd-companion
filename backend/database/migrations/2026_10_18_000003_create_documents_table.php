<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // a campaign's change counter: every accepted push moves it up, and clients poll "everything after revision N"
        Schema::table('campaigns', function (Blueprint $table) {
            $table->unsignedBigInteger('rev')->default(0)->after('name');
        });

        // The app's records (characters, combat, journal...) as the JSON the browser made them. The server never looks inside `data`,
        // so the browser keeps all the game rules and the schema can change without a migration here.
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->string('collection', 20);
            $table->string('key', 190);
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->longText('data')->nullable();
            $table->boolean('deleted')->default(false); // a tombstone, so other devices learn about the delete
            $table->unsignedBigInteger('rev');
            $table->timestamps();
            $table->unique(['campaign_id', 'collection', 'key']);
            $table->index(['campaign_id', 'rev']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('rev');
        });
    }
};
