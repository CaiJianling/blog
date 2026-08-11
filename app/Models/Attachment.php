<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_id',
        'file_name',
        'file_path',
        'mime_type',
        'file_size',
        'width',
        'height',
        'parent_type',
        'parent_id',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime_type, 'image/');
    }

    public function isVideo(): bool
    {
        return str_starts_with($this->mime_type, 'video/');
    }

    public function isDocument(): bool
    {
        return ! $this->isImage() && ! $this->isVideo();
    }

    public function getTypeLabel(): string
    {
        return match (true) {
            $this->isImage() => 'image',
            $this->isVideo() => 'video',
            default => 'document',
        };
    }
}
