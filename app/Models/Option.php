<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $option_id
 * @property string $option_name
 * @property string $option_value
 * @property string $autoload
 */
class Option extends Model
{
    protected $table = 'options';

    protected $primaryKey = 'option_id';

    public $timestamps = false;

    protected $fillable = [
        'option_name',
        'option_value',
        'autoload',
    ];

    /**
     * Get a single option value by name.
     */
    public static function get(string $name, mixed $default = null): mixed
    {
        $option = static::where('option_name', $name)->first();

        if ($option === null) {
            return $default;
        }

        return $option->option_value;
    }

    /**
     * Set a single option value by name. Creates or updates.
     */
    public static function set(string $name, mixed $value, string $autoload = 'yes'): void
    {
        static::updateOrCreate(
            ['option_name' => $name],
            [
                'option_value' => is_array($value) ? json_encode($value) : (string) $value,
                'autoload' => $autoload,
            ],
        );
    }

    /**
     * Get many options by name prefix.
     *
     * @return array<string, string>
     */
    public static function getMany(array $names): array
    {
        return static::whereIn('option_name', $names)
            ->pluck('option_value', 'option_name')
            ->toArray();
    }
}
