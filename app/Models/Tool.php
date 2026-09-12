<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $tool_category_id
 * @property string|null $slug
 * @property string $name
 * @property string|null $url
 * @property string|null $description
 * @property string $icon
 * @property int $sort_order
 */
class Tool extends Model
{
    use HasFactory;

    protected $fillable = [
        'tool_category_id',
        'slug',
        'name',
        'url',
        'description',
        'icon',
        'sort_order',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ToolCategory::class, 'tool_category_id');
    }

    /**
     * 是否为外链工具（填写了自定义链接地址，卡片直接跳转该地址）。
     */
    public function isExternal(): bool
    {
        return trim((string) $this->url) !== '';
    }
}
