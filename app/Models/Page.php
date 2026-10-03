<?php

namespace App\Models;

use App\Services\MediaUrlNormalizer;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Page extends Model
{
    use HasFactory;

    public static function booted(): void
    {
        static::saving(function (self $page): void {
            // 保存前自动归一化正文中的本地媒体 URL（换域名后保存即自愈）
            if (is_array($page->content)) {
                $page->content = app(MediaUrlNormalizer::class)->normalizeContent($page->content);
            }
        });
    }

    protected $fillable = [
        'author_id',
        'title',
        'slug',
        'meta_title',
        'meta_description',
        'content',
        'status',
        'comment_status',
        'views',
        'likes',
        'parent_id',
        'sort',
    ];

    /**
     * content 字段以 WordPress Block 结构的 JSON 数组形式存取。
     *
     * @var array<string, string>
     */
    protected $casts = [
        'content' => 'array',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * 该页面收到的评论（按 object_type=page 关联，支持 withCount('comments')）。
     */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'object_id')->where('object_type', 'page');
    }
}
