<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->bigIncrements('comment_id')->comment('评论主键ID');
            $table->bigInteger('object_id', unsigned: true)->default(0)->comment('关联对象ID');
            $table->string('object_type', 32)->default('article')->comment('article/page');
            $table->tinyText('author_name')->comment('评论者昵称');
            $table->string('author_email', 100)->default('')->comment('评论邮箱');
            $table->string('author_url', 200)->default('')->comment('个人网址');
            $table->string('ip', 100)->default('')->comment('评论IP地址');
            $table->text('content')->comment('评论内容');
            $table->integer('like_num')->default(0)->comment('点赞数量');
            $table->string('status', 20)->default('1')->comment('1通过/0待审/spam垃圾评论/trash回收站');
            $table->bigInteger('parent_id', unsigned: true)->default(0)->comment('楼中楼父评论ID');
            $table->bigInteger('user_id', unsigned: true)->default(0)->comment('登录会员ID');
            $table->timestamp('created_at')->useCurrent()->comment('评论时间');

            $table->index(['object_type', 'object_id'], 'idx_comments_object');
            $table->index('parent_id', 'idx_comments_parent');
            $table->index('status', 'idx_comments_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
