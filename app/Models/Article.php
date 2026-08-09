<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Article extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_id',
        'title',
        'slug',
        'excerpt',
        'content',
        'post_password',
        'status',
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

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
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
}