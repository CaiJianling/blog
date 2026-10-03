<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PageView extends Model
{
    use HasFactory;

    public const SOURCE_DIRECT = 'direct';

    public const SOURCE_INTERNAL = 'internal';

    public const SOURCE_SEARCH = 'search';

    public const SOURCE_SOCIAL = 'social';

    public const SOURCE_EXTERNAL = 'external';

    protected $table = 'page_views';

    public $timestamps = false;

    protected $fillable = [
        'visitor_id',
        'user_id',
        'page_type',
        'object_id',
        'path',
        'referrer',
        'referrer_class',
        'browser',
        'os',
        'device',
        'ip_hash',
        'viewed_at',
    ];

    protected $casts = [
        'viewed_at' => 'datetime',
    ];
}
