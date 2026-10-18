<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An e-mail change waits here until the link sent to the new address is opened. One per user: asking again replaces it.
        Schema::create('email_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('new_email', 190);
            $table->string('token', 64); // sha256 of the secret in the link, so a database leak does not hand out working links
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_changes');
    }
};
