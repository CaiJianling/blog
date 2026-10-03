<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 工具与导航链接增加点击量统计。
     */
    public function up(): void
    {
        Schema::table('tools', function (Blueprint $table) {
            $table->unsignedBigInteger('clicks')->default(0)->after('sort_order')->comment('点击量');
        });

        Schema::table('nav_links', function (Blueprint $table) {
            $table->unsignedBigInteger('clicks')->default(0)->after('sort_order')->comment('点击量');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tools', function (Blueprint $table) {
            $table->dropColumn('clicks');
        });

        Schema::table('nav_links', function (Blueprint $table) {
            $table->dropColumn('clicks');
        });
    }
};
