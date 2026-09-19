<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 运行迁移：为文章增加类型字段，区分普通文章与说说。
     */
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->string('post_type', 20)->default('post')->comment('post文章/moment说说')->after('status');
            $table->index('post_type', 'idx_post_type');
        });
    }

    /**
     * 回滚迁移。
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropIndex('idx_post_type');
            $table->dropColumn('post_type');
        });
    }
};
