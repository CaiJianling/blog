<?php

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
