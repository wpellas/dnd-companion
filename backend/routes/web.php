<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CampaignController;
use App\Http\Controllers\LiveController;
use App\Http\Controllers\RollController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

// The built single-page app (`pnpm build` puts it in public/). Its scripts and styles are plain static files.
Route::get('/', fn () => response()->file(public_path('index.html'), ['Cache-Control' => 'no-cache']));

// JSON API for the single-page app. It lives here (not in api.php) so it gets the session cookie and CSRF protection.
Route::prefix('api')->group(function () {
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
        Route::post('forgot-password', [AuthController::class, 'forgot']);
        Route::post('reset-password', [AuthController::class, 'reset']);
        Route::post('confirm-email', [AuthController::class, 'confirmEmail']);
    });

    // the table screen polls every second or two, so this one gets a roomier limit
    Route::middleware('throttle:240,1')->get('table/{token}/live', [LiveController::class, 'table']);

    Route::middleware(['auth', 'active'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::middleware('throttle:10,1')->group(function () {
            Route::patch('me/password', [AuthController::class, 'changePassword']);
            Route::patch('me/email', [AuthController::class, 'changeEmail']);
        });

        Route::get('campaigns', [CampaignController::class, 'index']);
        Route::post('campaigns', [CampaignController::class, 'store']);
        Route::post('campaigns/join', [CampaignController::class, 'join']);
        Route::get('campaigns/{campaign}', [CampaignController::class, 'show']);
        Route::patch('campaigns/{campaign}', [CampaignController::class, 'update']);
        Route::delete('campaigns/{campaign}', [CampaignController::class, 'destroy']);
        Route::post('campaigns/{campaign}/invites', [CampaignController::class, 'invite']);
        Route::delete('campaigns/{campaign}/members/{user}', [CampaignController::class, 'removeMember']);

        Route::get('campaigns/{campaign}/live', [LiveController::class, 'pull']);
        Route::post('campaigns/{campaign}/live', [LiveController::class, 'push']);
        Route::post('campaigns/{campaign}/live-link', [LiveController::class, 'newLink']);
        Route::post('campaigns/{campaign}/rolls', [RollController::class, 'store']);
        Route::delete('campaigns/{campaign}/rolls/{roll}', [RollController::class, 'destroy']);
        Route::get('campaigns/{campaign}/sync', [SyncController::class, 'pull']);
        Route::post('campaigns/{campaign}/sync', [SyncController::class, 'push']);
        Route::post('campaigns/{campaign}/sync/prune', [SyncController::class, 'prune']);

        Route::middleware('admin')->prefix('admin')->group(function () {
            Route::get('invites', [AdminController::class, 'invites']);
            Route::post('invites', [AdminController::class, 'invite']);
            Route::delete('invites/{invite}', [AdminController::class, 'revokeInvite']);
            Route::get('users', [AdminController::class, 'users']);
            Route::patch('users/{user}', [AdminController::class, 'updateUser']);
            Route::post('users/{user}/reset-link', [AdminController::class, 'resetLink']);
            Route::delete('users/{user}', [AdminController::class, 'deleteUser']);
            Route::get('log', [AdminController::class, 'auditLog']);
            Route::get('campaigns', [AdminController::class, 'campaigns']);
            Route::delete('campaigns/{campaign}', [AdminController::class, 'deleteCampaign']);
        });
    });
});
