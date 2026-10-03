<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmileyGroup extends Model
{
    protected $fillable = ['name', 'sort'];

    public function smileys(): HasMany
    {
        return $this->hasMany(Smiley::class, 'group_id')->orderBy('sort');
    }
}
