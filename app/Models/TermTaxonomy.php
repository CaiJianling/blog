<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TermTaxonomy extends Model
{
    use HasFactory;

    protected $primaryKey = 'term_taxonomy_id';

    protected $table = 'term_taxonomy';

    protected $fillable = [
        'term_id',
        'taxonomy',
        'description',
        'parent',
        'count',
    ];

    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class, 'term_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent', 'term_taxonomy_id');
    }

    public function relationships(): HasMany
    {
        return $this->hasMany(TermRelationship::class, 'term_taxonomy_id');
    }
}