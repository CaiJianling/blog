<?php

namespace Database\Factories;

use App\Models\NavCategory;
use App\Models\NavLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NavLink>
 */
class NavLinkFactory extends Factory
{
    protected $model = NavLink::class;

    public function definition(): array
    {
        return [
            'nav_category_id' => NavCategory::factory(),
            'name' => fake()->unique()->company(),
            'url' => fake()->url(),
            'color' => fake()->hexColor(),
            'description' => fake()->sentence(),
            'intro_content' => null,
            'sort_order' => 0,
        ];
    }

    /**
     * 带图文介绍的链接。
     */
    public function withIntro(): static
    {
        return $this->state(fn (array $attributes) => [
            'intro_content' => [
                [
                    'type' => 'paragraph',
                    'content' => [['type' => 'text', 'text' => '这是一段图文介绍。']],
                ],
            ],
        ]);
    }
}
