<?php

namespace Database\Factories;

use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tool>
 */
class ToolFactory extends Factory
{
    protected $model = Tool::class;

    public function definition(): array
    {
        return [
            'tool_category_id' => ToolCategory::factory(),
            'slug' => fake()->unique()->slug(2),
            'name' => fake()->unique()->randomElement(['JSON 格式化', '正则测试', '文本对比', '单位换算']).'_'.fake()->unique()->numberBetween(1, 9999),
            'url' => null,
            'description' => fake()->sentence(),
            'icon' => 'Wrench',
            'sort_order' => 0,
        ];
    }

    /**
     * 外链工具（无 slug，直接跳转自定义地址）。
     */
    public function external(): static
    {
        return $this->state(fn (array $attributes) => [
            'slug' => null,
            'url' => 'https://example.com/tool',
        ]);
    }
}
