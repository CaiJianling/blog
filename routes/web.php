<?php

use App\Http\Controllers\AiSettingController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\ArticleController;
use App\Http\Controllers\ArticleLikeController;
use App\Http\Controllers\AssistantChatController;
use App\Http\Controllers\AssistantSettingController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CaptchaController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommentPublicController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FooterSettingController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\HomeSettingController;
use App\Http\Controllers\LinksController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\MomentController;
use App\Http\Controllers\MomentsController;
use App\Http\Controllers\NavController;
use App\Http\Controllers\NavigationSettingController;
use App\Http\Controllers\OptionController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\PermalinkController;
use App\Http\Controllers\SidebarSettingController;
use App\Http\Controllers\SmileyController;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\TermTaxonomyController;
use App\Http\Controllers\ThemeSettingController;
use App\Http\Controllers\ToolController;
use App\Http\Controllers\ToolSettingController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\AdminMiddleware;
use Illuminate\Support\Facades\Route;

// 公开页面（GET 页面走访问跟踪，供后台「站点统计」使用）
Route::middleware('track.pageviews')->group(function () {
    Route::get('/', [HomeController::class, 'index'])->name('home');
    Route::get('/blog', [BlogController::class, 'index'])->name('blog.index');
    Route::get('/blog/{article:slug}', [BlogController::class, 'show'])->name('blog.show');
    Route::get('/moments', [MomentController::class, 'index'])->name('moments.index');
    Route::get('/moments/{moment}', [MomentController::class, 'show'])->name('moments.show');
    Route::get('/archive', [ArchiveController::class, 'index'])->name('archive.index');
    Route::get('/tools', [ToolController::class, 'index'])->name('tools.index');
    Route::get('/tools/{slug}', [ToolController::class, 'show'])->name('tools.show');
    Route::get('/nav', [NavController::class, 'index'])->name('nav.index');
    Route::get('/nav/links/{link}', [NavController::class, 'show'])->name('nav.show');
    Route::get('/links', [LinksController::class, 'index'])->name('links.index');
});

// RSS 订阅（不做访问跟踪）
Route::get('/feed', [FeedController::class, 'index'])->name('feed');

Route::post('/comments', [CommentPublicController::class, 'store'])->name('comments.public.store');
Route::put('/comments/{comment}', [CommentPublicController::class, 'update'])->name('comments.public.update');
Route::post('/tools/hash', [ToolController::class, 'hash'])->middleware('throttle:60,1')->name('tools.hash');

// 文章点赞（前台游客可用，按 IP 限流）
Route::post('/articles/{article}/like', [ArticleLikeController::class, '__invoke'])
    ->middleware('throttle:30,1')
    ->name('articles.like');

// AI 小助手对话（前台游客可用，按 IP 限流）
Route::post('/assistant/chat', [AssistantChatController::class, 'store'])
    ->middleware('throttle:20,1')
    ->name('assistant.chat');

// 登录图形验证码图片（未开启或简单计算方式时 404，按 IP 限流）
Route::get('/captcha', [CaptchaController::class, 'show'])
    ->middleware('throttle:30,1')
    ->name('captcha.show');

