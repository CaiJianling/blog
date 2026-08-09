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
        Schema::create('articles', function (Blueprint $table) {
            $table->id()->comment('文章ID');
            $table->foreignId('author_id')->constrained('users')->comment('发布人users.ID');
            $table->text('title')->comment('文章标题');
            $table->string('slug', 200)->default('')->comment('伪静态URL别名');
            $table->text('excerpt')->comment('摘要');
            $table->longText('content')->comment('正文富文本');
            $table->string('post_password', 255)->default('')->comment('私密文章访问密码');
            $table->string('status', 20)->default('publish')->comment('publish发布/draft草稿/pending待审/trash回收站');
            $table->string('comment_status', 20)->default('open')->comment('open允许评论/close关闭评论');
            $table->bigInteger('views')->default(0)->comment('浏览量');
            $table->bigInteger('likes')->default(0)->comment('点赞量');
            $table->timestamps();
            $table->bigInteger('comment_count')->default(0)->comment('评论总数');

            $table->index('author_id', 'idx_author');
            $table->index(['status', 'created_at'], 'idx_status_time');
            $table->index('slug', 'idx_slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};