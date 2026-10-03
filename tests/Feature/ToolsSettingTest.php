<?php

use App\Models\Tool;
use App\Models\ToolCategory;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // 迁移会从 config/tools.php 预置数据，测试用例先清空再自行构造
    Tool::query()->delete();
    ToolCategory::query()->delete();

    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('public tools page renders categories and tools from database', function () {
    $category = ToolCategory::factory()->create(['name' => '格式化', 'sort_order' => 0]);
    Tool::factory()->create([
        'tool_category_id' => $category->id,
        'slug' => 'json-formatter',
        'name' => 'JSON 格式化',
        'icon' => 'Braces',
        'sort_order' => 0,
    ]);
    Tool::factory()->external()->create([
        'tool_category_id' => $category->id,
        'name' => '外部工具',
        'sort_order' => 1,
    ]);

    $response = $this->get(route('tools.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Tools/Index')
            ->has('toolCategories', 1)
            ->has('toolCategories.0.tools', 2)
            ->where('toolCategories.0.name', '格式化')
            ->where('toolCategories.0.tools.0.name', 'JSON 格式化')
            ->where('toolCategories.0.tools.0.url', null)
            ->where('toolCategories.0.tools.1.name', '外部工具')
            ->where('toolCategories.0.tools.1.url', 'https://example.com/tool'),
        );
});

test('public tool detail page renders tool from database', function () {
    $tool = Tool::factory()->create(['slug' => 'json-formatter', 'name' => 'JSON 格式化']);

    $this->get(route('tools.show', ['slug' => 'json-formatter']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Tools/Show')
            ->where('tool.name', 'JSON 格式化')
            ->where('category', $tool->category->name),
        );
});

test('external tools have no internal detail page', function () {
    Tool::factory()->external()->create(['slug' => null]);

    $this->get(route('tools.show', ['slug' => 'missing-tool']))
        ->assertNotFound();
});

test('admin can view tools settings page', function () {
    $category = ToolCategory::factory()->create(['name' => '格式化', 'sort_order' => 0]);
    Tool::factory()->create(['tool_category_id' => $category->id]);

    $this->actingAs($this->admin)
        ->get(route('tools.admin'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/tools')
            ->has('categories', 1)
            ->has('categories.0.tools', 1),
        );
});

test('non-admin cannot view tools settings page', function () {
    $this->actingAs($this->regular)
        ->get(route('tools.admin'))
        ->assertRedirect(route('dashboard'));
});

test('admin can create category', function () {
    ToolCategory::factory()->create(['sort_order' => 5]);

    $this->actingAs($this->admin)
        ->post(route('tools.categories.store'), ['name' => '新分组'])
        ->assertRedirect();

    $category = ToolCategory::where('name', '新分组')->first();

    expect($category)->not->toBeNull();
    expect($category->sort_order)->toBe(6);
});

test('category name is required', function () {
    $this->actingAs($this->admin)
        ->post(route('tools.categories.store'), ['name' => ''])
        ->assertSessionHasErrors(['name']);
});

test('admin can update category', function () {
    $category = ToolCategory::factory()->create(['name' => '旧名称']);

    $this->actingAs($this->admin)
        ->put(route('tools.categories.update', $category), ['name' => '新名称'])
        ->assertRedirect();

    expect($category->refresh()->name)->toBe('新名称');
});

test('deleting a category removes its tools', function () {
    $category = ToolCategory::factory()->create();
    Tool::factory()->count(2)->create(['tool_category_id' => $category->id]);

    $this->actingAs($this->admin)
        ->delete(route('tools.categories.destroy', $category))
        ->assertRedirect();

    expect(ToolCategory::count())->toBe(0);
    expect(Tool::count())->toBe(0);
});

test('admin can create internal tool with auto slug', function () {
    $category = ToolCategory::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), [
            'tool_category_id' => $category->id,
            'name' => 'JSON 格式化',
            'description' => '格式化 JSON 数据',
            'icon' => 'Braces',
        ])
        ->assertRedirect();

    $tool = Tool::where('name', 'JSON 格式化')->first();

    expect($tool)->not->toBeNull()
        ->and($tool->slug)->toBe('json')
        ->and($tool->url)->toBeNull()
        ->and($tool->icon)->toBe('Braces')
        ->and($tool->isExternal())->toBeFalse();

    // 再次创建同名工具时自动 slug 追加序号避免冲突
    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), [
            'tool_category_id' => $category->id,
            'name' => 'JSON 格式化',
        ])
        ->assertRedirect();

    expect(Tool::where('slug', 'json-2')->where('name', 'JSON 格式化')->exists())->toBeTrue();
});

