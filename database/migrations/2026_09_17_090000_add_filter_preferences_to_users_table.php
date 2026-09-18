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
        Schema::table('users', function (Blueprint $table) {
            // 前台页面滤镜偏好：饱和度 0-200（100 正常），亮度 20-100（100 正常）
            $table->unsignedSmallInteger('filter_saturation')->default(100);
            $table->unsignedSmallInteger('filter_brightness')->default(100);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['filter_saturation', 'filter_brightness']);
        });
    }
};
