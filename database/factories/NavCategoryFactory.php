<?php

namespace Database\Factories;

use App\Models\NavCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NavCategory>
 */
class NavCategoryFactory extends Factory
{
    protected $model = NavCategory::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement(['AI 工具', '搜索引擎', '视频网站', '开发工具', '设计资源']).'_'.fake()->unique()->numberBetween(1, 9999),
            'sort_order' => 0,
        ];
    }
}
