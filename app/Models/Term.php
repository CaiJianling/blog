<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Term extends Model
{
    use HasFactory;

    protected $primaryKey = 'term_id';

    protected $fillable = [
        'name',
        'slug',
    ];

    public function taxonomies(): HasMany
    {
        return $this->hasMany(TermTaxonomy::class, 'term_id');
    }
}