<?php

namespace App\Services\WordPress;

use Illuminate\Support\Str;

/**
 * 将本项目 BlockNote 块结构（Block[]）反向转换为 WordPress 块编辑器 HTML
 * （含 <!-- wp:xxx --> 标记），用于 WordPress 导出，与 WpHtmlConverter 互为逆操作。
 *
 * 仅覆盖本项目编辑器支持的块类型；未知块保留其嵌套块，行内内容降级为段落。
 */
final class BlockNoteToWpHtml
{
    /**
     * 编辑器语言键 → WP 代码块语言名（取 WP 侧可识别的写法）。
     *
     * @var array<string, string>
     */
    private const EXPORT_LANGUAGES = [
        'text' => 'text',
        'javascript' => 'javascript',
        'typescript' => 'typescript',
        'jsx' => 'jsx',
        'tsx' => 'tsx',
        'html' => 'html',
        'css' => 'css',
        'json' => 'json',
        'python' => 'python',
        'bash' => 'bash',
        'powershell' => 'powershell',
        'sql' => 'sql',
        'go' => 'go',
        'rust' => 'rust',
        'java' => 'java',
        'c' => 'c',
        'cpp' => 'c++',
        'csharp' => 'csharp',
        'php' => 'php',
        'ruby' => 'ruby',
        'yaml' => 'yaml',
        'markdown' => 'markdown',
        'diff' => 'diff',
    ];

