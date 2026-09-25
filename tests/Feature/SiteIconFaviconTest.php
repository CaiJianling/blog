<?php

use App\Models\Attachment;
use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * 站点图标：后台「站点设置 → 站点图标」上传后必须真的出现在页面 <head> 的 favicon 上
 * （由 HandleAppearance 共享给 resources/views/app.blade.php），未上传时回退内置默认图标。
 */
beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function siteIconAttachment(string $name = 'icon.png', string $mime = 'image/png'): Attachment
{
    return Attachment::create([
        'author_id' => test()->admin->id,
        'file_name' => $name,
        'file_path' => "uploads/{$name}",
        'mime_type' => $mime,
        'file_size' => 2048,
    ]);
}

test('falls back to the bundled favicon when no site icon is set', function () {
    $this->get('/')
        ->assertSee('<link rel="icon" href="/favicon.ico" sizes="any">', false)
        ->assertSee('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', false)
        ->assertSee('<link rel="apple-touch-icon" href="/apple-touch-icon.png">', false);
});

test('uploaded site icon replaces the favicon links', function () {
    $attachment = siteIconAttachment();
    Option::set('site_icon', (string) $attachment->id);

    $url = Storage::disk('public')->url($attachment->file_path);
    $expected = $url.'?v='.$attachment->updated_at->timestamp;

    $this->get('/')
        ->assertSee('<link rel="icon" href="'.$expected.'">', false)
        ->assertSee('<link rel="apple-touch-icon" href="'.$expected.'">', false)
        ->assertDontSee('/favicon.svg', false);
});

test('re-uploading busts the cached favicon url', function () {
    $attachment = siteIconAttachment();
    Option::set('site_icon', (string) $attachment->id);

    $before = $attachment->updated_at->timestamp;
    $url = Storage::disk('public')->url($attachment->file_path);

    Attachment::query()->whereKey($attachment->id)->update(['updated_at' => now()->addMinute()]);

    $this->get('/')
        ->assertSee('href="'.$url.'?v='.($before + 60).'">', false)
        ->assertDontSee('href="'.$url.'?v='.$before.'">', false);
});

test('non image attachment never becomes the favicon', function () {
    $attachment = siteIconAttachment('notes.pdf', 'application/pdf');
    Option::set('site_icon', (string) $attachment->id);

    $this->get('/')
        ->assertSee('<link rel="icon" href="/favicon.ico" sizes="any">', false)
        ->assertDontSee('notes.pdf', false);
});

test('missing attachment id falls back instead of erroring', function () {
    Option::set('site_icon', '999999');

    $this->get('/')
        ->assertOk()
        ->assertSee('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', false);
});

test('removing the site icon restores the default links', function () {
    $attachment = siteIconAttachment();
    Option::set('site_icon', (string) $attachment->id);
    Option::set('site_icon', '');

    $this->get('/')
        ->assertSee('<link rel="icon" href="/favicon.ico" sizes="any">', false)
        ->assertDontSee('/storage/uploads', false);
});

test('site icon is shared as an inertia prop so the front logo can use it', function () {
    $attachment = siteIconAttachment();
    Option::set('site_icon', (string) $attachment->id);

    $expected = Storage::disk('public')->url($attachment->file_path).'?v='.$attachment->updated_at->timestamp;

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('siteIcon', $expected));

    Option::set('site_icon', '');

    $this->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('siteIcon', null));
});
