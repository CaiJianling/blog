<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Page extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_id',
        'title',
        'slug',
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
}
