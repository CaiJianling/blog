<?php

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 四档特效迁移：旧的 effects_enabled 布尔列要变成 effects_level，并且新库里
 * 该列可能压根不存在（从未跑过旧的布尔迁移），两条分支都要覆盖。
 *
 * 迁移在测试库中已执行完毕，故每个用例先手工退回历史状态再跑一次 up()。
 */
function restoreLegacyEffectsColumn(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn('effects_level');
    });

    Schema::table('users', function (Blueprint $table) {
        $table->boolean('effects_enabled')->default(false);
    });
}

function runEffectsLevelMigration(): void
{
    // 迁移文件返回匿名类实例，同一进程内重复 require 只取一次
    static $migration = null;

    $migration ??= require database_path('migrations/2026_09_20_000450_replace_effects_enabled_with_effects_level_on_users_table.php');

    $migration->up();
}

test('enabled users become the ultimate tier and the flag column is dropped', function () {
    restoreLegacyEffectsColumn();

    $on = User::factory()->create();
    $off = User::factory()->create();

    DB::table('users')->where('id', $on->id)->update(['effects_enabled' => true]);

    runEffectsLevelMigration();

    expect(Schema::hasColumn('users', 'effects_enabled'))->toBeFalse();
    expect(DB::table('users')->where('id', $on->id)->value('effects_level'))->toBe(4);
    expect(DB::table('users')->where('id', $off->id)->value('effects_level'))->toBe(1);
});

test('a fresh database without the legacy flag column defaults to off', function () {
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn('effects_level');
    });

    $user = User::factory()->create();

    expect(Schema::hasColumn('users', 'effects_enabled'))->toBeFalse();

    runEffectsLevelMigration();

    expect(DB::table('users')->where('id', $user->id)->value('effects_level'))->toBe(1);
});
