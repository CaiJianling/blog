<?php

namespace App\Services\WordPress;

use App\Models\Article;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Option;
use App\Models\Page;
use App\Models\Term;
use App\Models\TermRelationship;
use App\Models\TermTaxonomy;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * 导入 WordPress 导出的 JSON（blog-export.php 的 schema）到本项目数据库，
 * 并把媒体包（uploads.zip）解压到公共存储盘。
 *
 * 数据流向：
 *   wp_posts(post)         → articles（正文经 WpHtmlConverter 转 BlockNote 块）
 *   wp_posts(page)         → pages
 *   wp_posts(attachment)  → attachments + postmeta(_wp_attached_file / _wp_attachment_metadata)
 *   wp_terms / wp_term_taxonomy / wp_term_relationships → 同名表（post_tag → tag）
 *   wp_comments            → comments
 *
 * 幂等性：ID 映射持久化在 options 表（wp_import_map），重复执行自动跳过已导入行；
 * 全程逐行处理，不整表驻留，内存峰值保持低位。
 */
final class WordPressImportService
{
    /** options 表中保存 WP ID → 本地 ID 映射的键。 */
    public const MAP_OPTION = 'wp_import_map';

    /**
     * 执行导入。
     *
     * @param  string  $jsonPath  导出的 JSON 文件
     * @param  string|null  $uploadsZipPath  媒体包（uploads.zip），null 表示跳过媒体
     * @param  bool  $force  忽略幂等标记强制重新执行
     * @return array{
     *   already_imported: bool,
     *   posts: int, pages: int, attachments: int, comments: int,
     *   terms: int, term_relationships: int,
     *   files_copied: int, files_missing: int
     * }
     */
    public function import(string $jsonPath, ?string $uploadsZipPath = null, bool $force = false): array
    {
        $data = json_decode((string) file_get_contents($jsonPath), true);

        if (! is_array($data)) {
            throw new \RuntimeException("无法读取 WordPress 导出文件：{$jsonPath}");
        }

        $report = [
            'already_imported' => false,
            'posts' => 0, 'pages' => 0, 'attachments' => 0, 'comments' => 0,
            'terms' => 0, 'term_relationships' => 0, 'skipped' => 0,
            'files_copied' => 0, 'files_missing' => 0,
        ];

        // 媒体解压独立于数据库幂等：按文件逐个去重，可安全重跑
        if ($uploadsZipPath !== null) {
            $this->extractMedia($uploadsZipPath, $report);
        }

        if (! $force && $this->isFullyImported($data)) {
            $report['already_imported'] = true;

            return $report;
        }

        DB::transaction(function () use ($data, &$report) {
            $map = $this->loadMap();
            $this->importUsers($data, $map);
            $this->importTerms($data, $map, $report);
            $attachmentUrls = $this->importAttachments($data, $map, $report);
            $this->importPosts($data, $map, $attachmentUrls, $report);
            $this->importTermRelationships($data, $map, $report);
            $this->importComments($data, $map, $report);
            $this->saveMap($map);
        });

        return $report;
    }

    /**
     * 幂等判断：options 中已存在覆盖本次全部 WP 文章/评论的映射。
     */
    private function isFullyImported(array $data): bool
    {
        $raw = Option::get(self::MAP_OPTION);
        if (! is_string($raw) || $raw === '') {
            return false;
        }

        $map = json_decode($raw, true);
        if (! is_array($map) || ! isset($map['posts'], $map['comments'])) {
            return false;
        }

        foreach ((array) ($data['posts'] ?? []) as $post) {
            if (! isset($map['posts'][(string) $post['ID']])) {
                return false;
            }
        }

        // 仅校验"对象可映射"的评论（对象文章已删的孤儿评论本就不会入映射）
        foreach ((array) ($data['comments'] ?? []) as $comment) {
            $postId = (string) ($comment['comment_post_ID'] ?? 0);
            if (isset($map['posts'][$postId]) && ! isset($map['comments'][(string) $comment['comment_ID']])) {
                return false;
            }
        }

        return true;
    }

