<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('term_taxonomy', function (Blueprint $table) {
            $table->bigIncrements('term_taxonomy_id')->comment('分类主键');
            $table->unsignedBigInteger('term_id')->default(0)->comment('关联terms.term_id');
            $table->string('taxonomy', 32)->default('')->comment('category栏目/tag标签');
            $table->longText('description')->comment('分类简介');
            $table->unsignedBigInteger('parent')->default(0)->comment('父分类ID，无限层级');
            $table->bigInteger('count')->default(0)->comment('该分类下文章数量');
            $table->timestamps();
            $table->unique(['term_id', 'taxonomy']);
            $table->index(['taxonomy']);
            $table->index(['parent']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('term_taxonomy');
    }
};