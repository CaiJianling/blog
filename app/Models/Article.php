<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;

class Article extends Model
{
    use HasFactory;

    /** 普通文章。 */
    public const TYPE_POST = 'post';

    /** 说说（短内容动态，无标题）。 */
    public const TYPE_MOMENT = 'moment';

    protected $fillable = [
        'author_id',
        'title',
        'slug',
        'excerpt',
        'featured_image',
        'meta_title',
        'meta_description',
        'content',
        'post_password',
        'status',
        'post_type',
        'comment_status',
        'views',
        'likes',
        'comment_count',
    ];

    /**
     * content 字段以 WordPress Block 结构的 JSON 数组形式存取。
     *
     * @var array<string, string>
     */
    protected $casts = [
        'content' => 'array',
    ];

    /**
     * 按类型过滤（post = 普通文章，moment = 说说）。
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('post_type', $type);
    }

    public function isMoment(): bool
    {
        return $this->post_type === self::TYPE_MOMENT;
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * 特色图片（媒体库附件）。
     */
    public function featuredImage(): BelongsTo
    {
        return $this->belongsTo(Attachment::class, 'featured_image');
    }

    /**
     * 特色图片的公开访问 URL；未设置或附件已删除时返回 null。
     */
    public function featuredImageUrl(): ?string
    {
        $attachment = $this->featured_image
            ? Attachment::whereKey($this->featured_image)->where('mime_type', 'like', 'image/%')->first()
            : null;

        if (! $attachment) {
            return null;
        }

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return $publicDisk->url($attachment->file_path);
    }

    public function categories(): HasManyThrough
    {
        return $this->hasManyThrough(
            Term::class,
            TermRelationship::class,
            'object_id',
            'term_id',
            'id',
            'term_taxonomy_id'
        )->whereHas('taxonomies', function ($query) {
            $query->where('taxonomy', 'category');
        });
    }

    public function tags(): HasManyThrough
    {
        return $this->hasManyThrough(
            Term::class,
            TermRelationship::class,
            'object_id',
            'term_id',
            'id',
            'term_taxonomy_id'
        )->whereHas('taxonomies', function ($query) {
            $query->where('taxonomy', 'tag');
        });
    }

    /**
     * 预计阅读时长（分钟）：按正文纯文本字数 / 每分钟 400 字估算，最少 1 分钟。
     */
    public function estimatedReadingMinutes(): int
    {
        $length = mb_strlen(static::extractPlainText($this->content));

        return max(1, (int) ceil($length / 400));
    }

    /**
     * 从 Blocknote 块结构中提取纯文本（段落、标题、引用、列表、代码块、表格、链接行内内容）。
     *
     * @param  array|null  $blocks
     */
    public static function extractPlainText(array|object|null $blocks): string
    {
        if (! is_array($blocks) && ! $blocks instanceof \Traversable) {
            return '';
        }

        $text = '';

        foreach ($blocks as $block) {
            if (! is_array($block)) {
                continue;
            }

            $content = $block['content'] ?? null;

            if (is_string($content)) {
                // codeBlock 的 content 直接是代码字符串
                $text .= $content.' ';

                continue;
            }

            if ($block['type'] === 'table' && is_array($content)) {
                $text .= static::extractTableText($content).' ';

                continue;
            }

            if (is_array($content)) {
                foreach ($content as $item) {
                    $text .= static::extractInlineText($item);
                }
            }

            if (isset($block['children']) && is_array($block['children'])) {
                $text .= static::extractPlainText($block['children']);
            }
        }

        return $text;
    }

    /**
     * 提取表格块（content.rows[].cells[]）中的文本。
     */
    private static function extractTableText(array $content): string
    {
        $text = '';

        foreach (($content['rows'] ?? []) as $row) {
            if (! is_array($row)) {
                continue;
            }

            foreach (($row['cells'] ?? []) as $cell) {
                $text .= static::extractInlineText($cell).' ';
            }
        }

        return $text;
    }

    /**
     * 提取单个行内项（text / link）的文本。
     */
    private static function extractInlineText(mixed $item): string
    {
        if (! is_array($item)) {
            return is_string($item) ? $item.' ' : '';
        }

        $text = isset($item['text']) ? (string) $item['text'] : '';

        // link 项把行内内容嵌在 content 中
        if (isset($item['content']) && is_array($item['content'])) {
            foreach ($item['content'] as $nested) {
                $text .= static::extractInlineText($nested);
            }
        }

        return $text;
    }
}
