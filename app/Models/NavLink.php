<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $nav_category_id
 * @property string $name
 * @property string $url
 * @property string $color
 * @property string|null $description
 * @property array<int, mixed>|null $intro_content
 * @property int $sort_order
 */
class NavLink extends Model
{
    use HasFactory;

    protected $fillable = [
        'nav_category_id',
        'name',
        'url',
        'color',
        'description',
        'intro_content',
        'sort_order',
    ];

    protected $casts = [
        'intro_content' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(NavCategory::class, 'nav_category_id');
    }
}
