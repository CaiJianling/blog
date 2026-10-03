<?php

namespace App\Console\Commands;

use App\Services\WordPress\WordPressExportService;
use Illuminate\Console\Command;

class WpExport extends Command
{
    protected $signature = 'wp:export {file : 导出 JSON 目标路径}';

    protected $description = '导出本项目的文章、页面、附件、评论与分类标签为 WordPress 兼容 JSON';

    public function handle(WordPressExportService $service): int
    {
        $file = $this->argument('file');
        $data = $service->export();

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        if (file_put_contents($file, $json) === false) {
            $this->error("写入失败：{$file}");

            return self::FAILURE;
        }

        $this->info(sprintf(
            '已导出：文章/页面/附件 %d / 评论 %d / 分类标签 %d / 关系 %d → %s（%.1f MB）',
            count($data['posts']),
            count($data['comments']),
            count($data['term_taxonomy']),
            count($data['term_relationships']),
            $file,
            strlen($json) / 1048576,
        ));

        return self::SUCCESS;
    }
}
