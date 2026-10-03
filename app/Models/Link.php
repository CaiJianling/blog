<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * 友情链接：前台「友链」页展示，后台「友链设置」维护。
 *
 * link_image 存的是附件 ID（字符串），展示 URL 由
 * AttachmentService::systemImageUrl('link_image', $link_id) 解析，
 * 更换/删除图片时会一并从文件库移除旧图。
 *
 * @property int $link_id
 * @property string $link_url
 * @property string $link_name
 * @property string $link_image
 * @property string $link_target
 * @property string $link_description
 * @property string $link_visible
 * @property int $link_rating
 */
class Link extends Model
{
    use HasFactory;

    /**
     * 表名（links）。
     */
    protected $table = 'links';

    /**
     * 主键（link_id）。
     */
    protected $primaryKey = 'link_id';

    protected $fillable = [
        'link_url',
        'link_name',
        'link_image',
        'link_target',
        'link_description',
        'link_visible',
        'link_rating',
    ];

    protected $casts = [
        'link_rating' => 'integer',
    ];
}
