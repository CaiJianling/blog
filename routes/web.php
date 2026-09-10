<?php

use App\Http\Controllers\ArticleController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommentPublicController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\NavController;
use App\Http\Controllers\OptionController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\PermalinkController;
use App\Http\Controllers\SmileyController;
use App\Http\Controllers\TermTaxonomyController;
use App\Http\Controllers\ToolController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\AdminMiddleware;
use Illuminate\Support\Facades\Route;

// 公开页面
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/blog', [BlogController::class, 'index'])->name('blog.index');
Route::get('/blog/{article:slug}', [BlogController::class, 'show'])->name('blog.show');
Route::post('/comments', [CommentPublicController::class, 'store'])->name('comments.public.store');
Route::get('/tools', [ToolController::class, 'index'])->name('tools.index');
Route::get('/tools/{slug}', [ToolController::class, 'show'])->name('tools.show');
Route::get('/nav', [NavController::class, 'index'])->name('nav.index');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::prefix('articles')->group(function () {
        Route::get('/', [ArticleController::class, 'index'])->name('articles.index');
        Route::get('/create', [ArticleController::class, 'create'])->name('articles.create');
        Route::post('/', [ArticleController::class, 'store'])->name('articles.store');
        Route::post('/batch', [ArticleController::class, 'batchUpdate'])->name('articles.batch');
        Route::get('/{article}/edit', [ArticleController::class, 'edit'])->name('articles.edit');
        Route::put('/{article}', [ArticleController::class, 'update'])->name('articles.update');
        Route::put('/{article}/trash', [ArticleController::class, 'trash'])->name('articles.trash');
        Route::put('/{article}/restore', [ArticleController::class, 'restore'])->name('articles.restore');
        Route::delete('/{article}', [ArticleController::class, 'destroy'])->name('articles.destroy');
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
        Route::delete('/{page}', [PageController::class, 'destroy'])->name('pages.destroy');
    });

    Route::prefix('attachments')->group(function () {
        Route::get('/', [AttachmentController::class, 'index'])->name('attachments.index');
        Route::get('/create', [AttachmentController::class, 'create'])->name('attachments.create');
        Route::post('/', [AttachmentController::class, 'store'])->name('attachments.store');
        Route::delete('/bulk', [AttachmentController::class, 'bulkDestroy'])->name('attachments.bulk-destroy');
        Route::delete('/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');
    });

    Route::prefix('comments')->group(function () {
        Route::get('/', [CommentController::class, 'index'])->name('comments.index');
        Route::post('/batch', [CommentController::class, 'batchUpdate'])->name('comments.batch');
        Route::put('/{comment}/approve', [CommentController::class, 'approve'])->name('comments.approve');
        Route::put('/{comment}/reject', [CommentController::class, 'reject'])->name('comments.reject');
        Route::put('/{comment}/spam', [CommentController::class, 'spam'])->name('comments.spam');
        Route::put('/{comment}/trash', [CommentController::class, 'trash'])->name('comments.trash');
        Route::put('/{comment}/restore', [CommentController::class, 'restore'])->name('comments.restore');
        Route::delete('/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');
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

        Route::get('settings/site', [OptionController::class, 'edit'])->name('site.edit');
        Route::put('settings/site', [OptionController::class, 'update'])->name('site.update');
        Route::post('settings/site/site-icon', [OptionController::class, 'uploadSiteIcon'])->name('site.site-icon.store');
        Route::delete('settings/site/site-icon', [OptionController::class, 'removeSiteIcon'])->name('site.site-icon.destroy');

        Route::get('settings/permalink', [PermalinkController::class, 'edit'])->name('permalink.edit');
        Route::put('settings/permalink', [PermalinkController::class, 'update'])->name('permalink.update');

        Route::get('smilies', [SmileyController::class, 'index'])->name('smilies.index');
        Route::post('smiley-groups', [SmileyController::class, 'storeGroup'])->name('smilies.groups.store');
        Route::put('smiley-groups/{group}', [SmileyController::class, 'updateGroup'])->name('smilies.groups.update');
        Route::delete('smiley-groups/{group}', [SmileyController::class, 'destroyGroup'])->name('smilies.groups.destroy');
        Route::post('smileys', [SmileyController::class, 'storeSmiley'])->name('smileys.store');
        Route::delete('smileys/{smiley}', [SmileyController::class, 'destroySmiley'])->name('smileys.destroy');

        Route::get('menus', [MenuController::class, 'index'])->name('menus.index');
        Route::post('menus', [MenuController::class, 'store'])->name('menus.store');
        Route::put('menus/{menu}', [MenuController::class, 'update'])->name('menus.update');
        Route::delete('menus/{menu}', [MenuController::class, 'destroy'])->name('menus.destroy');
    });
});

require __DIR__.'/settings.php';

// 按固定链接结构在站点根路径解析文章，必须注册在所有具体路由之后
Route::get('/{permalink}', [BlogController::class, 'permalink'])
    ->where('permalink', '(?!api/|build/|storage/|vendor/).*')
    ->name('blog.permalink');