// 评论图形验证码图片（简单计算方式时 404，按 IP 限流）
Route::get('/comment-captcha', [CaptchaController::class, 'commentShow'])
    ->middleware('throttle:30,1')
    ->name('captcha.comment');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::prefix('articles')->group(function () {
        Route::get('/', [ArticleController::class, 'index'])->name('articles.index');
        Route::get('/create', [ArticleController::class, 'create'])->name('articles.create');
        Route::post('/', [ArticleController::class, 'store'])->name('articles.store');
        Route::post('/ai-generate', [ArticleController::class, 'aiGenerate'])->name('articles.ai-generate');
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

    // 说说管理（articles 表 post_type=moment；前台展示走 /moments，管理走 /moments-admin 避免路由冲突）
    Route::prefix('moments-admin')->group(function () {
        Route::get('/', [MomentsController::class, 'index'])->name('moments.admin.index');
        Route::get('/create', [MomentsController::class, 'create'])->name('moments.admin.create');
        Route::post('/', [MomentsController::class, 'store'])->name('moments.admin.store');
        Route::post('/batch', [MomentsController::class, 'batchUpdate'])->name('moments.admin.batch');
        Route::get('/{moment}/edit', [MomentsController::class, 'edit'])->name('moments.admin.edit');
        Route::put('/{moment}', [MomentsController::class, 'update'])->name('moments.admin.update');
        Route::put('/{moment}/trash', [MomentsController::class, 'trash'])->name('moments.admin.trash');
        Route::put('/{moment}/restore', [MomentsController::class, 'restore'])->name('moments.admin.restore');
        Route::delete('/{moment}', [MomentsController::class, 'destroy'])->name('moments.admin.destroy');
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
        Route::put('/{comment}/update', [CommentController::class, 'update'])->name('comments.update');
        Route::put('/{comment}/approve-edit', [CommentController::class, 'approveEdit'])->name('comments.approve-edit');
        Route::put('/{comment}/reject-edit', [CommentController::class, 'rejectEdit'])->name('comments.reject-edit');
        Route::delete('/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');
    });

    Route::middleware([AdminMiddleware::class])->group(function () {
        // 站点统计（访问趋势、流量来源、用户画像、访问途径）
        Route::get('site-stats', [StatsController::class, 'index'])->name('stats.index');

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

        // 主题设置（站点主色 + 前台网页背景）
        Route::get('settings/theme', [ThemeSettingController::class, 'edit'])->name('theme.edit');
        Route::put('settings/theme', [ThemeSettingController::class, 'update'])->name('theme.update');
        Route::post('settings/theme/background', [ThemeSettingController::class, 'uploadBackground'])->name('theme.background.store');
        Route::delete('settings/theme/background', [ThemeSettingController::class, 'destroyBackground'])->name('theme.background.destroy');

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

        // 导航页内容管理（分类、链接、图文介绍）
        Route::get('settings/navigation', [NavigationSettingController::class, 'edit'])->name('navigation.edit');
        Route::put('settings/navigation/reorder', [NavigationSettingController::class, 'reorder'])->name('navigation.reorder');
        Route::post('settings/navigation/categories', [NavigationSettingController::class, 'storeCategory'])->name('navigation.categories.store');
        Route::put('settings/navigation/categories/{category}', [NavigationSettingController::class, 'updateCategory'])->name('navigation.categories.update');
        Route::delete('settings/navigation/categories/{category}', [NavigationSettingController::class, 'destroyCategory'])->name('navigation.categories.destroy');
        Route::get('settings/navigation/links/{link}/intro', [NavigationSettingController::class, 'editIntro'])->name('navigation.links.intro');
        Route::put('settings/navigation/links/{link}/intro', [NavigationSettingController::class, 'updateIntro'])->name('navigation.links.intro.update');
        Route::post('settings/navigation/links/{link}/icon', [NavigationSettingController::class, 'uploadLinkIcon'])->name('navigation.links.icon');
        Route::delete('settings/navigation/links/{link}/icon', [NavigationSettingController::class, 'resetLinkIcon'])->name('navigation.links.icon.reset');
        Route::post('settings/navigation/links', [NavigationSettingController::class, 'storeLink'])->name('navigation.links.store');
        Route::put('settings/navigation/links/{link}', [NavigationSettingController::class, 'updateLink'])->name('navigation.links.update');
        Route::delete('settings/navigation/links/{link}', [NavigationSettingController::class, 'destroyLink'])->name('navigation.links.destroy');

        // AI 设置
        Route::get('settings/ai', [AiSettingController::class, 'edit'])->name('ai.edit');
        Route::put('settings/ai', [AiSettingController::class, 'update'])->name('ai.update');
        Route::get('settings/ai/models', [AiSettingController::class, 'models'])->name('ai.models');

        // 工具页内容管理（分组、工具、排序、链接地址）
        Route::get('settings/tools', [ToolSettingController::class, 'edit'])->name('tools.admin');
        Route::put('settings/tools/reorder', [ToolSettingController::class, 'reorder'])->name('tools.reorder');
        Route::post('settings/tools/categories', [ToolSettingController::class, 'storeCategory'])->name('tools.categories.store');
        Route::put('settings/tools/categories/{category}', [ToolSettingController::class, 'updateCategory'])->name('tools.categories.update');
        Route::delete('settings/tools/categories/{category}', [ToolSettingController::class, 'destroyCategory'])->name('tools.categories.destroy');
        Route::post('settings/tools/items', [ToolSettingController::class, 'storeTool'])->name('tools.items.store');
        Route::put('settings/tools/items/{tool}', [ToolSettingController::class, 'updateTool'])->name('tools.items.update');
        Route::delete('settings/tools/items/{tool}', [ToolSettingController::class, 'destroyTool'])->name('tools.items.destroy');

        // 友情链接管理（友链、排序、图片）
        Route::get('settings/links', [LinksController::class, 'edit'])->name('links.admin');
        Route::put('settings/links/reorder', [LinksController::class, 'reorder'])->name('links.reorder');
        Route::post('settings/links', [LinksController::class, 'store'])->name('links.store');
        Route::put('settings/links/{link}', [LinksController::class, 'update'])->name('links.update');
        Route::delete('settings/links/{link}', [LinksController::class, 'destroy'])->name('links.destroy');
        Route::post('settings/links/{link}/image', [LinksController::class, 'uploadImage'])->name('links.image.store');
        Route::delete('settings/links/{link}/image', [LinksController::class, 'removeImage'])->name('links.image.destroy');

        // AI 小助手设置（页面合并进 settings/ai，仅保留保存与头像接口）
        Route::put('settings/assistant', [AssistantSettingController::class, 'update'])->name('assistant.update');
        Route::post('settings/assistant/avatar', [AssistantSettingController::class, 'uploadAvatar'])->name('assistant.avatar.store');
        Route::delete('settings/assistant/avatar', [AssistantSettingController::class, 'removeAvatar'])->name('assistant.avatar.destroy');
        Route::get('settings/assistant', fn () => to_route('settings/ai'))->name('assistant.edit');

        // 博客侧边栏设置（博主信息、自定义菜单）
        Route::put('settings/sidebar', [SidebarSettingController::class, 'update'])->name('sidebar.update');
        Route::get('settings/sidebar', fn () => to_route('home.edit'))->name('sidebar.edit');
        Route::post('settings/sidebar/avatar', [SidebarSettingController::class, 'uploadAvatar'])->name('sidebar.avatar.store');
        Route::delete('settings/sidebar/avatar', [SidebarSettingController::class, 'removeAvatar'])->name('sidebar.avatar.destroy');

        // 首页文案设置
        Route::get('settings/home', [HomeSettingController::class, 'edit'])->name('home.edit');
        Route::put('settings/home', [HomeSettingController::class, 'update'])->name('home.update');

        // 页脚设置（资源、联系）
        Route::put('settings/footer', [FooterSettingController::class, 'update'])->name('footer.update');
        Route::get('settings/footer', fn () => to_route('home.edit'))->name('footer.edit');
    });
});

require __DIR__.'/settings.php';

// 按固定链接结构在站点根路径解析文章，必须注册在所有具体路由之后
Route::get('/{permalink}', [BlogController::class, 'permalink'])
    ->where('permalink', '(?!api/|build/|storage/|vendor/).*')
    ->middleware('track.pageviews')
    ->name('blog.permalink');
