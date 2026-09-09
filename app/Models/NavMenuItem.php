<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $menu_id
 * @property int $parent_id
 * @property int $sort_order
 * @property string $type
 * @property int $object_id
 * @property string $label
 * @property string $url
 * @property string $css_class
 * @property string $target
 */
class NavMenuItem extends Model
{
    protected $fillable = [
        'menu_id',
        'parent_id',
        'sort_order',
        'type',
        'object_id',
        'label',
        'url',
        'css_class',
        'target',
    ];

    public function menu(): BelongsTo
    {
        return $this->belongsTo(NavMenu::class, 'menu_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }
}
