<?php

namespace App\Console\Commands;

use App\Services\WordPress\WordPressImportService;
use Illuminate\Console\Command;

class WpImport extends Command
{
    protected $signature = 'wp:import {file : 导出的 WordPress JSON 文件路径}
        {uploadsZip? : 媒体包 uploads.zip 路径（缺省取 JSON 同目录的 uploads.zip）}
        {--force : 忽略幂等标记强制重新执行}
        {--no-media : 跳过媒体包解压（仅导入数据库记录）}';

    protected $description = '导入 WordPress 导出的文章、附件、评论与分类标签';

    public function handle(WordPressImportService $service): int
    {
        $file = $this->argument('file');

        if (! is_file($file)) {
            $this->error("文件不存在：{$file}");

            return self::FAILURE;
        }

        $uploadsZip = $this->argument('uploadsZip');
        if ($uploadsZip === null) {
            $candidate = dirname($file).'/uploads.zip';
            $uploadsZip = is_file($candidate) ? $candidate : null;
        }

        if ((bool) $this->option('no-media')) {
            $uploadsZip = null;
        }

        $this->info('开始导入…');
        $report = $service->import($file, $uploadsZip, (bool) $this->option('force'));

        if ($report['already_imported']) {
            $this->warn('该导出文件已全部导入过，跳过（可用 --force 重新执行）。');

            return self::SUCCESS;
        }

        $this->line(sprintf(
            '完成：文章 %d / 页面 %d / 附件 %d / 评论 %d / 分类标签 %d / 关系 %d / 复制文件 %d / 缺文件 %d / 跳过 %d',
            $report['posts'],
            $report['pages'],
            $report['attachments'],
            $report['comments'],
            $report['terms'],
            $report['term_relationships'],
            $report['files_copied'],
            $report['files_missing'],
            $report['skipped'] ?? 0,
        ));

        return self::SUCCESS;
    }
}
