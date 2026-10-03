<?php

namespace App\Services\WordPress;

use App\Models\Article;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Page;
use App\Models\Term;
use App\Models\TermRelationship;
use App\Models\TermTaxonomy;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * 将本项目数据导出为与 blog-export.php 相同的 schema（WordPress 表结构），
 * 以便被 WordPressImportService 重新导入（往返一致）。
 *
 * 本地 BlockNote 正文经 BlockNoteToWpHtml 转回 WordPress 块 HTML。
 */
final class WordPressExportService
{
    public function __construct(
        private BlockNoteToWpHtml $wpHtml,
    ) {}

    /**
     * @return array{
     *   posts: array, postmeta: array, comments: array,
     *   terms: array, term_taxonomy: array, term_relationships: array,
     *   users: array, options: array
     * }
     */
    public function export(): array
    {
        $disk = Storage::disk('public');

        $posts = [];
        $postmeta = [];
        $metaId = 1;

        // 文章
        foreach (Article::orderBy('id')->get() as $a) {
            $posts[] = $this->postRow('post', $a->id, $a->author_id, $a->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), $a->updated_at?->toDateTimeString() ?? $a->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), $this->wpHtml->convert($a->content ?? []), $a->title, $a->slug, $a->excerpt, $a->status, $this->inverseCommentStatus($a->comment_status), $a->post_password, (int) $a->comment_count, 0, '');
            $postmeta[] = $this->meta($metaId++, $a->id, 'apbe_headline', (string) ($a->meta_title ?? ''));
            $postmeta[] = $this->meta($metaId++, $a->id, 'apbe_summary', (string) ($a->meta_description ?? ''));
            if ((int) $a->views > 0) {
                $postmeta[] = $this->meta($metaId++, $a->id, 'views', (string) $a->views);
            }
            if ((int) $a->likes > 0) {
                $postmeta[] = $this->meta($metaId++, $a->id, 'upvotes', (string) $a->likes);
            }
        }

        // 页面
        foreach (Page::orderBy('id')->get() as $p) {
            $posts[] = $this->postRow('page', $p->id, $p->author_id, $p->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), $p->updated_at?->toDateTimeString() ?? $p->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), $this->wpHtml->convert($p->content ?? []), $p->title, $p->slug, '', $p->status, 'closed', '', 0, 0, '', '');
        }

        // 附件
        foreach (Attachment::orderBy('id')->get() as $at) {
            $attachedFile = $this->wpAttachedFile($at->file_path);
            $posts[] = $this->postRow('attachment', $at->id, $at->author_id, $at->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), $at->updated_at?->toDateTimeString() ?? $at->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'), '', $at->file_name, '', '', 'inherit', 'closed', '', 0, 0, '', $at->mime_type);
            if ($attachedFile !== '') {
                $postmeta[] = $this->meta($metaId++, $at->id, '_wp_attached_file', $attachedFile);
            }
            if ($at->width !== null || $at->height !== null) {
                $meta = serialize(['width' => (int) $at->width, 'height' => (int) $at->height, 'file' => basename($attachedFile)]);
                $postmeta[] = $this->meta($metaId++, $at->id, '_wp_attachment_metadata', $meta);
            }
        }

        $comments = [];
        foreach (Comment::orderBy('comment_id')->get() as $c) {
            $comments[] = [
                'comment_ID' => $c->comment_id,
                'comment_post_ID' => (int) $c->object_id,
                'comment_author' => (string) $c->author_name,
                'comment_author_email' => (string) $c->author_email,
                'comment_author_url' => (string) $c->author_url,
                'comment_author_IP' => (string) $c->ip,
                'comment_date' => $c->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'),
                'comment_date_gmt' => $c->created_at?->toDateTimeString() ?? date('Y-m-d H:i:s'),
                'comment_content' => (string) $c->content,
                'comment_karma' => 0,
                'comment_approved' => (string) $c->status,
                'comment_agent' => '',
                'comment_type' => $c->object_type === 'page' ? 'page' : 'comment',
                'comment_parent' => (int) $c->parent_id,
                'user_id' => 0,
            ];
        }

        $terms = [];
        foreach (Term::orderBy('term_id')->get() as $t) {
            $terms[] = [
                'term_id' => $t->term_id,
                'name' => $t->name,
                'slug' => rawurlencode((string) $t->slug),
                'description' => '',
                'parent' => 0,
                'count' => 0,
            ];
        }

        $termTaxonomy = [];
        foreach (TermTaxonomy::orderBy('term_taxonomy_id')->get() as $tt) {
            $termTaxonomy[] = [
                'term_taxonomy_id' => $tt->term_taxonomy_id,
                'term_id' => (int) $tt->term_id,
                'taxonomy' => $tt->taxonomy === 'tag' ? 'post_tag' : 'category',
                'description' => (string) $tt->description,
                'parent' => (int) $tt->parent,
                'count' => (int) $tt->count,
            ];
        }

        $relationships = [];
        foreach (TermRelationship::all() as $r) {
            $relationships[] = [
                'term_taxonomy_id' => (int) $r->term_taxonomy_id,
                'object_id' => (int) $r->object_id,
                'term_order' => (int) $r->sort,
            ];
        }

        $users = [];
        foreach (User::orderBy('id')->get() as $u) {
            $users[] = [
                'ID' => $u->id,
                'user_login' => (string) $u->nickname,
                'user_email' => (string) $u->email,
                'user_nicename' => (string) $u->nickname,
                'display_name' => (string) $u->nickname,
                'user_url' => '',
            ];
        }

        $options = [
            ['option_name' => 'blogname', 'option_value' => config('app.name')],
            ['option_name' => 'blogdescription', 'option_value' => ''],
            ['option_name' => 'siteurl', 'option_value' => config('app.url')],
            ['option_name' => 'home', 'option_value' => config('app.url')],
            ['option_name' => 'permalink_structure', 'option_value' => '/%post_id%.html'],
        ];

        return [
            'exported_at' => date('c'),
            'posts' => $posts,
            'postmeta' => $postmeta,
            'comments' => $comments,
            'terms' => $terms,
            'term_taxonomy' => $termTaxonomy,
            'term_relationships' => $relationships,
            'users' => $users,
            'options' => $options,
        ];
    }

    /**
     * 公共盘 file_path（uploads/2021/12/x.jpg）→ WP _wp_attached_file（2021/12/x.jpg）。
     */
    private function wpAttachedFile(string $filePath): string
    {
        return str_starts_with($filePath, 'uploads/') ? substr($filePath, strlen('uploads/')) : $filePath;
    }

    /**
     * @param  array<int, mixed>  $row
     */
    private function postRow(
        string $postType,
        int $id,
        int $author,
        string $date,
        string $modified,
        string $content,
        string $title,
        string $slug,
        string $excerpt,
        string $status,
        string $commentStatus,
        string $password,
        int $commentCount,
        int $parent,
        string $mime,
    ): array {
        return [
            'ID' => $id,
            'post_author' => $author,
            'post_date' => $date,
            'post_date_gmt' => $date,
            'post_content' => $content,
            'post_title' => $title,
            'post_excerpt' => $excerpt,
            'post_status' => $status,
            'comment_status' => $commentStatus,
            'ping_status' => 'closed',
            'post_password' => $password,
            'post_name' => rawurlencode($slug),
            'to_ping' => '',
            'pinged' => '',
            'post_modified' => $modified,
            'post_modified_gmt' => $modified,
            'post_content_filtered' => '',
            'post_parent' => $parent,
            'guid' => '',
            'menu_order' => 0,
            'post_type' => $postType,
            'post_mime_type' => $mime,
            'comment_count' => (string) $commentCount,
        ];
    }

    private function meta(int $id, int $postId, string $key, string $value): array
    {
        return ['meta_id' => $id, 'post_id' => $postId, 'meta_key' => $key, 'meta_value' => $value];
    }

    private function inverseCommentStatus(string $local): string
    {
        return $local === 'close' ? 'closed' : 'open';
    }
}
