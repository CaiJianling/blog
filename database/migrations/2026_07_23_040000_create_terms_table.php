<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terms', function (Blueprint $table) {
            $table->bigIncrements('term_id')->comment('词条ID');
            $table->string('name', 200)->default('')->comment('栏目/标签名称');
            $table->string('slug', 200)->default('')->comment('URL别名');
            $table->timestamps();
            $table->index(['slug']);
            $table->index(['name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terms');
    }
};