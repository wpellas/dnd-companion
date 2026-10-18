<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // the reset link opens the single-page app (hash routing), which then posts to /api/reset-password
        ResetPassword::createUrlUsing(fn ($user, string $token) => config('app.url').'/#reset?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}
