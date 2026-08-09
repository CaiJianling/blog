<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::prefix('articles')->group(function () {
        Route::get('/', [\App\Http\Controllers\ArticleController::class, 'index'])->name('articles.index');
        Route::get('/create', [\App\Http\Controllers\ArticleController::class, 'create'])->name('articles.create');
        Route::post('/', [\App\Http\Controllers\ArticleController::class, 'store'])->name('articles.store');
        Route::post('/batch', [\App\Http\Controllers\ArticleController::class, 'batchUpdate'])->name('articles.batch');
        Route::get('/{article}/edit', [\App\Http\Controllers\ArticleController::class, 'edit'])->name('articles.edit');
        Route::put('/{article}', [\App\Http\Controllers\ArticleController::class, 'update'])->name('articles.update');
        Route::put('/{article}/trash', [\App\Http\Controllers\ArticleController::class, 'trash'])->name('articles.trash');
        Route::put('/{article}/restore', [\App\Http\Controllers\ArticleController::class, 'restore'])->name('articles.restore');
        Route::get('/categories', [\App\Http\Controllers\ArticleController::class, 'categories'])->name('articles.categories');
        Route::get('/tags', [\App\Http\Controllers\ArticleController::class, 'tags'])->name('articles.tags');
    });

    Route::middleware([\App\Http\Middleware\AdminMiddleware::class])->group(function () {
        Route::resource('users', \App\Http\Controllers\UserController::class)->names([
            'index' => 'users.index',
            'create' => 'users.create',
            'store' => 'users.store',
            'edit' => 'users.edit',
            'update' => 'users.update',
            'destroy' => 'users.destroy',
        ]);
        Route::put('users/{user}/toggle-status', [\App\Http\Controllers\UserController::class, 'toggleStatus'])->name('users.toggle-status');
    });
});

require __DIR__.'/settings.php';
