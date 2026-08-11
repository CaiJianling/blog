<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Comment extends Model
{
    use HasFactory;

    protected $primaryKey = 'comment_id';

    public $incrementing = true;

    protected $keyType = 'int';

    public const UPDATED_AT = null;

    protected $fillable = [
        'object_id',
        'object_type',
        'author_name',
        'author_email',
        'author_url',
        'ip',
        'content',
        'like_num',
        'status',
        'parent_id',
        'user_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function getStatusTextAttribute(): string
    {
        return match ($this->status) {
            '1' => '已批准',
            '0' => '待审',
            'spam' => '垃圾评论',
            'trash' => '回收站',
            default => '未知',
        };
    }
}
