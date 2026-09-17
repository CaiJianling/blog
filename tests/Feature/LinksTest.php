<?php

use App\Models\Attachment;
use App\Models\Link;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

function admin(): User
{
    return User::factory()->create(['role' => 'administrator']);
}

test('front link page lists only visible links', function () {
    $visible = Link::factory()->create(['link_visible' => 'Y', 'link_rating' => 1]);
    Link::factory()->create(['link_visible' => 'N', 'link_rating' => 9]);

    $this
        ->get(route('links.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Links/Index')
            ->has('links', 1)
            ->where('links.0.link_name', $visible->link_name),
        );
});

test('front link page orders by rating desc', function () {
    Link::factory()->create(['link_rating' => 1, 'link_visible' => 'Y']);
    $top = Link::factory()->create(['link_rating' => 9, 'link_visible' => 'Y']);

    $this
        ->get(route('links.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Links/Index')
            ->where('links.0.id', $top->link_id),
        );
});

test('admin link page requires authentication', function () {
    $this->get(route('links.admin'))->assertRedirect(route('login'));
});

test('admin link page lists all links', function () {
    $user = admin();
    Link::factory()->count(3)->create();

    $this
        ->actingAs($user)
        ->get(route('links.admin'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/links')
            ->has('links', 3),
        );
});

test('admin can create a link', function () {
    $user = admin();

    $this
        ->actingAs($user)
        ->post(route('links.store'), [
            'link_url' => 'github.com',
            'link_name' => 'GitHub',
            'link_target' => '_blank',
            'link_description' => '代码托管',
            'link_visible' => 'Y',
        ])
        ->assertRedirect();

    $link = Link::first();
    expect($link)->not->toBeNull()
        ->and($link->link_url)->toBe('https://github.com')
        ->and($link->link_name)->toBe('GitHub')
        ->and($link->link_target)->toBe('_blank');
});

test('link url is prefixed with https when missing', function () {
    $user = admin();

    $this
        ->actingAs($user)
        ->post(route('links.store'), [
            'link_url' => 'example.com',
            'link_name' => 'Example',
            'link_target' => '',
            'link_description' => '',
            'link_visible' => 'Y',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect(Link::count())->toBe(1);
    $link = Link::orderBy('link_id')->first();

    expect($link)->not->toBeNull();
    expect($link->link_url)->toBe('https://example.com');
});

test('admin can update a link', function () {
    $user = admin();
    $link = Link::factory()->create(['link_name' => 'Old']);

    $this
        ->actingAs($user)
        ->put(route('links.update', $link), [
            'link_url' => $link->link_url,
            'link_name' => 'New',
            'link_target' => '_blank',
            'link_description' => 'desc',
            'link_visible' => 'N',
        ])
        ->assertRedirect();

    $link->refresh();
    expect($link->link_name)->toBe('New')
        ->and($link->link_visible)->toBe('N');
});

test('destroying a link removes its image from the file system', function () {
    $user = admin();
    Storage::fake('public');

    $link = Link::factory()->create();
    $attachment = attachLinkImage($this, $user, $link);

    expect($attachment)->not->toBeNull();
    expect(Storage::disk('public')->exists($attachment->file_path))->toBeTrue();

    $this->actingAs($user)->delete(route('links.destroy', $link))->assertRedirect();

    expect(Link::find($link->link_id))->toBeNull()
        ->and(Attachment::find($attachment->id))->toBeNull()
        ->and(Storage::disk('public')->exists($attachment->file_path))->toBeFalse();
});

test('replacing a link image removes the previous unused image', function () {
    $user = admin();
    Storage::fake('public');

    $link = Link::factory()->create();
    $first = attachLinkImage($this, $user, $link, 'first.png');

    $this
        ->actingAs($user)
        ->post(route('links.image.store', $link), [
            'file' => UploadedFile::fake()->image('second.png', 64, 64),
        ])
        ->assertOk();

    // 旧图已从数据库与文件库移除，仅保留新图
    expect(Attachment::where('parent_type', 'link_image')->where('parent_id', $link->link_id)->count())->toBe(1)
        ->and(Attachment::find($first->id))->toBeNull()
        ->and(Storage::disk('public')->exists($first->file_path))->toBeFalse();
});

test('removing a link image deletes the attachment and file', function () {
    $user = admin();
    Storage::fake('public');

    $link = Link::factory()->create();
    $attachment = attachLinkImage($this, $user, $link);

    $this
        ->actingAs($user)
        ->delete(route('links.image.destroy', $link))
        ->assertOk();

    expect($link->refresh()->link_image)->toBe('')
        ->and(Attachment::find($attachment->id))->toBeNull()
        ->and(Storage::disk('public')->exists($attachment->file_path))->toBeFalse();
});

test('reorder rewrites rating so the first item ranks highest', function () {
    $user = admin();
    $a = Link::factory()->create(['link_rating' => 1]);
    $b = Link::factory()->create(['link_rating' => 2]);

    $this
        ->actingAs($user)
        ->put(route('links.reorder'), ['ids' => [$b->link_id, $a->link_id]])
        ->assertRedirect();

    expect(Link::find($b->link_id)->link_rating)->toBeGreaterThan(Link::find($a->link_id)->link_rating);
});

/**
 * 通过后台上传接口给某友链挂一张图片，返回附件。
 */
function attachLinkImage(TestCase $test, User $user, Link $link, string $name = 'cover.png'): ?Attachment
{
    $response = $test->actingAs($user)->post(route('links.image.store', $link), [
        'file' => UploadedFile::fake()->image($name, 64, 64),
    ]);
    $response->assertOk();

    return Attachment::where('parent_type', 'link_image')->where('parent_id', $link->link_id)->first();
}
