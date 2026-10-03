<?php

use App\Models\Article;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Page;
use App\Models\Term;
use App\Models\TermRelationship;
use App\Models\TermTaxonomy;
use App\Models\User;
use App\Services\WordPress\WpHtmlConverter;
use App\Services\WordPress\WordPressExportService;
use App\Services\WordPress\WordPressImportService;
use Illuminate\Support\Facades\Storage;

/** 构造一份小型 WordPress 导出 JSON（与 blog-export.php 同 schema）。 */
function wpFixture(): array
{
    return [
        'exported_at' => date('c'),
        'posts' => [
            [
                'ID' => 1, 'post_author' => 1, 'post_date' => '2021-12-01 10:00:00', 'post_date_gmt' => '2021-12-01 02:00:00',
                'post_content' => "<!-- wp:paragraph --><p>你好 <strong>世界</strong></p><!-- /wp:paragraph -->\n\n<!-- wp:image {\"id\":3,\"sizeSlug\":\"large\"} --><figure class=\"wp-block-image size-large\"><img src=\"https://www.itpno.com/wp-content/uploads/2021/12/test-768x1024.jpg\" alt=\"\" /></figure><!-- /wp:image -->",
                'post_title' => '你好，世界', 'post_excerpt' => '', 'post_status' => 'publish', 'comment_status' => 'open',
                'ping_status' => 'closed', 'post_password' => '', 'post_name' => 'hello-world', 'to_ping' => '', 'pinged' => '',
                'post_modified' => '2021-12-01 11:00:00', 'post_modified_gmt' => '2021-12-01 03:00:00',
                'post_content_filtered' => '', 'post_parent' => 0, 'guid' => '', 'menu_order' => 0,
                'post_type' => 'post', 'post_mime_type' => '', 'comment_count' => '1',
            ],
            [
                'ID' => 2, 'post_author' => 1, 'post_date' => '2021-12-01 10:00:00', 'post_date_gmt' => '2021-12-01 02:00:00',
                'post_content' => "<!-- wp:paragraph --><p>关于</p><!-- /wp:paragraph -->",
                'post_title' => '关于', 'post_excerpt' => '', 'post_status' => 'publish', 'comment_status' => 'closed',
                'ping_status' => 'closed', 'post_password' => '', 'post_name' => 'about', 'to_ping' => '', 'pinged' => '',
                'post_modified' => '2021-12-01 11:00:00', 'post_modified_gmt' => '2021-12-01 03:00:00',
                'post_content_filtered' => '', 'post_parent' => 0, 'guid' => '', 'menu_order' => 0,
                'post_type' => 'page', 'post_mime_type' => '', 'comment_count' => '0',
            ],
            [
                'ID' => 3, 'post_author' => 1, 'post_date' => '2021-12-01 10:00:00', 'post_date_gmt' => '2021-12-01 02:00:00',
                'post_content' => '', 'post_title' => 'test', 'post_excerpt' => '', 'post_status' => 'inherit',
                'comment_status' => 'closed', 'ping_status' => 'closed', 'post_password' => '', 'post_name' => '',
                'to_ping' => '', 'pinged' => '', 'post_modified' => '2021-12-01 10:00:00', 'post_modified_gmt' => '2021-12-01 02:00:00',
                'post_content_filtered' => '', 'post_parent' => 1, 'guid' => '', 'menu_order' => 0,
                'post_type' => 'attachment', 'post_mime_type' => 'image/jpeg', 'comment_count' => '0',
            ],
        ],
        'postmeta' => [
            ['meta_id' => 1, 'post_id' => 3, 'meta_key' => '_wp_attached_file', 'meta_value' => '2021/12/test.jpg'],
            ['meta_id' => 2, 'post_id' => 3, 'meta_key' => '_wp_attachment_metadata', 'meta_value' => serialize(['width' => 1920, 'height' => 2560, 'file' => '2021/12/test.jpg'])],
        ],
        'comments' => [
            [
                'comment_ID' => 1, 'comment_post_ID' => 1, 'comment_author' => '测试者', 'comment_author_email' => 'a@b.c',
                'comment_author_url' => '', 'comment_author_IP' => '1.2.3.4', 'comment_date' => '2021-12-02 10:00:00',
                'comment_date_gmt' => '2021-12-02 02:00:00', 'comment_content' => '第一条评论', 'comment_karma' => 0,
                'comment_approved' => '1', 'comment_agent' => '', 'comment_type' => '', 'comment_parent' => 0, 'user_id' => 0,
            ],
        ],
        'terms' => [['term_id' => 1, 'name' => '分类A', 'slug' => 'cat-a', 'description' => '', 'parent' => 0, 'count' => 1]],
        'term_taxonomy' => [['term_taxonomy_id' => 1, 'term_id' => 1, 'taxonomy' => 'category', 'description' => '', 'parent' => 0, 'count' => 1]],
        'term_relationships' => [['term_taxonomy_id' => 1, 'object_id' => 1, 'term_order' => 0]],
        'users' => [['ID' => 1, 'user_login' => 'admin', 'user_email' => 'admin@x.y', 'user_nicename' => 'admin', 'display_name' => 'Admin', 'user_url' => '']],
        'options' => [['option_name' => 'blogname', 'option_value' => 'iTPno.']],
    ];
}

