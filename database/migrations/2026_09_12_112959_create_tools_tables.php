<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tool_categories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 191)->default('')->comment('分组名称');
            $table->integer('sort_order')->default(0)->comment('排序，越小越靠前');
            $table->timestamps();

            $table->index('sort_order', 'idx_tool_categories_sort');
        });

        Schema::create('tools', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tool_category_id')->default(0)->comment('所属分组 tool_categories.id');
            $table->string('slug', 191)->nullable()->comment('工具标识，内置工具详情页 /tools/{slug} 使用');
            $table->string('name', 191)->default('')->comment('工具名称');
            $table->string('url', 500)->nullable()->comment('自定义链接地址，填写后卡片直接跳转该地址');
            $table->text('description')->nullable()->comment('工具描述');
            $table->string('icon', 50)->default('Wrench')->comment('图标名，前端映射为字符图标');
            $table->integer('sort_order')->default(0)->comment('排序，越小越靠前');
            $table->timestamps();

            $table->unique('slug', 'uk_tools_slug');
            $table->index('tool_category_id', 'idx_tools_category');
            $table->index('sort_order', 'idx_tools_sort');
        });

        // 迁移原 config/tools.php 中的工具数据
        $tools = config('tools');

        if (is_array($tools)) {
            $now = now();
            $categoryIndex = 0;

            foreach ($tools as $categoryName => $items) {
                if (! is_string($categoryName) || ! is_array($items)) {
                    continue;
                }

                $categoryId = DB::table('tool_categories')->insertGetId([
                    'name' => $categoryName,
                    'sort_order' => $categoryIndex,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                foreach ($items as $itemIndex => $item) {
                    if (! is_array($item) || ! isset($item['name'])) {
                        continue;
                    }

                    DB::table('tools')->insert([
                        'tool_category_id' => $categoryId,
                        'slug' => $item['slug'] ?? null,
                        'name' => (string) $item['name'],
                        'url' => $item['url'] ?? null,
                        'description' => $item['description'] ?? null,
                        'icon' => $item['icon'] ?? 'Wrench',
                        'sort_order' => $itemIndex,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                $categoryIndex++;
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tools');
        Schema::dropIfExists('tool_categories');
    }
};
