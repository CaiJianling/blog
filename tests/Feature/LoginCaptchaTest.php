<?php

use App\Models\Article;
use App\Models\Comment;
use App\Models\Option;
use App\Models\User;
use App\Services\CaptchaService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->user = User::factory()->create([
        'email' => 'captcha-user@example.com',
        'password' => Hash::make('secret1234'),
    ]);

    // 图形字符流程的用例统一显式使用 image（默认方式是 math）
    Option::set('login_captcha_type', 'image');
});

/** 在会话中预置一个已知答案的图形验证码（scope 可选 login/comment；expiresDeltaMinutes 为负表示已过期）。 */
function seedImageCaptcha(string $scope, string $code, int $expiresDeltaMinutes = 5): void
{
    session()->put('captcha_'.$scope, [
        'hash' => hash('sha256', strtolower($code)),
        'expires' => now()->addMinutes($expiresDeltaMinutes)->timestamp,
    ]);
}

test('captcha endpoint returns 404 when disabled', function () {
    Option::set('login_captcha_enabled', '0');

    $this->get(route('captcha.show'))
        ->assertNotFound();
});

test('login page reflects the captcha enabled flag', function () {
    Option::set('login_captcha_enabled', '1');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('captchaEnabled', true));

    Option::set('login_captcha_enabled', '0');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('captchaEnabled', false));
});

test('captcha endpoint returns png and stores the answer when enabled', function () {
    Option::set('login_captcha_enabled', '1');
    Option::set('login_captcha_complexity', 'medium');

    $response = $this->get(route('captcha.show'));

    $response->assertOk()
        ->assertHeader('Content-Type', 'image/png');

    $bytes = $response->getContent();

    expect(str_starts_with((string) $bytes, "\x89PNG"))->toBeTrue()
        ->and(session('captcha_login.hash'))->not->toBeNull()
        ->and(session('captcha_login.expires'))->toBeGreaterThan(now()->timestamp);
});

test('login proceeds without captcha when the feature is disabled', function () {
    Option::set('login_captcha_enabled', '0');

    $this->post(route('login'), ['email' => '', 'password' => ''])
        ->assertSessionHasErrors(['email'])
        ->assertSessionDoesntHaveErrors(['captcha']);
});

