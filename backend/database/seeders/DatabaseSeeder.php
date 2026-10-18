<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Creates the administrator from ADMIN_EMAIL / ADMIN_PASSWORD (a no-op if that account exists). */
    public function run(): void
    {
        $email = config('app.admin_email');
        $password = config('app.admin_password');
        if (! $email || ! $password) {
            return;
        }
        $admin = User::firstOrCreate(['email' => $email], ['name' => 'Administrator', 'password' => $password]);
        $admin->forceFill(['is_admin' => true])->save();
    }
}
