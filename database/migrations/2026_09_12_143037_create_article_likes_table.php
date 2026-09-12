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
        Schema::create('article_likes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('article_id')->comment('文章 articles.id');
            $table->unsignedBigInteger('user_id')->nullable()->comment('点赞用户，未登录为 null');
            $table->string('guest_id', 64)->nullable()->comment('游客标识（浏览器生成）');
            $table->timestamps();

            // 登录用户与游客各自保证唯一：同一文章只能点赞一次
            $table->unique(['article_id', 'user_id'], 'uk_article_likes_user');
            $table->unique(['article_id', 'guest_id'], 'uk_article_likes_guest');
            $table->index('user_id', 'idx_article_likes_user');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('article_likes');
    }
};
