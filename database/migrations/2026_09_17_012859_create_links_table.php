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
        Schema::create('links', function (Blueprint $table) {
            $table->bigIncrements('link_id')->comment('链接ID');
            $table->string('link_url', 255)->default('')->comment('跳转地址');
            $table->string('link_name', 255)->default('')->comment('链接名称');
            $table->string('link_image', 255)->default('')->comment('链接图片');
            $table->string('link_target', 25)->default('')->comment('_blank新窗口');
            $table->string('link_description', 255)->default('')->comment('链接简介');
            $table->string('link_visible', 20)->default('Y')->comment('Y显示/N隐藏');
            $table->integer('link_rating')->default(0)->comment('排序评分');
            $table->timestamps();

            $table->index('link_visible', 'idx_visible');
            $table->index('link_rating', 'idx_rating');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('links');
    }
};
