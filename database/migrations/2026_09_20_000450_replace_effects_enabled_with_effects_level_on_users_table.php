<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * 特效从「开/关」两态改为四档（1 关闭 / 2 开启 / 3 进阶 / 4 极致）。
     * 旧「开启」覆盖的界面（液态玻璃开关滑块 + 悬浮窗 + 顶栏）正好等于新的「极致」，
     * 故旧值 true 回填为 4，false 保持列默认值 1。
     */
    public function up(): void
    {
        // 旧的布尔迁移可能已在这套库上执行过，也可能从未执行（全新库），据此决定是否回填。
        $hadEffectsFlag = Schema::hasColumn('users', 'effects_enabled');

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('effects_level')->default(1)->after('is_active');
        });

        if ($hadEffectsFlag) {
            DB::table('users')->where('effects_enabled', true)->update(['effects_level' => 4]);

            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('effects_enabled');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('effects_enabled')->default(false)->after('is_active');
        });

        DB::table('users')->where('effects_level', '>=', 2)->update(['effects_enabled' => true]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('effects_level');
        });
    }
};
