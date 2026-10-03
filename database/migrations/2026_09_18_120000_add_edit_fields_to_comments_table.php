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
        Schema::table('comments', function (Blueprint $table) {
            // 非管理员编辑待审批的内容：非空即表示有修订等待处理
            $table->text('edited_content')->nullable()->after('content');
            // 最近一次编辑生效时间（前台显示「已编辑」用）
            $table->timestamp('edited_at')->nullable()->after('edited_content');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn(['edited_content', 'edited_at']);
        });
    }
};
