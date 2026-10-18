<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // the secret in the table-screen link (a TV that cannot log in)
        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('view_token', 40)->nullable()->unique()->after('rev');
        });
        foreach (DB::table('campaigns')->pluck('id') as $id) {
            DB::table('campaigns')->where('id', $id)->update(['view_token' => Str::random(32)]);
        }

        // What the table may see, already stripped of secrets by the DM's browser: the public combat state, portraits, the shown sheet, the
        // language, and a heartbeat. `version` goes up on every push so viewers fetch only the parts that changed.
        Schema::create('live_parts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->string('part', 12);
            $table->longText('data')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->unique(['campaign_id', 'part']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_parts');
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn('view_token');
        });
    }
};
