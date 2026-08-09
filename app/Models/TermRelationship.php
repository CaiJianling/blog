<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TermRelationship extends Model
{
    use HasFactory;

    protected $table = 'term_relationships';

    public $timestamps = false;

    protected $fillable = [
        'object_id',
        'object_type',
        'term_taxonomy_id',
        'sort',
    ];

    public function taxonomy(): BelongsTo
    {
        return $this->belongsTo(TermTaxonomy::class, 'term_taxonomy_id');
    }
}