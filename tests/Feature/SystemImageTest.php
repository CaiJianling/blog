<?php

use App\Models\Article;
use App\Models\Attachment;
use App\Models\NavCategory;
use App\Models\NavLink;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    Storage::fake('public');

    // 清空迁移预置的导航数据，避免索引断言受影响
    NavLink::query()->delete();
    NavCategory::query()->delete();

    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

function uploadNavIcon($testCase, NavLink $link, string $name = 'icon.png')
{
    return $testCase->actingAs($testCase->admin)
        ->postJson(route('navigation.links.icon', $link), [
            'file' => UploadedFile::fake()->image($name, 64, 64),
        ]);
}

test('admin can upload nav link icon and it replaces the old one', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);

    uploadNavIcon($this, $link)->assertOk()->assertJsonStructure(['id', 'url']);

    expect(Attachment::where('parent_type', 'nav_link_icon')->where('parent_id', $link->id)->count())->toBe(1);

    $firstId = Attachment::first()->id;
    $firstPath = Attachment::first()->file_path;

    // 再次上传：旧图标必须从文件库删除
    uploadNavIcon($this, $link, 'icon2.png')->assertOk();

    expect(Attachment::where('parent_type', 'nav_link_icon')->where('parent_id', $link->id)->count())->toBe(1)
        ->and(Attachment::find($firstId))->toBeNull()
        ->and(Storage::disk('public')->exists($firstPath))->toBeFalse();
});

test('nav link icon can be reset to default and file is removed', function () {
    $link = NavLink::factory()->create();

    uploadNavIcon($this, $link);

    $path = Attachment::first()->file_path;

    $this->actingAs($this->admin)
        ->deleteJson(route('navigation.links.icon.reset', $link))
        ->assertOk();

    expect(Attachment::count())->toBe(0)
        ->and(Storage::disk('public')->exists($path))->toBeFalse();
});

test('public nav payload includes icon url', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);

    uploadNavIcon($this, $link);

    $this->get(route('nav.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('navigationCategories.0.links.0.icon_url', fn ($url) => is_string($url) && str_contains($url, '/storage/')),
        );
});

test('user can upload avatar and blog uses it as author avatar', function () {
    $this->actingAs($this->regular)
        ->postJson(route('profile.avatar.store'), [
            'file' => UploadedFile::fake()->image('me.png', 100, 100),
        ])
        ->assertOk();

    $attachment = Attachment::where('parent_type', 'user_avatar')->where('parent_id', $this->regular->id)->first();

    expect($attachment)->not->toBeNull()
        ->and($this->regular->avatarUrl())->toContain('/storage/');

    $article = Article::create([
        'author_id' => $this->regular->id,
        'title' => '带头像的文章',
        'slug' => 'with-avatar',
        'excerpt' => '摘要',
        'content' => [],
        'status' => 'publish',
    ]);

    $this->get("/{$article->id}.html")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('article.author_avatar', $this->regular->avatarUrl()),
        );
});

test('restoring default avatar deletes the file', function () {
    $this->actingAs($this->regular)
        ->postJson(route('profile.avatar.store'), [
            'file' => UploadedFile::fake()->image('me.png'),
        ]);

    $path = Attachment::first()->file_path;

    $this->actingAs($this->regular)
        ->deleteJson(route('profile.avatar.destroy'))
        ->assertRedirect();

    expect(Attachment::count())->toBe(0)
        ->and(Storage::disk('public')->exists($path))->toBeFalse()
        ->and($this->regular->avatarUrl())->toBeNull();
});

test('non-admin media library hides system images', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);
    uploadNavIcon($this->actingAs($this->admin), $link);

    // 普通文件（无 parent_type）
    $normal = Attachment::create([
        'author_id' => $this->admin->id,
        'file_name' => 'normal.png',
        'file_path' => 'uploads/2026/01/normal.png',
        'mime_type' => 'image/png',
        'file_size' => 100,
    ]);

    $this->actingAs($this->regular)
        ->getJson(route('attachments.index'))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $normal->id);
});

test('admin media library shows system images with usage label read-only', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);
    uploadNavIcon($this, $link);

    $response = $this->actingAs($this->admin)
        ->getJson(route('attachments.index'));

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.is_protected', true)
        ->assertJsonPath('data.0.usage_label', '导航图标：ChatGPT');
});

test('protected system images cannot be deleted from media library', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);
    uploadNavIcon($this, $link);

    $attachment = Attachment::first();
    $path = $attachment->file_path;

    $this->actingAs($this->admin)
        ->deleteJson(route('attachments.destroy', $attachment))
        ->assertStatus(403);

    expect(Attachment::count())->toBe(1)
        ->and(Storage::disk('public')->exists($path))->toBeTrue();
});

test('bulk delete skips protected system images', function () {
    $link = NavLink::factory()->create(['name' => 'ChatGPT']);
    uploadNavIcon($this, $link);

    $normal = Attachment::create([
        'author_id' => $this->admin->id,
        'file_name' => 'normal.png',
        'file_path' => 'uploads/2026/01/normal.png',
        'mime_type' => 'image/png',
        'file_size' => 100,
    ]);

    $this->actingAs($this->admin)
        ->deleteJson(route('attachments.bulk-destroy'), ['ids' => [$normal->id, $attachment = Attachment::first()->id]])
        ->assertOk()
        ->assertJsonPath('message', fn ($message) => str_contains($message, '受保护'));

    expect(Attachment::where('id', $normal->id)->exists())->toBeFalse()
        ->and(Attachment::where('id', $attachment)->exists())->toBeTrue();
});
