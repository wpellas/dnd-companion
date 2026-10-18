<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** A disabled account is signed out on its next request, wherever it was signed in. */
class EnsureActive
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->user()?->disabled_at) {
            Auth::guard('web')->logout();
            abort(401);
        }

        return $next($request);
    }
}