test('admin can create external tool without slug', function () {
    $category = ToolCategory::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), [
            'tool_category_id' => $category->id,
            'name' => '外部工具',
            'url' => 'https://example.com/tool',
        ])
        ->assertRedirect();

    $tool = Tool::where('name', '外部工具')->first();

    expect($tool)->not->toBeNull()
        ->and($tool->url)->toBe('https://example.com/tool')
        ->and($tool->slug)->toBeNull()
        ->and($tool->isExternal())->toBeTrue();
});

test('tool name is required', function () {
    $category = ToolCategory::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), ['tool_category_id' => $category->id, 'name' => ''])
        ->assertSessionHasErrors(['name']);
});

test('tool slug must be unique and well formed', function () {
    $category = ToolCategory::factory()->create();
    Tool::factory()->create(['slug' => 'json-formatter']);

    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), [
            'tool_category_id' => $category->id,
            'name' => '重复标识',
            'slug' => 'json-formatter',
        ])
        ->assertSessionHasErrors(['slug']);

    $this->actingAs($this->admin)
        ->post(route('tools.items.store'), [
            'tool_category_id' => $category->id,
            'name' => '非法标识',
            'slug' => 'Invalid Slug!',
        ])
        ->assertSessionHasErrors(['slug']);
});

test('admin can update tool', function () {
    $tool = Tool::factory()->create(['name' => '旧名称']);

    $this->actingAs($this->admin)
        ->put(route('tools.items.update', $tool), [
            'tool_category_id' => $tool->tool_category_id,
            'name' => '新名称',
            'url' => 'https://example.com/new',
            'description' => '更新后的描述',
            'icon' => 'Globe',
        ])
        ->assertRedirect();

    $tool->refresh();

    expect($tool->name)->toBe('新名称')
        ->and($tool->url)->toBe('https://example.com/new')
        ->and($tool->isExternal())->toBeTrue();
});

test('admin can delete tool', function () {
    $tool = Tool::factory()->create();

    $this->actingAs($this->admin)
        ->delete(route('tools.items.destroy', $tool))
        ->assertRedirect();

    expect(Tool::count())->toBe(0);
});

test('admin can reorder categories and tools', function () {
    $first = ToolCategory::factory()->create(['sort_order' => 0]);
    $second = ToolCategory::factory()->create(['sort_order' => 1]);

    $toolA = Tool::factory()->create(['tool_category_id' => $first->id, 'sort_order' => 0]);
    $toolB = Tool::factory()->create(['tool_category_id' => $first->id, 'sort_order' => 1]);

    $this->actingAs($this->admin)
        ->put(route('tools.reorder'), ['type' => 'category', 'ids' => [$second->id, $first->id]])
        ->assertRedirect();

    $this->actingAs($this->admin)
        ->put(route('tools.reorder'), ['type' => 'tool', 'ids' => [$toolB->id, $toolA->id]])
        ->assertRedirect();

    expect($second->refresh()->sort_order)->toBe(0)
        ->and($first->refresh()->sort_order)->toBe(1)
        ->and($toolB->refresh()->sort_order)->toBe(0)
        ->and($toolA->refresh()->sort_order)->toBe(1);
});

test('reorder requires valid type', function () {
    $this->actingAs($this->admin)
        ->put(route('tools.reorder'), ['type' => 'invalid', 'ids' => [1]])
        ->assertSessionHasErrors(['type']);
});

test('non-admin cannot manage tools', function () {
    $category = ToolCategory::factory()->create();

    $this->actingAs($this->regular)
        ->post(route('tools.categories.store'), ['name' => '尝试'])
        ->assertRedirect(route('dashboard'));

    expect(ToolCategory::count())->toBe(1);
});
