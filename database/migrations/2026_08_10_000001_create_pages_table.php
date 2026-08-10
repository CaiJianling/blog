<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pages', function (Blueprint $table) {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_general_ci';

            $table->id()->comment('页面ID');
            $table->bigInteger('author_id')->default(0)->comment('发布人users.ID');
            $table->text('title')->comment('页面标题');
            $table->string('slug', 200)->default('')->comment('伪静态URL别名');
            $table->longText('content')->comment('正文 Block 结构的 JSON 数组');
            $table->string('status', 20)->default('publish')->comment('publish发布/draft草稿/trash回收站');
            $table->string('comment_status', 20)->default('close')->comment('open允许评论/close关闭评论');
            $table->bigInteger('views')->default(0)->comment('浏览量');
            $table->bigInteger('likes')->default(0)->comment('点赞量');
            $table->bigInteger('parent_id')->default(0)->comment('父页面ID');
            $table->integer('sort')->default(0)->comment('排序');
            $table->timestamps();

            $table->index('parent_id', 'idx_pages_parent');
            $table->index('slug', 'idx_pages_slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pages');
    }
};
