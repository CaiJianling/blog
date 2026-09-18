<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 运行迁移。
     */
    public function up(): void
    {
        Schema::create('page_views', function (Blueprint $table) {
            $table->id();
            $table->string('visitor_id', 64)->index()->comment('访客指纹（cookie 的 SHA256，不含明文）');
            $table->unsignedBigInteger('user_id')->nullable()->comment('登录用户 ID');
            $table->string('page_type', 24)->comment('home|blog_list|article|tool|nav|nav_link|link|other');
            $table->unsignedBigInteger('object_id')->nullable()->comment('文章/工具/链接对象 ID');
            $table->string('path', 500)->comment('访问路径');
            $table->string('referrer', 500)->nullable()->comment('来源页完整 URL');
            $table->string('referrer_class', 20)->comment('direct|internal|search|social|external');
            $table->string('browser', 40)->nullable()->comment('浏览器');
            $table->string('os', 40)->nullable()->comment('操作系统');
            $table->string('device', 20)->nullable()->comment('desktop|mobile|tablet|unknown');
            $table->string('ip_hash', 64)->comment('IP 的 SHA256 哈希，不落明文');
            $table->timestamp('viewed_at')->index()->comment('访问发生时间');

            $table->index('referrer_class');
            $table->index('page_type');
        });
    }

    /**
     * 回滚迁移。
     */
    public function down(): void
    {
        Schema::dropIfExists('page_views');
    }
};
