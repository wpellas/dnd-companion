<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Only accounts an administrator has allowed (and administrators) may start campaigns; every other account is a player.
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('can_dm')->default(false)->after('is_admin');
        });
        // accounts that exist now keep what they could do before; an administrator takes it away where it is not wanted
        DB::table('users')->update(['can_dm' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('can_dm');
        });
    }
};
