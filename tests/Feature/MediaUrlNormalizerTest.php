<?php

use App\Models\Article;
use App\Models\Page;
use App\Models\User;
use App\Services\MediaUrlNormalizer;
use Illuminate\Support\Facades\Storage;

function oldMediaUrl(string $path): string
{
    // 模拟"旧域名"下的媒体 URL
    return 'http://old-domain.example.com/storage/uploads/'.$path;
}

function currentMediaBase(): string
{
    return rtrim(Storage::disk('public')->url(''), '/').'/uploads';
}

it('把旧域名的本地媒体 URL 归一化为当前基址，且不动外链', function () {
    $n = app(MediaUrlNormalizer::class);

    expect($n->normalizeUrl(oldMediaUrl('2021/12/x.jpg')))->toBe(currentMediaBase().'/2021/12/x.jpg');
    expect($n->normalizeUrl('https://cn.bandisoft.com/dl/a.zip'))->toBe('https://cn.bandisoft.com/dl/a.zip');
    expect($n->normalizeUrl('blob:abc'))->toBe('blob:abc');
    expect($n->normalizeUrl(''))->toBe('');
})->name('normalize-url');

it('深度归一化嵌套块结构（图片/链接/表格/子块）', function () {
    $n = app(MediaUrlNormalizer::class);

    $content = [
        ['id' => 'a', 'type' => 'image', 'props' => ['url' => oldMediaUrl('2021/12/x.jpg')], 'content' => [], 'children' => []],
        ['id' => 'b', 'type' => 'paragraph', 'props' => [], 'content' => [
            ['type' => 'text', 'text' => '看 ', 'styles' => []],
            ['type' => 'link', 'href' => oldMediaUrl('2022/01/y.pdf'), 'content' => [['type' => 'text', 'text' => '下载', 'styles' => []]]],
            ['type' => 'link', 'href' => 'https://external.com/f.zip', 'content' => [['type' => 'text', 'text' => '外链', 'styles' => []]]],
        ], 'children' => []],
        ['id' => 'c', 'type' => 'table', 'props' => [], 'content' => ['type' => 'tableContent', 'rows' => [[
            'cells' => [[
                'type' => 'tableCell',
                'content' => [['type' => 'link', 'href' => oldMediaUrl('t/z.jpg'), 'content' => [['type' => 'text', 'text' => '图', 'styles' => []]]]],
            ]],
        ]]], 'children' => []],
        ['id' => 'd', 'type' => 'bulletListItem', 'props' => [], 'content' => [], 'children' => [
            ['id' => 'e', 'type' => 'image', 'props' => ['url' => oldMediaUrl('2023/05/w.png')], 'content' => [], 'children' => []],
        ]],
    ];

    $out = $n->normalizeContent($content);

    expect($out[0]['props']['url'])->toBe(currentMediaBase().'/2021/12/x.jpg');
    expect($out[1]['content'][1]['href'])->toBe(currentMediaBase().'/2022/01/y.pdf');
    expect($out[1]['content'][2]['href'])->toBe('https://external.com/f.zip');
    expect($out[2]['content']['rows'][0]['cells'][0]['content'][0]['href'])->toBe(currentMediaBase().'/t/z.jpg');
    expect($out[3]['children'][0]['props']['url'])->toBe(currentMediaBase().'/2023/05/w.png');
})->name('normalize-content-nested');

it('保存文章/页面时自动把旧域名媒体 URL 归一化（saving 钩子）', function () {
    User::factory()->create(['role' => 'administrator']);

    $article = Article::create([
        'author_id' => User::first()->id,
        'title' => '换域名测试',
        'slug' => 'domain-test',
        'content' => [
            ['id' => 'a', 'type' => 'image', 'props' => ['url' => oldMediaUrl('2021/12/x.jpg')], 'content' => [], 'children' => []],
        ],
        'status' => 'publish',
        'post_type' => Article::TYPE_POST,
        'excerpt' => '',
    ]);

    // 落库后重新读取：URL 应已被 saving 钩子归一化为当前基址
    $reloaded = Article::find($article->id);
    expect($reloaded->content[0]['props']['url'])->toBe(currentMediaBase().'/2021/12/x.jpg');

    // 页面同样生效
    $page = Page::create([
        'author_id' => User::first()->id,
        'title' => '页面测试',
        'slug' => 'domain-test-page',
        'content' => [
            ['id' => 'p', 'type' => 'image', 'props' => ['url' => oldMediaUrl('2024/03/p.png')], 'content' => [], 'children' => []],
        ],
        'status' => 'publish',
    ]);

    $reloadedPage = Page::find($page->id);
    expect($reloadedPage->content[0]['props']['url'])->toBe(currentMediaBase().'/2024/03/p.png');
})->name('saving-hook-self-heal');

it('media:resync 全量改写存量正文并幂等', function () {
    User::factory()->create(['role' => 'administrator']);
    $uid = User::first()->id;

    // 造两条"旧域名"URL 的文章/页面（用 QueryBuilder 绕过 saving 钩子，模拟历史存量）
    $blocks = fn (string $path) => [[
        'id' => 'a', 'type' => 'image',
        'props' => ['url' => oldMediaUrl($path)], 'content' => [], 'children' => [],
    ]];

    $article = new Article(['author_id' => $uid, 'title' => '存量文章', 'slug' => 'legacy-a', 'content' => $blocks('2020/01/a.jpg'), 'status' => 'publish', 'post_type' => Article::TYPE_POST, 'excerpt' => '']);
    $article->saveQuietly();

    $page = new Page(['author_id' => $uid, 'title' => '存量页面', 'slug' => 'legacy-p', 'content' => $blocks('2020/02/p.png'), 'status' => 'publish']);
    $page->saveQuietly();

    expect(Article::find($article->id)->content[0]['props']['url'])->toBe(oldMediaUrl('2020/01/a.jpg'));

    // 跑 resync（非 dry-run）
    $this->artisan('media:resync')->assertExitCode(0);

    expect(Article::find($article->id)->content[0]['props']['url'])->toBe(currentMediaBase().'/2020/01/a.jpg');
    expect(Page::find($page->id)->content[0]['props']['url'])->toBe(currentMediaBase().'/2020/02/p.png');

    // 幂等：再跑一次不应报错误，且 URL 不变
    $this->artisan('media:resync')->assertExitCode(0);
    expect(Article::find($article->id)->content[0]['props']['url'])->toBe(currentMediaBase().'/2020/01/a.jpg');
})->name('media-resync');
