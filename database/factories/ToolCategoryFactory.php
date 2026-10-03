<?php

namespace Database\Factories;

use App\Models\ToolCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ToolCategory>
 */
class ToolCategoryFactory extends Factory
{
    protected $model = ToolCategory::class;

    public function definition(): array
    {
        return [
            'name' => '分组_'.fake()->unique()->numberBetween(1, 9999),
            'sort_order' => 0,
        ];
    }
}
