<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        // who sits at the table: any account can be the DM of one campaign and a player in another
        Schema::create('campaign_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 10)->default('player'); // 'dm' | 'player'
            $table->timestamps();
            $table->unique(['campaign_id', 'user_id']);
        });

        // registration is invite-only: no campaign = a site invite made by an administrator
        Schema::create('invites', function (Blueprint $table) {
            $table->id();
            $table->string('code', 16)->unique();
            $table->foreignId('campaign_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('max_uses')->default(1);
            $table->unsignedSmallInteger('used_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invites');
        Schema::dropIfExists('campaign_user');
        Schema::dropIfExists('campaigns');
    }
};
