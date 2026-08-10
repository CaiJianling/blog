<?php

use App\Http\Controllers\ArticleController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\TermTaxonomyController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\AdminMiddleware;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::prefix('articles')->group(function () {
        Route::get('/', [ArticleController::class, 'index'])->name('articles.index');
        Route::get('/create', [ArticleController::class, 'create'])->name('articles.create');
        Route::post('/', [ArticleController::class, 'store'])->name('articles.store');
        Route::post('/batch', [ArticleController::class, 'batchUpdate'])->name('articles.batch');
        Route::get('/{article}/edit', [ArticleController::class, 'edit'])->name('articles.edit');
        Route::put('/{article}', [ArticleController::class, 'update'])->name('articles.update');
        Route::put('/{article}/trash', [ArticleController::class, 'trash'])->name('articles.trash');
        Route::put('/{article}/restore', [ArticleController::class, 'restore'])->name('articles.restore');
        Route::get('/categories', [ArticleController::class, 'categories'])->name('articles.categories');
        Route::get('/tags', [ArticleController::class, 'tags'])->name('articles.tags');
        Route::post('/taxonomies', [TermTaxonomyController::class, 'store'])->name('taxonomies.store');
        Route::put('/taxonomies/{termTaxonomy}', [TermTaxonomyController::class, 'update'])->name('taxonomies.update');
        Route::delete('/taxonomies/{termTaxonomy}', [TermTaxonomyController::class, 'destroy'])->name('taxonomies.destroy');
    });

    Route::prefix('pages')->group(function () {
        Route::get('/', [PageController::class, 'index'])->name('pages.index');
        Route::get('/create', [PageController::class, 'create'])->name('pages.create');
        Route::post('/', [PageController::class, 'store'])->name('pages.store');
        Route::post('/batch', [PageController::class, 'batchUpdate'])->name('pages.batch');
        Route::get('/{page}/edit', [PageController::class, 'edit'])->name('pages.edit');
        Route::put('/{page}', [PageController::class, 'update'])->name('pages.update');
        Route::put('/{page}/trash', [PageController::class, 'trash'])->name('pages.trash');
        Route::put('/{page}/restore', [PageController::class, 'restore'])->name('pages.restore');
    });

    Route::prefix('attachments')->group(function () {
        Route::get('/', [AttachmentController::class, 'index'])->name('attachments.index');
        Route::get('/create', [AttachmentController::class, 'create'])->name('attachments.create');
        Route::post('/', [AttachmentController::class, 'store'])->name('attachments.store');
        Route::delete('/bulk', [AttachmentController::class, 'bulkDestroy'])->name('attachments.bulk-destroy');
        Route::delete('/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');
    });

    Route::middleware([AdminMiddleware::class])->group(function () {
        Route::resource('users', UserController::class)->names([
            'index' => 'users.index',
            'create' => 'users.create',
            'store' => 'users.store',
            'edit' => 'users.edit',
            'update' => 'users.update',
            'destroy' => 'users.destroy',
        ]);
        Route::put('users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    });
});

require __DIR__.'/settings.php';
