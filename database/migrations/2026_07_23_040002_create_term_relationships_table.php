<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('term_relationships', function (Blueprint $table) {
            $table->unsignedBigInteger('object_id')->default(0)->comment('数据ID');
            $table->string('object_type', 32)->comment('article文章 / page页面');
            $table->unsignedBigInteger('term_taxonomy_id')->default(0)->comment('分类ID');
            $table->integer('sort')->default(0)->comment('排序');
            $table->primary(['object_id', 'object_type', 'term_taxonomy_id']);
            $table->index(['term_taxonomy_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('term_relationships');
    }
};