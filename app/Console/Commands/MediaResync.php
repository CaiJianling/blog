<?php

namespace App\Console\Commands;

use App\Models\Article;
use App\Models\Page;
use App\Services\MediaUrlNormalizer;
use Illuminate\Console\Command;

class MediaResync extends Command
{
    protected $signature = 'media:resync {--dry-run : 只统计将被改动的条目数，不落库}';

    protected $description = '站点换域名后，把文章/页面正文中固化的本地媒体 URL 全部归一化为当前站点基址（与 database/media_url_rebase.sql 等价，PHP 版）';

    public function handle(MediaUrlNormalizer $normalizer): int
    {
        $dry = (bool) $this->option('dry-run');
        $base = $normalizer->mediaBase();
        $this->info("当前媒体基址：{$base}");

        $stats = ['articles' => 0, 'pages' => 0, 'changed' => 0];

        $this->processTable('文章', Article::class, $normalizer, $dry, $stats['articles'], $stats['changed']);
        $this->processTable('页面', Page::class, $normalizer, $dry, $stats['pages'], $stats['changed']);

        if ($dry) {
            $this->line("dry-run：共 {$stats['changed']} 条内容将被归一化（未写库）。去掉 --dry-run 正式执行。");
        } else {
            $this->info("完成：文章 {$stats['articles']} 条、页面 {$stats['pages']} 条已扫描，其中 {$stats['changed']} 条正文媒体 URL 已归一化。");
        }

        return self::SUCCESS;
    }

    private function processTable(
        string $label,
        string $modelClass,
        MediaUrlNormalizer $normalizer,
        bool $dry,
        int &$tableTotal,
        int &$changedTotal,
    ): void {
        $key = (new $modelClass)->getKeyName();
        $ids = $modelClass::query()->whereNotNull('content')->pluck($key);

        foreach ($ids->chunk(200) as $chunk) {
            $models = $modelClass::whereIn($key, $chunk)->get();

            foreach ($models as $model) {
                $tableTotal++;
                $before = $model->content;
                $after = $normalizer->normalizeContent(is_array($before) ? $before : []);

                if ($before === $after) {
                    continue;
                }

                if (! $dry) {
                    $model->content = $after;
                    // saveQuietly：跳过 saving 钩子（钩子做的是同一件事，避免重复遍历）
                    $model->saveQuietly();
                }

                $changedTotal++;
            }
        }

        $this->line("{$label}：{$tableTotal} 条已处理");
    }
}
