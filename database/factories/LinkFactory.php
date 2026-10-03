<?php

namespace Database\Factories;

use App\Models\Link;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Link>
 */
class LinkFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'link_url' => 'https://'.$this->faker->domainName(),
            'link_name' => implode(' ', array_slice($this->faker->words(4), 0, 2)),
            'link_image' => '',
            'link_target' => '_blank',
            'link_description' => $this->faker->sentence(),
            'link_visible' => 'Y',
            'link_rating' => $this->faker->numberBetween(0, 9999),
        ];
    }
}