    /**
     * 转换整篇 BlockNote 块数组为 WP 块 HTML。
     *
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public function convert(array $blocks): string
    {
        $parts = [];
        $index = 0;

        while ($index < count($blocks)) {
            $type = (string) ($blocks[$index]['type'] ?? '');

            // 连续同类列表项归组到同一个 <ul>/<ol>
            if (in_array($type, ['bulletListItem', 'numberedListItem'], true)) {
                $group = [];
                while ($index < count($blocks) && (string) ($blocks[$index]['type'] ?? '') === $type) {
                    $group[] = $blocks[$index];
                    $index++;
                }
                $parts[] = $this->listBlock($type === 'numberedListItem', $group);

                continue;
            }

            $parts[] = $this->blockToHtml($blocks[$index]);
            $index++;
        }

        return implode("\n\n", array_filter($parts, fn (string $part) => $part !== ''));
    }

    /**
     * @param  array<string, mixed>  $block
     */
    private function blockToHtml(array $block): string
    {
        $type = (string) ($block['type'] ?? '');
        $props = $block['props'] ?? [];
        $inner = $this->childrenToWpBlocks($block['children'] ?? []);

        switch ($type) {
            case 'paragraph':
                return $this->wrapped('paragraph', $this->inlineHtml($block['content'] ?? []));
            case 'heading':
                $level = min(max((int) ($props['level'] ?? 1), 1), 6);

                return $this->wrapped('heading', ['level' => $level],
                    '<h'.$level.'>'.$this->inlineHtml($block['content'] ?? []).'</h'.$level.'>');
            case 'codeBlock':
                $language = $this->exportLanguage((string) ($props['language'] ?? 'text'));
                $attrs = $language === 'text' ? '' : ['language' => $language];

                return $this->wrapped('code', $attrs,
                    '<pre class="wp-block-code"><code>'.htmlspecialchars($this->codeText($block['content']), ENT_QUOTES, 'UTF-8').'</code></pre>');
            case 'bulletListItem':
            case 'numberedListItem':
                return $this->listBlock($type === 'numberedListItem', [$block]);
            case 'quote':
                return $this->wrapped('quote', '<blockquote>'.$inner.'</blockquote>');
            case 'image':
                return $this->imageHtml($props);
            case 'file':
                return $this->fileHtml($props);
            case 'table':
                return $this->tableHtml($block);
            case 'divider':
                return $this->wrapped('separator', '<hr class="wp-block-separator has-alpha-channel-opacity"/>');
            case 'checkListItem':
                return $this->wrapped('paragraph', ($props['checked'] ? '☑ ' : '☐ ').$this->inlineHtml($block['content'] ?? []));
            default:
                // 未知块：降级为段落 + 保留嵌套块
                $text = $this->inlineHtml($block['content'] ?? []);
                $html = $text !== '' ? '<p>'.$text.'</p>' : '';

                return $this->wrapped($type !== '' ? $type : 'paragraph', $html.$inner);
        }
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function imageHtml(array $props): string
    {
        $url = (string) ($props['url'] ?? '');
        if ($url === '') {
            return '';
        }

        $alt = htmlspecialchars((string) ($props['alt'] ?? ''), ENT_QUOTES, 'UTF-8');
        $caption = (string) ($props['caption'] ?? '');

        $figure = '<figure class="wp-block-image">'
            .'<img src="'.htmlspecialchars($url, ENT_QUOTES, 'UTF-8').'" alt="'.($alt !== '' ? $alt : $caption).'" />'
            .($caption !== '' ? '<figcaption class="wp-element-caption">'.htmlspecialchars($caption, ENT_QUOTES, 'UTF-8').'</figcaption>' : '')
            .'</figure>';

        $attrs = ['url' => $url] + ($caption !== '' ? ['caption' => $caption] : []);

        return $this->wrapped('image', $attrs, $figure);
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function fileHtml(array $props): string
    {
        $url = (string) ($props['url'] ?? '');
        if ($url === '') {
            return '';
        }

        $name = (string) ($props['name'] ?? pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_BASENAME));

        $attrs = ['url' => $url] + ($name !== '' ? ['name' => $name] : []);
        $figure = '<figure class="wp-block-file"><a href="'.htmlspecialchars($url, ENT_QUOTES, 'UTF-8')
            .'" download="'.htmlspecialchars($name, ENT_QUOTES, 'UTF-8').'">'.htmlspecialchars($name, ENT_QUOTES, 'UTF-8').'</a></figure>';

        return $this->wrapped('file', $attrs, $figure);
    }

    /**
     * @param  array<string, mixed>  $block
     */
    private function tableHtml(array $block): string
    {
        $content = is_array($block['content'] ?? null) ? $block['content'] : [];
        $rows = $content['rows'] ?? [];
        $headerRows = (int) ($content['headerRows'] ?? 0);

        if (count($rows) === 0) {
            return '';
        }

        $head = '';
        $bodyRows = '';

        foreach (array_values($rows) as $rowIndex => $row) {
            $isHeader = $rowIndex < $headerRows;
            $tag = $isHeader ? 'th' : 'td';

            $cells = '';
            foreach ($row['cells'] ?? [] as $cell) {
                if (is_array($cell) && isset($cell['content'])) {
                    $inner = $this->inlineHtml($cell['content']);
                } elseif (is_array($cell) && isset($cell['rows'])) {
                    // 嵌套表：WP 表不支持嵌套，降级为空
                    $inner = '';
                } else {
                    $inner = htmlspecialchars((string) $cell, ENT_QUOTES, 'UTF-8');
                }
                $cells .= '<'.$tag.'>'.$inner.'</'.$tag.'>';
            }

            $tr = '<tr>'.$cells.'</tr>';

            if ($isHeader) {
                $head .= $tr;
            } else {
                $bodyRows .= $tr;
            }
        }

        $table = '<table>'
            .($head !== '' ? '<thead>'.$head.'</thead>' : '')
            .'<tbody>'.$bodyRows.'</tbody>'
            .'</table>';

        return $this->wrapped('table', '<figure class="wp-block-table">'.$table.'</figure>');
    }

    /**
     * 列表块：外层 <ul>/<ol>，嵌套子列表在 <li> 内保留。
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function listBlock(bool $ordered, array $items): string
    {
        $tag = $ordered ? 'ol' : 'ul';
        $lis = [];

        foreach ($items as $item) {
            $li = '<li>'.$this->inlineHtml($item['content'] ?? []);

            foreach ($item['children'] ?? [] as $child) {
                $childType = (string) ($child['type'] ?? '');
                if (in_array($childType, ['bulletListItem', 'numberedListItem'], true)) {
                    $li .= $this->listBlock($childType === 'numberedListItem', [$child]);
                } else {
                    $li .= $this->blockToHtml($child);
                }
            }

            $li .= '</li>';
            $lis[] = $li;
        }

        $html = '<'.$tag.'>'.implode('', $lis).'</'.$tag.'>';

        return $this->wrapped('list', $ordered ? ['ordered' => true] : [], $html);
    }

    /**
     * @param  array<int, array<string, mixed>>  $children
     */
    private function childrenToWpBlocks(array $children): string
    {
        $parts = [];
        foreach ($children as $child) {
            $parts[] = $this->blockToHtml($child);
        }

        return implode('', $parts);
    }

    /**
     * @param  array<string, mixed>|string  $attrsOrHtml  块属性，或直接传正文 HTML
     */
    private function wrapped(string $type, array|string $attrsOrHtml, ?string $html = null): string
    {
        if (is_string($attrsOrHtml)) {
            $html = $attrsOrHtml;
            $attrsOrHtml = [];
        }

        $type = Str::lower($type);
        $open = $this->openingMarker($type, is_array($attrsOrHtml) ? $attrsOrHtml : []);
        $body = $html ?? '';

        return $open.$body.'<!-- /wp:'.$type.' -->';
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function openingMarker(string $type, array|string $attrs = []): string
    {
        if (is_array($attrs) && count($attrs) > 0) {
            return '<!-- wp:'.$type.' '.json_encode($attrs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).' -->';
        }

        return '<!-- wp:'.$type.' -->';
    }

    /**
     * 行内内容 → HTML（text 带样式嵌套 / link）。
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function inlineHtml(array $items): string
    {
        $html = '';

        foreach ($items as $item) {
            $type = (string) ($item['type'] ?? 'text');

            if ($type === 'link') {
                $inner = $this->inlineHtml($item['content'] ?? []);
                $href = htmlspecialchars((string) ($item['href'] ?? ''), ENT_QUOTES, 'UTF-8');
                $html .= '<a href="'.$href.'" target="_blank" rel="noreferrer noopener">'.$inner.'</a>';

                continue;
            }

            if ($type !== 'text') {
                continue;
            }

            $text = htmlspecialchars((string) ($item['text'] ?? ''), ENT_QUOTES, 'UTF-8');
            $styles = $item['styles'] ?? [];

            // 换行
            $text = str_replace("\n", '<br/>', $text);

            // 样式由内向外嵌套：code > bold > italic > underline > strike
            $openTags = [];
            $closeTags = [];
            foreach (['code', 'bold', 'strong', 'italic', 'em', 'underline', 'u', 'strike', 's'] as $style) {
                if (! empty($styles[$style])) {
                    $openTags[] = '<'.$style.'>';
                    $closeTags[] = '</'.$style.'>';
                }
            }

            if (count($openTags) > 0) {
                $html .= implode('', $openTags).$text.implode('', array_reverse($closeTags));
            } else {
                $html .= $text;
            }
        }

        return $html;
    }

    /**
     * 提取代码块纯文本（忽略样式与链接包装）。
     *
     * @param  array<int, array<string, mixed>>|string|mixed  $content
     */
    private function codeText(mixed $content): string
    {
        if (is_string($content)) {
            return $content;
        }

        if (! is_array($content)) {
            return '';
        }

        $text = '';
        foreach ($content as $item) {
            if (is_string($item)) {
                $text .= $item;

                continue;
            }

            if (! is_array($item)) {
                continue;
            }

            $text .= match ((string) ($item['type'] ?? 'text')) {
                'text' => (string) ($item['text'] ?? ''),
                'link' => $this->codeText($item['content'] ?? []),
                default => '',
            };
        }

        return $text;
    }

    private function exportLanguage(string $language): string
    {
        return self::EXPORT_LANGUAGES[strtolower(trim($language))] ?? 'text';
    }
}
