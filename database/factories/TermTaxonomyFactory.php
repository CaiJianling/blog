<?php

namespace Database\Factories;

use App\Models\Term;
use App\Models\TermTaxonomy;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TermTaxonomy>
 */
class TermTaxonomyFactory extends Factory
{
    protected $model = TermTaxonomy::class;

    public function definition(): array
    {
        return [
            'term_id' => Term::factory(),
            'taxonomy' => fake()->randomElement(['category', 'tag']),
            'description' => fake()->sentence(),
            'parent' => 0,
            'count' => 0,
        ];
    }

    public function category(): static
    {
        return $this->state(fn () => ['taxonomy' => 'category']);
    }

    public function tag(): static
    {
        return $this->state(fn () => ['taxonomy' => 'tag']);
    }
}