    // ------------------------------------------------------------------
    // 媒体包
    // ------------------------------------------------------------------

    /**
     * 将 uploads.zip 逐文件解压到公共盘 storage/app/public，跳过已存在文件。
     * 单个文件失败不中断整体，结束时汇总提示。
     */
    private function extractMedia(string $zipPath, array &$report): void
    {
        if (! is_file($zipPath)) {
            throw new \RuntimeException("媒体包不存在：{$zipPath}");
        }

        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException("无法打开媒体包：{$zipPath}");
        }

        $disk = Storage::disk('public');
        $prefix = 'uploads/';
        $firstError = null;

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->getNameIndex($i);

            if ($entry === false || ! str_starts_with($entry, $prefix)) {
                continue;
            }

            $relative = substr($entry, strlen($prefix));
            if ($relative === '' || str_contains($relative, '..') || str_ends_with($entry, '/')) {
                continue; // 跳过目录条目
            }

            if ($disk->exists('uploads/'.$relative)) {
                continue;
            }

            $content = $zip->getFromIndex($i);
            if ($content === false) {
                continue;
            }

            try {
                $dir = dirname($disk->path('uploads/'.$relative));
                if (! is_dir($dir)) {
                    File::makeDirectory($dir, 0755, true);
                }
                $disk->put('uploads/'.$relative, $content);
                $report['files_copied']++;
            } catch (\Throwable $e) {
                // 权限等问题不中断整体，记录首个错误
                if ($firstError === null) {
                    $firstError = $e->getMessage().'（'.$e->getFile().':'.$e->getLine().')';
                }
                $report['files_missing']++;
            }
        }

        $zip->close();

        if ($firstError !== null) {
            Log::warning("WordPress 媒体导入部分失败：{$firstError}");
        }
    }

    // ------------------------------------------------------------------
    // 映射表
    // ------------------------------------------------------------------

    /**
     * @return array{
     *   posts: array<string,int>, comments: array<string,int>,
     *   terms: array<string,int>, term_taxonomies: array<string,int>,
     *   users: array<string,int>, meta: array<string, mixed>
     * }
     */
    private function loadMap(): array
    {
        $raw = Option::get(self::MAP_OPTION);
        $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

        return [
            'posts' => is_array($decoded['posts'] ?? null) ? $decoded['posts'] : [],
            'comments' => is_array($decoded['comments'] ?? null) ? $decoded['comments'] : [],
            'terms' => is_array($decoded['terms'] ?? null) ? $decoded['terms'] : [],
            'term_taxonomies' => is_array($decoded['term_taxonomies'] ?? null) ? $decoded['term_taxonomies'] : [],
            'users' => is_array($decoded['users'] ?? null) ? $decoded['users'] : [],
            'meta' => is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [],
        ];
    }

    private function saveMap(array $map): void
    {
        Option::set(self::MAP_OPTION, json_encode($map, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /**
     * 为 WP 实体分配本地 ID：本地各表 max(id)+WP 偏移，保证不与既有数据冲突。
     * 首次导入时按各表当前最大值计算偏移并记入 meta，后续复用同一映射。
     *
     * @param  array<string, mixed>  $map
     */
    private function nextId(array &$map, string $table, string $key, int $wpId): int
    {
        if (isset($map[$table][(string) $wpId])) {
            return (int) $map[$table][(string) $wpId];
        }

        $offset = (int) ($map['meta']['offset_'.$table] ?? 0);
        if ($offset === 0) {
            $max = (int) match ($table) {
                'posts' => max(
                    (int) DB::table('articles')->max('id'),
                    (int) DB::table('pages')->max('id'),
                    (int) DB::table('attachments')->max('id'),
                ),
                'comments' => (int) DB::table('comments')->max('comment_id'),
                'terms' => (int) DB::table('terms')->max('term_id'),
                'term_taxonomies' => (int) DB::table('term_taxonomy')->max('term_taxonomy_id'),
                default => 0,
            };
            $offset = $max + 1;
            $map['meta']['offset_'.$table] = $offset;
        }

        $newId = $wpId + $offset;
        $map[$table][(string) $wpId] = $newId;

        return $newId;
    }

    // ------------------------------------------------------------------
    // 各表导入
    // ------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     */
    private function importUsers(array $data, array &$map): void
    {
        // WP 作者统一映射到本地管理员（站长）
        $admin = User::where('role', 'administrator')->orderBy('id')->first() ?? User::orderBy('id')->first();
        if ($admin === null) {
            throw new \RuntimeException('本地不存在用户，无法导入（需先创建站长账号）。');
        }

        foreach ((array) ($data['users'] ?? []) as $user) {
            $wpId = (string) ($user['ID'] ?? 0);
            if ($wpId !== '0' && ! isset($map['users'][$wpId])) {
                $map['users'][$wpId] = $admin->id;
            }
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     */
    private function importTerms(array $data, array &$map, array &$report): void
    {
        // 只导入 category / post_tag（→ tag）相关词条，跳过 nav_menu / wp_theme
        $wantedTaxonomies = ['category', 'post_tag'];

        $validTermIds = [];
        foreach ((array) ($data['term_taxonomy'] ?? []) as $tt) {
            if (in_array((string) ($tt['taxonomy'] ?? ''), $wantedTaxonomies, true)) {
                $validTermIds[(string) ($tt['term_id'] ?? 0)] = true;
            }
        }

        foreach ((array) ($data['terms'] ?? []) as $row) {
            $termId = (string) ($row['term_id'] ?? 0);
            if ($termId === '0' || ! isset($validTermIds[$termId])) {
                continue;
            }
            if (isset($map['terms'][$termId])) {
                continue;
            }

            $newTermId = $this->nextId($map, 'terms', 'term_id', (int) $termId);
            $now = Carbon::now();

            Term::forceCreate([
                'term_id' => $newTermId,
                'name' => (string) ($row['name'] ?? ''),
                'slug' => rawurldecode((string) ($row['slug'] ?? '')),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $report['terms']++;
        }

        foreach ((array) ($data['term_taxonomy'] ?? []) as $row) {
            $taxonomy = (string) ($row['taxonomy'] ?? '');
            if (! in_array($taxonomy, $wantedTaxonomies, true)) {
                continue;
            }
            $ttId = (string) ($row['term_taxonomy_id'] ?? 0);
            if ($ttId === '0' || isset($map['term_taxonomies'][$ttId])) {
                continue;
            }

            $newTtId = $this->nextId($map, 'term_taxonomies', 'term_taxonomy_id', (int) $ttId);
            $newTermId = $this->nextId($map, 'terms', 'term_id', (int) ($row['term_id'] ?? 0));
            $parent = (int) ($row['parent'] ?? 0);
            $newParent = $parent > 0 ? (int) ($map['term_taxonomies'][(string) $parent] ?? 0) : 0;
            $now = Carbon::now();

            TermTaxonomy::forceCreate([
                'term_taxonomy_id' => $newTtId,
                'term_id' => $newTermId,
                'taxonomy' => $taxonomy === 'post_tag' ? 'tag' : 'category',
                'description' => (string) ($row['description'] ?? ''),
                'parent' => $newParent,
                'count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * 导入附件；返回 [wp附件ID => 本地URL] 供正文 wp:file 块引用。
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     * @return array<string, string>
     */
    private function importAttachments(array $data, array &$map, array &$report): array
    {
        $metaByPost = $this->indexPostmeta($data);
        $disk = Storage::disk('public');
        $urls = [];

        foreach ((array) ($data['posts'] ?? []) as $row) {
            if ((string) ($row['post_type'] ?? '') !== 'attachment') {
                continue;
            }

            $wpId = (string) $row['ID'];

            if (isset($map['posts'][$wpId])) {
                // 已导入：附件 URL 映射仍需可用（wp:file 块引用）
                $existing = Attachment::find((int) $map['posts'][$wpId]);
                if ($existing !== null && $existing->file_path !== '') {
                    $urls[$wpId] = $disk->url($existing->file_path);
                }

                continue;
            }

            $newId = $this->nextId($map, 'posts', 'id', (int) $wpId);
            $meta = $metaByPost[$wpId] ?? [];
            $attachedFile = (string) ($meta['_wp_attached_file'] ?? '');
            $author = (int) ($map['users'][(string) ($row['post_author'] ?? 0)] ?? 0);

            $width = null;
            $height = null;
            $metaFilesize = null;
            if (isset($meta['_wp_attachment_metadata'])) {
                $decoded = @unserialize($meta['_wp_attachment_metadata'], ['allowed_classes' => false]);
                if (! is_array($decoded)) {
                    $decoded = json_decode((string) $meta['_wp_attachment_metadata'], true);
                }
                if (is_array($decoded)) {
                    $width = isset($decoded['width']) ? (int) $decoded['width'] : null;
                    $height = isset($decoded['height']) ? (int) $decoded['height'] : null;
                    $metaFilesize = isset($decoded['filesize']) ? (int) $decoded['filesize'] : null;
                }
            }

            $filePath = $attachedFile !== '' ? 'uploads/'.$attachedFile : '';
            $fileSize = 0;

            if ($filePath !== '' && $disk->exists($filePath)) {
                $fileSize = (int) $disk->size($filePath);
            } else {
                $fileSize = (int) $metaFilesize;
                $report['files_missing']++;
            }

            Attachment::forceCreate([
                'id' => $newId,
                'author_id' => $author,
                'file_name' => basename($attachedFile),
                'file_path' => $filePath,
                'mime_type' => (string) ($row['post_mime_type'] ?? ''),
                'file_size' => $fileSize,
                'width' => $width,
                'height' => $height,
                'parent_type' => null,
                'parent_id' => null,
            ]);

            if ($filePath !== '') {
                $urls[$wpId] = $disk->url($filePath);
            }

            $report['attachments']++;
        }

        return $urls;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, array<string, string>>
     */
    private function indexPostmeta(array $data): array
    {
        $indexed = [];
        foreach ((array) ($data['postmeta'] ?? []) as $meta) {
            $indexed[(string) $meta['post_id']][(string) $meta['meta_key']] = (string) $meta['meta_value'];
        }

        return $indexed;
    }

    /**
     * 导入文章与页面（逐篇转换正文，释放 DOM）。
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     * @param  array<string, string>  $attachmentUrls
     */
    private function importPosts(array $data, array &$map, array $attachmentUrls, array &$report): void
    {
        $metaByPost = $this->indexPostmeta($data);
        $publicBase = rtrim(Storage::disk('public')->url(''), '/');
        $converter = new WpHtmlConverter(
            rewriteUrl: function (string $url) use ($publicBase): string {
                // WP uploads 资源 → 本地公共盘
                if (preg_match('#^https?://[^/]+/wp-content/uploads/(.+)$#', $url, $m)) {
                    return $publicBase.'/uploads/'.$m[1];
                }

                return $url;
            },
            attachmentUrls: $attachmentUrls,
        );

        $usedSlugs = [];

        foreach ((array) ($data['posts'] ?? []) as $row) {
            $postType = (string) ($row['post_type'] ?? '');
            if (! in_array($postType, ['post', 'page'], true)) {
                continue;
            }

            $wpId = (string) $row['ID'];

            if (isset($map['posts'][$wpId])) {
                $report['skipped']++;

                continue;
            }

            $newId = $this->nextId($map, 'posts', 'id', (int) $wpId);
            $meta = $metaByPost[$wpId] ?? [];
            $author = (int) ($map['users'][(string) ($row['post_author'] ?? 0)] ?? 0);
            $blocks = $converter->convert((string) ($row['post_content'] ?? ''));
            $slug = $this->uniqueSlug(rawurldecode((string) ($row['post_name'] ?? '')), $usedSlugs, $postType);

            $createdAt = Carbon::parse((string) ($row['post_date'] ?? 'now'));
            $updatedAt = Carbon::parse((string) ($row['post_modified'] ?? $row['post_date'] ?? 'now'));

            if ($postType === 'page') {
                $parent = (int) ($row['post_parent'] ?? 0);

                Page::forceCreate([
                    'id' => $newId,
                    'author_id' => $author,
                    'title' => (string) ($row['post_title'] ?? ''),
                    'slug' => $slug,
                    'content' => $blocks,
                    'status' => $this->mapPostStatus((string) ($row['post_status'] ?? 'publish')),
                    'comment_status' => $this->mapCommentStatus((string) ($row['comment_status'] ?? 'closed')),
                    'views' => 0,
                    'likes' => 0,
                    'parent_id' => $parent > 0 ? (int) ($map['posts'][$parent] ?? 0) : 0,
                    'sort' => (int) ($row['menu_order'] ?? 0),
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);
                $report['pages']++;

                continue;
            }

            Article::forceCreate([
                'id' => $newId,
                'author_id' => $author,
                'title' => (string) ($row['post_title'] ?? ''),
                'slug' => $slug,
                'excerpt' => (string) ($row['post_excerpt'] ?? ''),
                'meta_title' => (string) ($meta['apbe_headline'] ?? ''),
                'meta_description' => (string) ($meta['apbe_summary'] ?? ''),
                'content' => $blocks,
                'post_password' => (string) ($row['post_password'] ?? ''),
                'status' => $this->mapPostStatus((string) ($row['post_status'] ?? 'publish')),
                'post_type' => Article::TYPE_POST,
                'comment_status' => $this->mapCommentStatus((string) ($row['comment_status'] ?? 'open')),
                'views' => (int) ($meta['views'] ?? 0),
                'likes' => (int) ($meta['upvotes'] ?? 0),
                'comment_count' => 0,
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ]);
            $report['posts']++;
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     */
    private function importTermRelationships(array $data, array &$map, array &$report): void
    {
        $postTypeById = [];
        foreach ((array) ($data['posts'] ?? []) as $row) {
            $postTypeById[(string) $row['ID']] = (string) ($row['post_type'] ?? '');
        }

        foreach ((array) ($data['term_relationships'] ?? []) as $row) {
            $objectId = (string) ($row['object_id'] ?? 0);
            $ttId = (string) ($row['term_taxonomy_id'] ?? 0);

            if (! isset($map['posts'][$objectId]) || ! isset($map['term_taxonomies'][$ttId])) {
                continue;
            }

            $objectType = ($postTypeById[$objectId] ?? 'post') === 'page' ? 'page' : 'article';
            $newObject = (int) $map['posts'][$objectId];
            $newTt = (int) $map['term_taxonomies'][$ttId];

            if (TermRelationship::where('object_id', $newObject)
                ->where('object_type', $objectType)
                ->where('term_taxonomy_id', $newTt)
                ->exists()) {
                $report['skipped']++;

                continue;
            }

            TermRelationship::create([
                'object_id' => $newObject,
                'object_type' => $objectType,
                'term_taxonomy_id' => $newTt,
                'sort' => (int) ($row['term_order'] ?? $row['order'] ?? 0),
            ]);
            $report['term_relationships']++;
        }

        // 按实际关系数回写分类/标签计数
        $counts = DB::table('term_relationships')
            ->select('term_taxonomy_id')
            ->selectRaw('COUNT(*) as cnt')
            ->groupBy('term_taxonomy_id')
            ->pluck('cnt', 'term_taxonomy_id');

        foreach ($counts as $ttId => $cnt) {
            TermTaxonomy::where('term_taxonomy_id', (int) $ttId)->update(['count' => (int) $cnt]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $map
     */
    private function importComments(array $data, array &$map, array &$report): void
    {
        $postTypeById = [];
        foreach ((array) ($data['posts'] ?? []) as $row) {
            $postTypeById[(string) $row['ID']] = (string) ($row['post_type'] ?? '');
        }

        $articleCommentCounts = [];

        foreach ((array) ($data['comments'] ?? []) as $row) {
            $wpCommentId = (string) ($row['comment_ID'] ?? 0);
            $wpPostId = (string) ($row['comment_post_ID'] ?? 0);

            if ($wpCommentId === '0' || ! isset($map['posts'][$wpPostId])) {
                continue; // 对象不存在（已删除文章等）的评论跳过
            }

            if (isset($map['comments'][$wpCommentId])) {
                $report['skipped']++;

                continue;
            }

            $objectType = ($postTypeById[$wpPostId] ?? '') === 'page' ? 'page' : 'article';

            if (($postTypeById[$wpPostId] ?? '') === 'attachment') {
                continue; // 附件上的评论不导入
            }

            $newId = $this->nextId($map, 'comments', 'comment_id', (int) $wpCommentId);
            $wpParent = (string) ($row['comment_parent'] ?? '0');
            $newParent = ($wpParent !== '0' && isset($map['comments'][$wpParent])) ? (int) $map['comments'][$wpParent] : 0;

            $approved = (string) ($row['comment_approved'] ?? '1');
            $status = match ($approved) {
                '1', '' => '1',
                '0' => '0',
                'spam', 'trash' => $approved,
                default => '1',
            };

            Comment::forceCreate([
                'comment_id' => $newId,
                'object_id' => (int) $map['posts'][$wpPostId],
                'object_type' => $objectType,
                'author_name' => (string) ($row['comment_author'] ?? ''),
                'author_email' => (string) ($row['comment_author_email'] ?? ''),
                'author_url' => (string) ($row['comment_author_url'] ?? ''),
                'ip' => (string) ($row['comment_author_IP'] ?? ''),
                'content' => (string) ($row['comment_content'] ?? ''),
                'like_num' => 0,
                'status' => $status,
                'parent_id' => $newParent,
                'user_id' => isset($map['users'][(string) ($row['user_id'] ?? 0)]) && (string) ($row['user_id'] ?? 0) !== '0'
                    ? (int) $map['users'][(string) $row['user_id']]
                    : null,
                'is_private' => false,
                'notify_mail' => false,
                'is_markdown' => false,
                'created_at' => Carbon::parse((string) ($row['comment_date'] ?? 'now')),
            ]);

            if ($objectType === 'article' && $status === '1') {
                $objId = (int) $map['posts'][$wpPostId];
                $articleCommentCounts[$objId] = ($articleCommentCounts[$objId] ?? 0) + 1;
            }

            $report['comments']++;
        }

        foreach ($articleCommentCounts as $objectId => $cnt) {
            Article::whereKey($objectId)->update(['comment_count' => $cnt]);
        }
    }

    // ------------------------------------------------------------------
    // 辅助
    // ------------------------------------------------------------------

    private function mapPostStatus(string $wpStatus): string
    {
        return match ($wpStatus) {
            'publish' => 'publish',
            'draft' => 'draft',
            'pending' => 'pending',
            'trash' => 'trash',
            // WP 的 private 对访客不可见，按草稿处理
            default => 'draft',
        };
    }

    private function mapCommentStatus(string $wpStatus): string
    {
        return match ($wpStatus) {
            'open' => 'open',
            'closed' => 'close',
            default => 'open',
        };
    }

    /**
     * 为文章/页面分配不冲突的 slug（冲突时追加序号）。
     *
     * @param  array<string, bool>  $usedSlugs
     */
    private function uniqueSlug(string $slug, array &$usedSlugs, string $postType): string
    {
        if ($slug === '') {
            return '';
        }

        if (isset($usedSlugs[$slug]) || $this->slugExists($slug, $postType)) {
            $n = 2;
            while (isset($usedSlugs[$slug.'-'.$n]) || $this->slugExists($slug.'-'.$n, $postType)) {
                $n++;
            }
            $slug .= '-'.$n;
        }

        $usedSlugs[$slug] = true;

        return $slug;
    }

    private function slugExists(string $slug, string $postType): bool
    {
        return $postType === 'page'
            ? Page::where('slug', $slug)->exists()
            : Article::where('slug', $slug)->exists();
    }
}
