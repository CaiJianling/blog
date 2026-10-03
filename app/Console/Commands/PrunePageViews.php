<?php

namespace App\Console\Commands;

use App\Models\PageView;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class PrunePageViews extends Command
{
    protected $signature = 'pageviews:prune {--days=180 : 保留最近多少天的访问数据}';

    protected $description = '清理超过保留期的站点访问统计数据';

    /**
     * 删除超过保留期的访问日志。
     */
    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = Carbon::now()->subDays($days);

        $deleted = PageView::where('viewed_at', '<', $cutoff)->delete();

        $this->info("已清理 {$cutoff->toDateString()} 之前的 {$deleted} 条访问记录。");

        return self::SUCCESS;
    }
}