function writeFixture(string $dir): string
{
    $path = $dir.'/wp-fixture.json';
    file_put_contents($path, json_encode(wpFixture(), JSON_UNESCAPED_UNICODE));

    return $path;
}

it('将 WP 块 HTML 转换为 BlockNote 块', function () {
    $converter = new WpHtmlConverter(
        rewriteUrl: fn (string $url) => str_replace('https://www.itpno.com/wp-content/uploads/', 'http://localhost/storage/uploads/', $url),
        attachmentUrls: [],
    );

    $blocks = $converter->convert(wpFixture()['posts'][0]['post_content']);

    $types = array_map(fn ($b) => $b['type'], $blocks);

    expect($types)->toBe(['paragraph', 'image']);

    $para = $blocks[0];
    $text = collect($para['content'])->filter(fn ($i) => ($i['type'] ?? '') === 'text')->pluck('text')->implode('');
    expect($text)->toBe('你好 世界');
    expect($para['content'][1]['styles'])->toHaveKey('bold');

    expect($blocks[1]['props']['url'])->toBe('http://localhost/storage/uploads/2021/12/test-768x1024.jpg');
})->name('wphhtml 转 blocknote');

it('导入 WordPress 数据且重复执行幂等', function () {
    User::factory()->create(['role' => 'administrator', 'nickname' => '站长']);

    $path = writeFixture(sys_get_temp_dir());
    $service = app(WordPressImportService::class);

    $first = $service->import($path, null);
    expect($first['posts'])->toBe(1);
    expect($first['pages'])->toBe(1);
    expect($first['attachments'])->toBe(1);
    expect($first['comments'])->toBe(1);
    expect($first['terms'])->toBe(1);
    expect($first['term_relationships'])->toBe(1);

    $article = Article::first();
    expect($article)->not->toBeNull();
    expect($article->title)->toBe('你好，世界');
    expect($article->slug)->toBe('hello-world');
    expect($article->content[0]['type'])->toBe('paragraph');
    expect($article->content[1]['props']['url'])->toBe(Storage::disk('public')->url('uploads/2021/12/test-768x1024.jpg'));
    expect($article->status)->toBe('publish');

    $attachment = Attachment::first();
    expect($attachment->file_path)->toBe('uploads/2021/12/test.jpg');
    expect($attachment->width)->toBe(1920);
    expect($attachment->mime_type)->toBe('image/jpeg');

    $page = Page::first();
    expect($page->title)->toBe('关于');

    $comment = Comment::first();
    expect($comment->object_type)->toBe('article');
    expect($comment->object_id)->toBe($article->id);
    expect($comment->author_name)->toBe('测试者');

    expect(Term::first()->name)->toBe('分类A');
    expect(TermTaxonomy::first()->taxonomy)->toBe('category');
    expect(TermRelationship::first()->object_id)->toBe($article->id);

    // 幂等：再次执行不产生重复数据
    $second = $service->import($path, null);
    expect($second['already_imported'])->toBeTrue();
    expect(Article::count())->toBe(1);
    expect(Page::count())->toBe(1);
    expect(Attachment::count())->toBe(1);
    expect(Comment::count())->toBe(1);
});

it('导出与导入往返一致', function () {
    User::factory()->create(['role' => 'administrator', 'nickname' => '站长']);

    $path = writeFixture(sys_get_temp_dir());
    $service = app(WordPressImportService::class);
    $service->import($path, null);

    $export = app(WordPressExportService::class)->export();
    expect($export)->toHaveKeys(['posts', 'postmeta', 'comments', 'terms', 'term_taxonomy', 'term_relationships', 'users', 'options']);
    expect(count($export['posts']))->toBe(3);
    expect(str_contains($export['posts'][0]['post_content'], '<!-- wp:paragraph -->'))->toBeTrue();
    expect(str_contains($export['posts'][0]['post_content'], '<!-- wp:image'))->toBeTrue();

    $metaKeys = collect($export['postmeta'])->pluck('meta_key')->all();
    expect($metaKeys)->toContain('_wp_attached_file');
});
