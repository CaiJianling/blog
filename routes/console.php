<?php

use App\Services\PageBackgroundService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| 每日清理超期的站点访问统计数据（默认保留 180 天）
|--------------------------------------------------------------------------
*/
Schedule::command('pageviews:prune')->dailyAt('03:30');

/*
|--------------------------------------------------------------------------
| 每日刷新必应每日壁纸（仅当背景模式为 bing 时生效；刷新会删除上一张存储的壁纸）
|--------------------------------------------------------------------------
*/
Schedule::call(fn () => app(PageBackgroundService::class)->refreshBingWallpaper())
    ->dailyAt('06:10')
    ->name('refresh-bing-wallpaper');
