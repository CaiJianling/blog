<?php

use App\Models\Term;
use App\Models\TermTaxonomy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// --- Authentication guards ---

test('guests are redirected from taxonomy store', function () {
    $response = $this->post(route('taxonomies.store'), [
        'taxonomy' => 'category',
        'name' => 'Test Category',
    ]);

    $response->assertRedirect(route('login'));
});

test('guests are redirected from taxonomy update', function () {
    $tax = TermTaxonomy::factory()->category()->create();

    $response = $this->put(route('taxonomies.update', $tax), [
        'name' => 'Updated',
    ]);

    $response->assertRedirect(route('login'));
});

test('guests are redirected from taxonomy destroy', function () {
    $tax = TermTaxonomy::factory()->category()->create();

    $response = $this->delete(route('taxonomies.destroy', $tax));

    $response->assertRedirect(route('login'));
});

// --- Store ---

test('authenticated users can create a category', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('taxonomies.store'), [
        'taxonomy' => 'category',
        'name' => 'News',
    ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('terms', ['name' => 'News', 'slug' => 'news']);
    $tax = TermTaxonomy::where('taxonomy', 'category')->first();
    expect($tax)->not->toBeNull();
    expect($tax->term->name)->toBe('News');
});

test('authenticated users can create a tag', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('taxonomies.store'), [
        'taxonomy' => 'tag',
        'name' => 'Laravel',
    ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('terms', ['name' => 'Laravel', 'slug' => 'laravel']);
    expect(TermTaxonomy::where('taxonomy', 'tag')->count())->toBe(1);
});

test('store validates required fields', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('taxonomies.store'), []);

    $response->assertSessionHasErrors(['taxonomy', 'name']);
});

test('store validates taxonomy is category or tag', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('taxonomies.store'), [
        'taxonomy' => 'invalid_type',
        'name' => 'Test',
    ]);

    $response->assertSessionHasErrors(['taxonomy']);
});

// --- Update ---

test('authenticated users can update a taxonomy', function () {
    $user = User::factory()->create();
    $tax = TermTaxonomy::factory()->category()->create();

    $response = $this->actingAs($user)->put(route('taxonomies.update', $tax), [
        'name' => 'Updated Category',
        'description' => 'New description',
    ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('terms', [
        'term_id' => $tax->term_id,
        'name' => 'Updated Category',
        'slug' => 'updated-category',
    ]);
    $this->assertDatabaseHas('term_taxonomy', [
        'term_taxonomy_id' => $tax->term_taxonomy_id,
        'description' => 'New description',
    ]);
});

test('update validates name is required', function () {
    $user = User::factory()->create();
    $tax = TermTaxonomy::factory()->category()->create();

    $response = $this->actingAs($user)->put(route('taxonomies.update', $tax), []);

    $response->assertSessionHasErrors(['name']);
});

// --- Destroy ---

test('authenticated users can delete a taxonomy', function () {
    $user = User::factory()->create();
    $tax = TermTaxonomy::factory()->category()->create();

    $response = $this->actingAs($user)->delete(route('taxonomies.destroy', $tax));

    $response->assertRedirect();

    $this->assertDatabaseMissing('term_taxonomy', [
        'term_taxonomy_id' => $tax->term_taxonomy_id,
    ]);
});

test('deleting a taxonomy also removes its term when orphaned', function () {
    $user = User::factory()->create();
    $tax = TermTaxonomy::factory()->category()->create();
    $termId = $tax->term_id;

    $this->actingAs($user)->delete(route('taxonomies.destroy', $tax));

    $this->assertDatabaseMissing('terms', ['term_id' => $termId]);
});

test('deleting a taxonomy does not remove term when shared with another taxonomy', function () {
    $user = User::factory()->create();
    $term = Term::factory()->create(['name' => 'Shared', 'slug' => 'shared']);

    $tax1 = TermTaxonomy::create([
        'term_id' => $term->term_id,
        'taxonomy' => 'category',
        'description' => '',
        'parent' => 0,
    ]);
    $tax2 = TermTaxonomy::create([
        'term_id' => $term->term_id,
        'taxonomy' => 'tag',
        'description' => '',
        'parent' => 0,
    ]);

    $this->actingAs($user)->delete(route('taxonomies.destroy', $tax1));

    $this->assertDatabaseHas('terms', ['term_id' => $term->term_id]);
    $this->assertDatabaseMissing('term_taxonomy', ['term_taxonomy_id' => $tax1->term_taxonomy_id]);
    $this->assertDatabaseHas('term_taxonomy', ['term_taxonomy_id' => $tax2->term_taxonomy_id]);
});

// --- Store with custom slug ---

test('authenticated users can create a taxonomy with custom slug', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('taxonomies.store'), [
        'taxonomy' => 'category',
        'name' => 'Custom Slug Test',
        'slug' => 'my-custom-slug',
    ]);

    $this->assertDatabaseHas('terms', [
        'name' => 'Custom Slug Test',
        'slug' => 'my-custom-slug',
    ]);
});

// --- Store with description ---

test('authenticated users can create a taxonomy with description', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('taxonomies.store'), [
        'taxonomy' => 'tag',
        'name' => 'PHP',
        'description' => 'Articles about PHP programming language',
    ]);

    $this->assertDatabaseHas('term_taxonomy', [
        'taxonomy' => 'tag',
        'description' => 'Articles about PHP programming language',
    ]);
});
