<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * 媒体 URL 归一器：把 BlockNote 正文中"本地媒体"的绝对地址重写为当前站点基址。
 *
 * 背景：文章/页面的 content 里，图片、文件块的 url 与链接的 href 是导入/保存时
 * 写死的绝对地址（形如 http://旧域名/storage/uploads/2021/12/x.jpg）。站点地址
 * 变更（换域名 / 改 APP_URL）后，需要把它们统一重写为新基址；外部链接保持不动。
 *
 * 唯一事实源：Storage::disk('public') 的 url（= APP_URL + '/storage'），
 * 与前台渲染附件 URL 的口径完全一致。
 */
final class MediaUrlNormalizer
{
    /**
     * 本地媒体 URL 的识别特征：任意 scheme/host 下的 /storage/uploads/ 路径。
     * 只匹配媒体基目录，避免误伤站点其它资源（如 build/）。
     *
     * @var string
     */
    public const MEDIA_PATH_PATTERN = '~^https?://[^/\s]+/storage/uploads/(.*?)([?#][^/]*)?$~i';

    /**
     * 当前媒体 URL 基址（无尾斜杠），例如 http://blog.local.host/storage/uploads
     */
    public function mediaBase(): string
    {
        return rtrim(Storage::disk('public')->url(''), '/').'/uploads';
    }

    /**
     * 重写单个 URL：本地媒体地址 → 当前基址；外部地址原样返回。
     */
    public function normalizeUrl(string $url): string
    {
        if ($url === '') {
            return $url;
        }

        if (preg_match(self::MEDIA_PATH_PATTERN, $url, $matches) !== 1) {
            return $url;
        }

        $path = $matches[1];
        $query = $matches[2] ?? '';

        $base = $this->mediaBase();

        return $path === ''
            ? $base
            : $base.'/'.$path.$query;
    }

    /**
     * 判断是否为本地媒体 URL。
     */
    public function isLocalMediaUrl(string $url): bool
    {
        return $url !== '' && preg_match(self::MEDIA_PATH_PATTERN, $url) === 1;
    }

    /**
     * 归一化整篇 BlockNote 正文：深度遍历所有块的 url/href 字段，
     * 仅重写本地媒体地址，其余（外部链接、文本、样式）原样保留。
     *
     * @param  array<array<string, mixed>>  $blocks  顶层块数组（content 字段解码后）
     * @return array<array<string, mixed>>
     */
    public function normalizeContent(array $blocks): array
    {
        $this->walkBlocks($blocks);

        return $blocks;
    }

    /**
     * 深度遍历块树。只处理已知的 URL 载体：
     *  - 任意块的 props.url / props.href（image、file、embed 等）
     *  - content 行内项的 href 及其嵌套 content（link）
     *  - table 的 content.rows[].cells[]（单元格内含行内项）
     *  - children（嵌套块）
     *
     * @param  array<int, array<string, mixed>>  $blocks
     */
    private function walkBlocks(array &$blocks): void
    {
        foreach ($blocks as &$block) {
            if (! is_array($block)) {
                continue;
            }

            if (isset($block['props'])) {
                foreach (['url', 'href'] as $key) {
                    if (isset($block['props'][$key]) && is_string($block['props'][$key])) {
                        $block['props'][$key] = $this->normalizeUrl($block['props'][$key]);
                    }
                }
            }

            if (isset($block['content']) && is_array($block['content'])) {
                $this->walkInline($block['content']);

                // 表格：单元格位于 content.rows[].cells[]
                if (($block['type'] ?? '') === 'table' && isset($block['content']['rows'])) {
                    $this->walkTableRows($block['content']['rows']);
                }
            }

            if (isset($block['children']) && is_array($block['children'])) {
                $this->walkBlocks($block['children']);
            }
        }

        unset($block);
    }

    /**
     * 遍历行内内容项（text / link）。
     *
     * @param  array<int, mixed>  $items
     */
    private function walkInline(array &$items): void
    {
        foreach ($items as &$item) {
            if (! is_array($item)) {
                continue;
            }

            if (isset($item['href']) && is_string($item['href'])) {
                $item['href'] = $this->normalizeUrl($item['href']);
            }

            // link 的行内内容嵌套在 content 中
            if (isset($item['content']) && is_array($item['content'])) {
                $this->walkInline($item['content']);
            }
        }

        unset($item);
    }

    /**
     * 遍历表格行（rows[].cells[].content 为行内项）。
     *
     * @param  array<int, mixed>  $rows
     */
    private function walkTableRows(array &$rows): void
    {
        foreach ($rows as &$row) {
            if (is_array($row) && isset($row['cells'])) {
                foreach ($row['cells'] as &$cell) {
                    if (is_array($cell) && isset($cell['content']) && is_array($cell['content'])) {
                        $this->walkInline($cell['content']);
                    }
                }
            }
        }

        unset($row);
    }
}
