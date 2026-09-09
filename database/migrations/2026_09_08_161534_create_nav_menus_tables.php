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
        Schema::create('nav_menus', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name', 191)->default('')->comment('菜单名称');
            $table->string('slug', 191)->default('')->comment('菜单位置标识，如 top/sidebar');
            $table->boolean('auto_add_pages')->default(false)->comment('自动将新的顶级页面添加至此菜单');
            $table->timestamps();

            $table->unique('slug', 'idx_nav_menus_slug');
        });

        Schema::create('nav_menu_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('menu_id')->default(0)->comment('所属菜单 nav_menus.id');
            $table->unsignedBigInteger('parent_id')->default(0)->comment('父菜单项 id，0 为顶级');
            $table->integer('sort_order')->default(0)->comment('同级排序，越小越靠前');
            $table->string('type', 20)->default('custom')->comment('page文章页面/article文章/category分类目录/custom自定义链接');
            $table->unsignedBigInteger('object_id')->default(0)->comment('关联对象 ID（页面/文章/分类），custom 为 0');
            $table->string('label', 191)->default('')->comment('菜单显示文字，空则用对象标题');
            $table->string('url', 500)->default('')->comment('自定义链接地址');
            $table->string('css_class', 100)->default('')->comment('图标或自定义 CSS 类');
            $table->string('target', 20)->default('')->comment('_blank 表示新窗口打开');
            $table->timestamps();

            $table->index('menu_id', 'idx_nav_items_menu');
            $table->index('parent_id', 'idx_nav_items_parent');
            $table->index(['type', 'object_id'], 'idx_nav_items_object');
        });

        // 默认菜单
        DB::table('nav_menus')->insert([
            'name' => '顶部导航',
            'slug' => 'top',
            'auto_add_pages' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nav_menu_items');
        Schema::dropIfExists('nav_menus');
    }
};
