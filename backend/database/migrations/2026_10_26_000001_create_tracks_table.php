<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The shared music library: one row per audio file, visible to every signed-in account (not tied to a campaign). The file itself lives on the
        // private disk under music/<hash>.<ext>; the same bytes uploaded twice are one row. The uploader keeps the track if their account is deleted.
        Schema::create('tracks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 190);
            $table->char('hash', 64)->unique(); // sha256 of the file
            $table->string('path', 120);
            $table->string('mime', 100);
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracks');
    }
};
