<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property bool $auto_add_pages
 */
class NavMenu extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'auto_add_pages',
    ];

    protected $casts = [
        'auto_add_pages' => 'boolean',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(NavMenuItem::class, 'menu_id')->orderBy('sort_order');
    }
}
