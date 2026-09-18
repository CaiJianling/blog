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
        'author_qq',
        'author_url',
        'ip',
        'content',
        'edited_content',
        'edited_at',
        'like_num',
        'status',
        'parent_id',
        'user_id',
        'is_private',
        'notify_mail',
        'is_markdown',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'is_private' => 'boolean',
        'notify_mail' => 'boolean',
        'is_markdown' => 'boolean',
        'created_at' => 'datetime',
        'edited_at' => 'datetime',
    ];

    /**
     * 是否有等待审批的编辑修订。
     */
    public function hasPendingEdit(): bool
    {
        return $this->edited_content !== null;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * 评论者头像 URL：登录用户用其头像，游客优先 QQ 头像，其次 Gravatar。
     */
    public function getAvatarUrlAttribute(): string
    {
        if ($this->user?->avatarUrl()) {
            return $this->user->avatarUrl();
        }

        if ($this->author_qq) {
            return 'https://q1.qlogo.cn/g?b=qq&nk='.$this->author_qq.'&s=100';
        }

        $hash = md5(strtolower(trim($this->author_email ?? '')));

        return 'https://cravatar.cn/avatar/'.$hash.'?d=mp&s=100';
    }

    public function getStatusTextAttribute(): string
    {
        return match ((string) $this->status) {
            '1' => '已批准',
            '0' => '待审',
            'spam' => '垃圾评论',
            'trash' => '回收站',
            default => '未知',
        };
    }
}
