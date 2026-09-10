<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Smiley extends Model
{
    protected $fillable = ['group_id', 'code', 'image', 'sort'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(SmileyGroup::class, 'group_id');
    }
}