test('login requires the captcha when enabled', function () {
    Option::set('login_captcha_enabled', '1');

    $this->post(route('login'), ['email' => 'someone@example.com', 'password' => 'whatever'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('login rejects a wrong captcha', function () {
    Option::set('login_captcha_enabled', '1');
    seedImageCaptcha('login', 'abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'zzz12'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('correct captcha passes but credentials are still validated', function () {
    Option::set('login_captcha_enabled', '1');
    seedImageCaptcha('login', 'abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'wrong-pass', 'captcha' => 'ABCD7'])
        ->assertSessionDoesntHaveErrors(['captcha'])
        ->assertSessionHasErrors(['email']);
});

test('correct captcha and credentials log the user in', function () {
    Option::set('login_captcha_enabled', '1');
    seedImageCaptcha('login', 'abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'ABCD7'])
        ->assertRedirect();

    $this->assertAuthenticatedAs($this->user);
});

test('captcha is consumed per attempt and cannot be replayed', function () {
    Option::set('login_captcha_enabled', '1');
    seedImageCaptcha('login', 'abcd7');

    // 第一次：验证码正确但密码错误（验证码被消费）
    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'wrong-pass', 'captcha' => 'abcd7'])
        ->assertSessionDoesntHaveErrors(['captcha']);

    // 第二次：重放同一验证码 → 失败
    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'abcd7'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('expired captcha fails even with the right answer', function () {
    Option::set('login_captcha_enabled', '1');
    seedImageCaptcha('login', 'abcd7', -1);

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'abcd7'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('captcha service builds codes with per-complexity length and charset', function () {
    $service = new CaptchaService;

    expect(strlen($service->buildCode('easy')))->toBe(4)
        ->and(strlen($service->buildCode('medium')))->toBe(4)
        ->and(strlen($service->buildCode('hard')))->toBe(5)
        ->and($service->buildCode('hard'))
        ->toMatch('/^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ]{5}$/')
        // 非法复杂程度回退 medium（4 位）
        ->and(strlen($service->buildCode('bogus')))->toBe(4);
});

test('captcha service generates a valid png with a session answer', function () {
    Option::set('login_captcha_complexity', 'hard');

    $bytes = (new CaptchaService)->generate();

    expect(str_starts_with($bytes, "\x89PNG"))->toBeTrue()
        ->and(session('captcha_login.hash'))->not->toBeNull();
});

test('admin can toggle login captcha and complexity in site settings', function () {
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_tagline' => 'A blog',
            'seo_description' => 'desc',
            'seo_keywords' => 'kw',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'membership' => '0',
            'login_captcha_enabled' => '1',
            'login_captcha_complexity' => 'hard',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ])
        ->assertRedirect(route('site.edit'));

    expect(Option::get('login_captcha_enabled'))->toBe('1')
        ->and(Option::get('login_captcha_complexity'))->toBe('hard');
});

test('invalid captcha complexity falls back to medium when saving site settings', function () {
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'login_captcha_enabled' => '1',
            'login_captcha_complexity' => 'extreme',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ])
        ->assertRedirect(route('site.edit'));

    expect(Option::get('login_captcha_complexity'))->toBe(CaptchaService::COMPLEXITY_MEDIUM);
});

test('captcha types default to simple math for both login and comment', function () {
    // 未配置时（空值）回退 math；beforeEach 设置的 image 在此清除
    Option::set('login_captcha_type', '');
    $service = new CaptchaService;

    expect($service->loginType())->toBe(CaptchaService::TYPE_MATH)
        ->and($service->commentType())->toBe(CaptchaService::TYPE_MATH);
});

test('login math captcha is the default and verifies via token', function () {
    // 默认方式即 math（beforeEach 里的 image 显式覆盖，这里改回默认）
    Option::set('login_captcha_type', CaptchaService::TYPE_MATH);
    Option::set('login_captcha_enabled', '1');

    $captcha = (new CaptchaService)->loginCaptchaProps();
    $answer = Crypt::decrypt($captcha['token'])['answer'];

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captcha.type', 'math')
            ->has('captcha.question')
            ->has('captcha.token'),
        );

    $this->post(route('login'), [
        'email' => $this->user->email,
        'password' => 'secret1234',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $answer,
    ])->assertRedirect();

    $this->assertAuthenticatedAs($this->user);
});

test('login math captcha token is one-time and cannot be replayed', function () {
    Option::set('login_captcha_type', CaptchaService::TYPE_MATH);
    Option::set('login_captcha_enabled', '1');

    $captcha = (new CaptchaService)->loginCaptchaProps();
    $answer = Crypt::decrypt($captcha['token'])['answer'];

    // 第一次：验证码正确但密码错误（token 被消费）
    $this->post(route('login'), [
        'email' => $this->user->email,
        'password' => 'wrong-pass',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $answer,
    ])->assertSessionDoesntHaveErrors(['captcha']);

    // 第二次：重放同一 token + 答案 → 失败
    $this->post(route('login'), [
        'email' => $this->user->email,
        'password' => 'secret1234',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $answer,
    ])->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('login image_math captcha renders arithmetic image and verifies the numeric answer', function () {
    Option::set('login_captcha_type', CaptchaService::TYPE_IMAGE_MATH);
    Option::set('login_captcha_enabled', '1');

    $this->get(route('captcha.show'))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png');

    seedImageCaptcha('login', '15');

    $this->post(route('login'), [
        'email' => $this->user->email,
        'password' => 'secret1234',
        'captcha' => '15',
    ])->assertRedirect();

    $this->assertAuthenticatedAs($this->user);
});

test('comment captcha endpoint serves image per type and 404s for math', function () {
    Option::set('comment_captcha_type', CaptchaService::TYPE_MATH);

    $this->get(route('captcha.comment'))->assertNotFound();

    Option::set('comment_captcha_type', CaptchaService::TYPE_IMAGE);

    $this->get(route('captcha.comment'))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png');

    expect(session('captcha_comment.hash'))->not->toBeNull();
});

test('guest comment can use image captcha', function () {
    Option::set('comment_captcha_type', CaptchaService::TYPE_IMAGE);
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $article = Article::create([
        'author_id' => $admin->id,
        'title' => 'Captcha Comment Post',
        'slug' => 'captcha-comment-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    seedImageCaptcha('comment', 'ab12cd');

    $this->post(route('comments.public.store'), [
        'object_id' => $article->id,
        'content' => '图形验证码评论',
        'author_name' => '访客',
        'author_email' => 'guest@example.com',
        'captcha_answer' => 'AB12CD',
    ])->assertRedirect();

    expect(Comment::where('object_id', $article->id)->where('content', '图形验证码评论')->exists())->toBeTrue();
});

test('guest comment with wrong image captcha is rejected', function () {
    Option::set('comment_captcha_type', CaptchaService::TYPE_IMAGE);
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $article = Article::create([
        'author_id' => $admin->id,
        'title' => 'Captcha Wrong Post',
        'slug' => 'captcha-wrong-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    seedImageCaptcha('comment', 'ab12cd');

    $this->post(route('comments.public.store'), [
        'object_id' => $article->id,
        'content' => '错误验证码评论',
        'author_name' => '访客',
        'author_email' => 'guest@example.com',
        'captcha_answer' => 'zzzzzz',
    ])->assertSessionHasErrors(['message']);

    expect(Comment::where('content', '错误验证码评论')->exists())->toBeFalse();
});

test('article page passes typed captcha props to guests', function () {
    Option::set('comment_captcha_type', CaptchaService::TYPE_IMAGE);
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $article = Article::create([
        'author_id' => $admin->id,
        'title' => 'Typed Captcha Post',
        'slug' => 'typed-captcha-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    $this->get('/blog/'.$article->slug)
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captcha.type', 'image')
            ->where('captcha.src', '/comment-captcha'),
        );
});

test('site settings save captcha types with defaults', function () {
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($admin)->put(route('site.update'), [
        'site_title' => 'My Blog',
        'site_icon' => '',
        'cms_url' => 'https://example.com/admin',
        'site_url' => 'https://example.com',
        'admin_email' => 'admin@example.com',
        'login_captcha_enabled' => '1',
        'login_captcha_type' => 'image_math',
        'login_captcha_complexity' => 'hard',
        'comment_captcha_type' => 'image',
        'default_role' => 'author',
        'site_language' => 'en',
        'timezone' => 'Asia/Shanghai',
        'date_format' => 'Y-m-d',
        'time_format' => 'H:i',
        'start_of_week' => '0',
    ])->assertRedirect(route('site.edit'));

    expect(Option::get('login_captcha_type'))->toBe('image_math')
        ->and(Option::get('comment_captcha_type'))->toBe('image');
});
