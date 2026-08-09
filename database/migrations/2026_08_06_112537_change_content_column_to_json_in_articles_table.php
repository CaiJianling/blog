<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * 将 content 字段从 longText(HTML 字符串) 改为 json(Block 结构的 JSON 数组)，
     * 用于存储 WordPress Block Editor 输出的块数据。
     */
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('content');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->json('content')->nullable()->after('excerpt')->comment('正文 Block 结构的 JSON 数组');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('content');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->longText('content')->after('excerpt')->comment('正文富文本');
        });
    }
};
