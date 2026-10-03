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
        Schema::create('nav_categories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 191)->default('')->comment('分类名称');
            $table->integer('sort_order')->default(0)->comment('排序，越小越靠前');
            $table->timestamps();

            $table->index('sort_order', 'idx_nav_categories_sort');
        });

        Schema::create('nav_links', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('nav_category_id')->default(0)->comment('所属分类 nav_categories.id');
            $table->string('name', 191)->default('')->comment('链接名称');
            $table->string('url', 500)->default('')->comment('链接地址');
            $table->string('color', 20)->default('')->comment('卡片图标颜色，如 #10a37f');
            $table->text('description')->nullable()->comment('卡片上的简短介绍');
            $table->json('intro_content')->nullable()->comment('图文详细介绍，BlockNote JSON 块数组');
            $table->integer('sort_order')->default(0)->comment('排序，越小越靠前');
            $table->timestamps();

            $table->index('nav_category_id', 'idx_nav_links_category');
            $table->index('sort_order', 'idx_nav_links_sort');
        });

        // 迁移原 config/navigation.php 中的导航站数据
        $navigation = config('navigation');

        if (is_array($navigation)) {
            $now = now();
            $categoryIndex = 0;

            foreach ($navigation as $categoryName => $links) {
                if (! is_string($categoryName) || ! is_array($links)) {
                    continue;
                }

                $categoryId = DB::table('nav_categories')->insertGetId([
                    'name' => $categoryName,
                    'sort_order' => $categoryIndex,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                foreach ($links as $linkIndex => $link) {
                    if (! is_array($link) || ! isset($link['name'], $link['url'])) {
                        continue;
                    }

                    DB::table('nav_links')->insert([
                        'nav_category_id' => $categoryId,
                        'name' => (string) $link['name'],
                        'url' => (string) $link['url'],
                        'color' => (string) ($link['color'] ?? ''),
                        'description' => (string) ($link['description'] ?? ''),
                        'sort_order' => $linkIndex,
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
        Schema::dropIfExists('nav_links');
        Schema::dropIfExists('nav_categories');
    }
};
