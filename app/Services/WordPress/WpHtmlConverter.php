<?php

namespace App\Services\WordPress;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;
use Illuminate\Support\Str;

/**
 * 将 WordPress 块编辑器正文（含 <!-- wp:xxx --> 标记的 HTML）转换为本项目
 * 使用的 BlockNote 块结构 JSON（Block[]），并顺带把外部资源 URL 重写为本地地址。
 *
 * 支持块类型：paragraph、heading、code、preformatted、verse、list、quote、
 * pullquote、table、separator、image、file、details、group、columns、column、
 * buttons/button、html、footnotes、argon/collapse、argon/alert。
 * 未知块按"保留嵌套块、散落 HTML 降级为段落"处理。
 */
final class WpHtmlConverter
{
    /**
     * WordPress / highlight.js 语言名 → 本项目编辑器语言键。
     * 未列出的语言回退为 text（纯文本）。
     *
     * @var array<string, string>
     */
    private const LANGUAGES = [
        'text' => 'text', 'plaintext' => 'text', 'txt' => 'text',
        'javascript' => 'javascript', 'js' => 'javascript', 'node' => 'javascript',
        'typescript' => 'typescript', 'ts' => 'typescript',
        'jsx' => 'jsx', 'react' => 'jsx', 'tsx' => 'tsx',
        'html' => 'html', 'xml' => 'html', 'svg' => 'html',
        'css' => 'css', 'json' => 'json',
        'python' => 'python', 'py' => 'python',
        'bash' => 'bash', 'sh' => 'bash', 'shell' => 'bash', 'zsh' => 'bash', 'console' => 'bash',
        'powershell' => 'powershell', 'pwsh' => 'powershell',
        'sql' => 'sql', 'go' => 'go', 'golang' => 'go',
        'rust' => 'rust', 'rs' => 'rust', 'java' => 'java', 'c' => 'c',
        'cpp' => 'cpp', 'c++' => 'cpp', 'cc' => 'cpp',
        'csharp' => 'csharp', 'c#' => 'csharp', 'cs' => 'csharp',
        'php' => 'php', 'ruby' => 'ruby', 'rb' => 'ruby',
        'yaml' => 'yaml', 'yml' => 'yaml',
        'markdown' => 'markdown', 'md' => 'markdown', 'diff' => 'diff',
    ];

    /**
     * @param  callable(string $url): string  $rewriteUrl  资源 URL 重写（图片/文件/链接）
     * @param  array<int, string>  $attachmentUrls  WP 附件 ID → 本地 URL（wp:file 块引用）
     */
    public function __construct(
        /** @var (callable(string): string)|null */
        private readonly mixed $rewriteUrl = null,
        private readonly array $attachmentUrls = [],
    ) {}

    /**
     * 转换整篇 WP 块 HTML 为 BlockNote 块数组。
     *
     * @return array<int, array<string, mixed>>
     */
    public function convert(string $wpHtml): array
    {
        return $this->renderNodes($this->buildTree($wpHtml));
    }

    /**
     * 将不含块标记的 HTML 片段转为行内内容项（用于摘要等短文本）。
     *
     * @return array<int, array<string, mixed>>
     */
    public function convertInline(string $html): array
    {
        $items = $this->inlineItems($this->domFragment($html)->documentElement);

        return $this->mergeConsecutiveText($items);
    }

    /**
     * 归一化代码块语言：未知语言返回 text。
     */
    public function normalizeLanguage(string $language): string
    {
        $key = Str::lower(trim($language));

        return self::LANGUAGES[$key] ?? 'text';
    }

    // ------------------------------------------------------------------
    // 块树构建
    // ------------------------------------------------------------------

    /**
     * 把 WP 正文切分为节点序列：{kind: text, text} 与 {kind: node, node: [type, attrs, body]}。
     * 嵌套块（如 quote 内的 paragraph）归入父块 body。
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildTree(string $html): array
    {
        $pattern = '/<!--\s*wp:(?<type>[a-z\/]+)(?<attrs>\s+\{.*?\})?\s*(?:\/)?-->|<!--\s*\/wp:(?<close>[a-z\/]+)\s*-->/s';
        $nodes = [];
        $stack = [];
        $last = 0;

        if (preg_match_all($pattern, $html, $m, PREG_OFFSET_CAPTURE | PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $whole = trim($match[0][0]);
                // PREG_SET_ORDER 中未命中分支的分组是空串而非缺失，按标记文本判断开/闭
                $open = ! str_starts_with($whole, '<!-- /');
                $position = $match[0][1];
                $length = strlen($match[0][0]);
                $type = $open ? trim((string) ($match['type'][0] ?? '')) : trim((string) ($match['close'][0] ?? ''));
                $attrs = $open ? $this->parseAttrs($match['attrs'][0] ?? '') : [];
                $selfClosing = $open && str_ends_with($whole, '/-->');

                $text = $this->trimNewlines(substr($html, $last, $position - $last));
                if ($text !== '') {
                    if (count($stack) > 0) {
                        $stack[count($stack) - 1]['body'][] = ['kind' => 'text', 'text' => $text];
                    } else {
                        $nodes[] = ['kind' => 'text', 'text' => $text];
                    }
                }

                $last = $position + $length;

                if ($open && ! $selfClosing) {
                    $stack[] = ['type' => $type, 'attrs' => $attrs, 'body' => []];
                } elseif ($open) {
                    $this->appendNode($nodes, $stack, ['type' => $type, 'attrs' => $attrs, 'body' => []]);
                } else {
                    $node = count($stack) > 0 ? array_pop($stack) : ['type' => $type, 'attrs' => [], 'body' => []];
                    $this->appendNode($nodes, $stack, $node);
                }
            }
        }

        $text = $this->trimNewlines(substr($html, $last));
        if ($text !== '') {
            if (count($stack) > 0) {
                $stack[count($stack) - 1]['body'][] = ['kind' => 'text', 'text' => $text];
            } else {
                $nodes[] = ['kind' => 'text', 'text' => $text];
            }
        }

        // 未闭合的块（数据不完整）按叶子块处理
        while (count($stack) > 0) {
            $nodes[] = ['kind' => 'node', 'node' => array_pop($stack)];
        }

        return $nodes;
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function appendNode(array &$nodes, array &$stack, array $node): void
    {
        if (count($stack) > 0) {
            $stack[count($stack) - 1]['body'][] = ['kind' => 'node', 'node' => $node];
        } else {
            $nodes[] = ['kind' => 'node', 'node' => $node];
        }
    }

    /**
     * WP 块属性为单层扁平 JSON 对象。
     *
     * @return array<string, mixed>
     */
    private function parseAttrs(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function trimNewlines(string $text): string
    {
        return trim($text, " \t\r\n");
    }

    // ------------------------------------------------------------------
    // 块渲染分发
    // ------------------------------------------------------------------

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function renderNodes(array $items): array
    {
        $blocks = [];

        foreach ($items as $item) {
            if ($item['kind'] === 'text') {
                $paragraph = $this->htmlToParagraph($item['text']);
                if ($paragraph !== null) {
                    $blocks[] = $paragraph;
                }

                continue;
            }

            foreach ($this->renderNode($item['node']) as $block) {
                $blocks[] = $block;
            }
        }

        return $blocks;
    }

    /**
     * @param  array<string, mixed>  $node
     * @return array<int, array<string, mixed>>
     */
    private function renderNode(array $node): array
    {
        $type = (string) $node['type'];
        $attrs = $node['attrs'] ?? [];
        $body = $node['body'] ?? [];

        return match ($type) {
            'paragraph' => $this->renderParagraphNode($body),
            'heading' => $this->renderHeadingNode($attrs, $body),
            'code' => $this->renderCodeNode($attrs, $body),
            'preformatted', 'verse' => $this->renderPlainTextNode($body),
            'list' => $this->renderListNode($attrs, $body),
            'quote', 'pullquote' => $this->renderQuoteNode($attrs, $body),
            'table' => $this->renderTableNode($body),
            'separator' => [$this->makeBlock('divider', [])],
            'image' => $this->renderImageNode($attrs, $body),
            'file' => $this->renderFileNode($attrs, $body),
            'details' => $this->renderDetailsNode($body),
            'group', 'columns', 'column', 'buttons' => $this->renderContainerNode($body),
            'button' => $this->renderButtonNode($body),
            'html' => $this->renderHtmlNode($body),
            'footnotes' => [],
            'argon/collapse' => $this->renderArgonCollapse($attrs),
            'argon/alert' => $this->renderArgonAlert($attrs),
            default => $this->renderUnknownNode($body),
        };
    }

    /**
     * 容器块（group/columns/...）：嵌套块保留，散落 HTML 转段落。
     *
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderContainerNode(array $body): array
    {
        $blocks = [];

        foreach ($body as $item) {
            if ($item['kind'] === 'text') {
                $paragraph = $this->htmlToParagraph($item['text']);
                if ($paragraph !== null) {
                    $blocks[] = $paragraph;
                }

                continue;
            }

            foreach ($this->renderNode($item['node']) as $block) {
                $blocks[] = $block;
            }
        }

        return $blocks;
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderParagraphNode(array $body): array
    {
        $block = $this->htmlToParagraph($this->bodyText($body));

        return $block === null ? [] : [$block];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderHeadingNode(array $attrs, array $body): array
    {
        $items = $this->inlineItems($this->domFragment($this->bodyText($body))->documentElement);

        if (count($items) === 0) {
            return [];
        }

        $level = min(max((int) ($attrs['level'] ?? 2), 1), 6);
        $block = $this->makeBlock('heading', $this->defaultTextProps(), $items);
        $block['props']['level'] = $level;

        return [$block];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderCodeNode(array $attrs, array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $pre = $doc->getElementsByTagName('pre')->item(0);
        $text = trim((string) ($pre !== null ? $pre->textContent : $doc->documentElement->textContent));

        if ($text === '') {
            return [];
        }

        $language = (string) ($attrs['language'] ?? '');
        if ($language === '') {
            // WP 有时把语言写在 <code class="language-xxx"> 上
            $code = $doc->getElementsByTagName('code')->item(0);
            if ($code !== null && preg_match('/language-([a-z0-9+#]+)/i', (string) $code->getAttribute('class'), $m)) {
                $language = $m[1];
            }
        }

        return [$this->codeBlock($text, $language)];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderPlainTextNode(array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $pre = $doc->getElementsByTagName('pre')->item(0);
        $text = trim((string) ($pre !== null ? $pre->textContent : $doc->documentElement->textContent));

        if ($text === '') {
            return [];
        }

        return [$this->codeBlock($text, 'text')];
    }

    /**
     * 列表块：块内嵌套子块（如列表里插 details）作为 li 的子块保留。
     *
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderListNode(array $attrs, array $body): array
    {
        $ordered = ($attrs['ordered'] ?? false) === true || ($attrs['ordered'] ?? '') === 'true';
        $listItems = [];

        foreach ($body as $item) {
            if ($item['kind'] === 'text') {
                $listItems = array_merge(
                    $listItems,
                    $this->renderDomList(
                        $this->firstListElement($this->domFragment($item['text'])),
                        $ordered,
                    ),
                );

                continue;
            }

            // 列表内的嵌套块：先挂到上一个 li 的子块上
            if (count($listItems) > 0 && $listItems[count($listItems) - 1]['type'] === ($ordered ? 'numberedListItem' : 'bulletListItem')) {
                $parent = &$listItems[count($listItems) - 1];
                foreach ($this->renderNode($item['node']) as $block) {
                    $parent['children'][] = $block;
                }
                unset($parent);
            } else {
                foreach ($this->renderNode($item['node']) as $block) {
                    $listItems[] = $block;
                }
            }
        }

        return $listItems;
    }

    /**
     * 从 HTML 片段中取第一个列表元素。
     */
    private function firstListElement(DOMDocument $doc): ?DOMElement
    {
        return $doc->getElementsByTagName('ul')->item(0) ?? $doc->getElementsByTagName('ol')->item(0);
    }

    /**
     * 解析 <ul>/<ol> 元素为列表项块。
     *
     * @return array<int, array<string, mixed>>
     */
    private function renderDomList(?DOMElement $list, bool $ordered): array
    {
        if ($list === null) {
            return [];
        }

        $type = $ordered ? 'numberedListItem' : 'bulletListItem';
        $items = [];

        foreach ($list->childNodes as $li) {
            if (! $li instanceof DOMElement || $li->tagName !== 'li') {
                continue;
            }

            [$inline, $children] = $this->splitListItem($li);

            if (count($inline) === 0 && count($children) === 0) {
                continue;
            }

            $items[] = $this->makeBlock($type, $this->defaultTextProps(), $inline, $children);
        }

        return $items;
    }

    /**
     * 拆分 <li>：直接行内内容 → 行内项；嵌套列表/图片/段落 → 子块。
     *
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function splitListItem(DOMElement $li): array
    {
        $inline = [];
        $children = [];

        foreach ($li->childNodes as $child) {
            [$partInline, $partBlocks] = $this->collectNode($child, []);
            $inline = array_merge($inline, $partInline);
            $children = array_merge($children, $partBlocks);
        }

        return [$this->mergeConsecutiveText($inline), $children];
    }

    /**
     * 收集单个节点产生的行内项与子块。
     *
     * @param  array<int, array<string, mixed>>  $styles
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function collectNode(DOMNode $node, array $styles): array
    {
        if ($node instanceof DOMText) {
            $text = (string) $node->nodeValue;

            return [trim($text) !== '' ? [$this->textItem($text, $styles)] : [], []];
        }

        if (! $node instanceof DOMElement) {
            return [[], []];
        }

        switch ($node->tagName) {
            case 'strong':
            case 'b':
                return $this->walkChildren($node, $this->withStyle($styles, 'bold'));
            case 'em':
            case 'i':
                return $this->walkChildren($node, $this->withStyle($styles, 'italic'));
            case 'code':
                return $this->walkChildren($node, $this->withStyle($styles, 'code'));
            case 'u':
                return $this->walkChildren($node, $this->withStyle($styles, 'underline'));
            case 's':
            case 'strike':
            case 'del':
                return $this->walkChildren($node, $this->withStyle($styles, 'strike'));
            case 'a':
                $href = $this->rewrite((string) $node->getAttribute('href'));
                // 只遍历 <a> 的子节点取行内内容，避免回到本分支造成无限递归
                [$inner, $innerBlocks] = $this->walkChildren($node, $styles);

                if ($href !== '') {
                    return [count($inner) > 0
                        ? [['type' => 'link', 'href' => $href, 'content' => $inner]]
                        : [$this->textItem($href, $styles)], []];
                }

                return [$inner, $innerBlocks];
            case 'br':
                return [[$this->textItem("\n", $styles)], []];
            case 'p':
                // 直接展开段落子节点为行内内容（避免 htmlToParagraph → 本分支 的无限递归）
                return $this->walkChildren($node, $styles);
            case 'ul':
            case 'ol':
                return [[], $this->renderDomList($node, $node->tagName === 'ol')];
            case 'figure':
            case 'img':
                $image = $this->imageFromNode($node);

                return [[], $image === null ? [] : [$image]];
            default:
                return $this->walkChildren($node, $styles);
        }
    }

    /**
     * 遍历元素子节点，返回（未合并的）行内项与子块。
     *
     * @param  array<int, array<string, mixed>>  $styles
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function walkChildren(DOMElement $element, array $styles): array
    {
        $inline = [];
        $children = [];

        foreach ($element->childNodes as $child) {
            [$partInline, $partBlocks] = $this->collectNode($child, $styles);
            $inline = array_merge($inline, $partInline);
            $children = array_merge($children, $partBlocks);
        }

        return [$inline, $children];
    }

    /**
     * @param  array<int, array<string, mixed>>  $styles
     */
    private function withStyle(array $styles, string $name): array
    {
        $styles[$name] = true;

        return $styles;
    }

    /**
     * 从元素内提取行内内容（如 <a>、<summary> 的内部）。
     *
     * @return array<int, array<string, mixed>>
     */
    private function inlineItems(DOMNode $node, bool $forceBold = false): array
    {
        $element = $node instanceof DOMElement
            ? $node
            : $this->domFragment('<div>'.$this->nodeHtml($node).'</div>')->documentElement;

        return $this->mergeConsecutiveText($this->collectNode($element, $forceBold ? ['bold' => true] : [])[0]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderQuoteNode(array $attrs, array $body): array
    {
        $children = $this->renderContainerNode($body);

        // 归属标注（WP quote 的 citation 属性或 <cite> 元素）
        $citation = trim((string) ($attrs['citation'] ?? ''));
        if ($citation === '') {
            $doc = $this->domFragment($this->bodyText($body));
            foreach ($doc->getElementsByTagName('cite') as $cite) {
                $citation = trim((string) $cite->textContent);
                break;
            }
        }

        if ($citation !== '') {
            $children[] = $this->makeBlock('paragraph', $this->defaultTextProps(), [
                $this->textItem('—— '.$citation),
            ]);
        }

        if (count($children) === 0) {
            return [];
        }

        $quote = $this->makeBlock('quote', ['backgroundColor' => 'default', 'textColor' => 'default']);
        $quote['children'] = $children;

        return [$quote];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderTableNode(array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $table = $doc->getElementsByTagName('table')->item(0);

        if ($table === null) {
            return [];
        }

        $headerRows = $doc->getElementsByTagName('thead')->count() > 0 ? 1 : 0;
        $rows = [];
        $columns = 0;

        foreach ($table->getElementsByTagName('tr') as $tr) {
            $cells = [];

            foreach ($tr->childNodes as $cell) {
                if (! $cell instanceof DOMElement || ! in_array($cell->tagName, ['td', 'th'], true)) {
                    continue;
                }

                $cells[] = [
                    'type' => 'tableCell',
                    'content' => $this->inlineItems($cell, $cell->tagName === 'th'),
                    'props' => [
                        'colspan' => (int) $cell->getAttribute('colspan') ?: 1,
                        'rowspan' => (int) $cell->getAttribute('rowspan') ?: 1,
                        'backgroundColor' => 'default',
                        'textColor' => 'default',
                        'textAlignment' => 'left',
                    ],
                ];

                $columns = max($columns, count($cells));
            }

            if (count($cells) > 0) {
                $rows[] = ['cells' => $cells];
            }
        }

        if (count($rows) === 0) {
            return [];
        }

        $block = $this->makeBlock('table', ['textColor' => 'default']);
        $block['content'] = [
            'type' => 'tableContent',
            'columnWidths' => array_fill(0, $columns, null),
            'headerRows' => $headerRows,
            'rows' => $rows,
        ];

        $blocks = [$block];

        $caption = null;
        foreach ($doc->getElementsByTagName('figcaption') as $fig) {
            $caption = trim((string) $fig->textContent);
            break;
        }

        if ($caption !== null && $caption !== '') {
            $blocks[] = $this->makeBlock('paragraph', $this->defaultTextProps(), [
                ['type' => 'text', 'text' => $caption, 'styles' => ['bold' => true]],
            ]);
        }

        return $blocks;
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderImageNode(array $attrs, array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $img = $doc->getElementsByTagName('img')->item(0);

        if ($img === null) {
            // 只有属性没有 HTML（如 wp:image {"url":"..."}）
            if (isset($attrs['url'])) {
                $block = $this->makeBlock('image', ['url' => $this->rewrite((string) $attrs['url'])]);
                $this->applyImageCaption($block, $attrs, $doc);

                return [$block];
            }

            return [];
        }

        $url = $this->rewrite((string) $img->getAttribute('src'));
        if ($url === '') {
            return [];
        }

        $block = $this->makeBlock('image', ['url' => $url]);

        if (($alt = trim((string) $img->getAttribute('alt'))) !== '') {
            $block['props']['alt'] = $alt;
        }

        $this->applyImageCaption($block, $attrs, $doc);

        return [$block];
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @param  array<string, mixed>  $block
     */
    private function applyImageCaption(array $attrs, array &$block, DOMDocument $doc): void
    {
        $caption = trim((string) ($attrs['caption'] ?? ''));

        if ($caption === '') {
            foreach ($doc->getElementsByTagName('figcaption') as $fig) {
                $caption = trim((string) $fig->textContent);
                break;
            }
        }

        if ($caption !== '') {
            $block['props']['caption'] = $caption;
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderFileNode(array $attrs, array $body): array
    {
        // wp:file {"id":N} 自包含块：通过附件映射取本地 URL
        if (isset($attrs['id']) && isset($this->attachmentUrls[(int) $attrs['id']])) {
            $url = (string) $this->attachmentUrls[(int) $attrs['id']];
            $name = pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_BASENAME);

            return [$this->makeBlock('file', ['url' => $url, 'name' => $name])];
        }

        $doc = $this->domFragment($this->bodyText($body));
        $link = $doc->getElementsByTagName('a')->item(0);

        if ($link === null) {
            return [];
        }

        $url = $this->rewrite((string) $link->getAttribute('href'));
        if ($url === '') {
            return [];
        }

        $name = trim((string) $link->getAttribute('download'));
        if ($name === '') {
            $name = pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_BASENAME);
        }

        return [$this->makeBlock('file', ['url' => $url, 'name' => $name])];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderDetailsNode(array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $blocks = [];

        foreach ($doc->getElementsByTagName('summary') as $summary) {
            $items = $this->inlineItems($summary);
            if (count($items) > 0) {
                $blocks[] = $this->makeBlock('paragraph', $this->defaultTextProps(), $items);
            }
        }

        foreach ($this->renderContainerNode($body) as $block) {
            $blocks[] = $block;
        }

        return $blocks;
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderButtonNode(array $body): array
    {
        $doc = $this->domFragment($this->bodyText($body));
        $link = $doc->getElementsByTagName('a')->item(0);

        if ($link === null || trim((string) $link->textContent) === '') {
            return [];
        }

        $url = $this->rewrite((string) $link->getAttribute('href'));

        return [$this->makeBlock('paragraph', $this->defaultTextProps(), [
            ['type' => 'link', 'href' => $url, 'content' => [$this->textItem(trim((string) $link->textContent))]],
        ])];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderHtmlNode(array $body): array
    {
        $html = $this->bodyText($body);
        $doc = $this->domFragment($html);

        // 内嵌代码：<pre><code class="language-x">
        $pre = $doc->getElementsByTagName('pre')->item(0);
        if ($pre !== null) {
            $code = $doc->getElementsByTagName('code')->item(0) ?? $pre;
            $language = 'text';
            if (preg_match('/language-([a-z0-9+#]+)/i', (string) $code->getAttribute('class'), $m)) {
                $language = $m[1];
            }
            $text = (string) $code->textContent;

            return $text === '' ? [] : [$this->codeBlock($text, $language)];
        }

        // 嵌入播放器等：<iframe> 降级为链接段落
        $iframe = $doc->getElementsByTagName('iframe')->item(0);
        if ($iframe !== null) {
            $src = (string) $iframe->getAttribute('src');
            if ($src === '') {
                return [];
            }
            if (str_starts_with($src, '//')) {
                $src = 'https:'.$src;
            }

            return [$this->makeBlock('paragraph', $this->defaultTextProps(), [
                ['type' => 'link', 'href' => $src, 'content' => [$this->textItem($src)]],
            ])];
        }

        // 其它裸 HTML：保留纯文本
        $text = trim((string) $doc->documentElement->textContent);

        return $text === '' ? [] : [$this->makeBlock('paragraph', $this->defaultTextProps(), [$this->textItem($text)])];
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @return array<int, array<string, mixed>>
     */
    private function renderArgonCollapse(array $attrs): array
    {
        $blocks = [];
        $title = trim((string) ($attrs['title'] ?? ''));

        if ($title !== '') {
            $blocks[] = $this->makeBlock('paragraph', $this->defaultTextProps(), [
                ['type' => 'text', 'text' => $title, 'styles' => ['bold' => true]],
            ]);
        }

        $content = trim((string) ($attrs['content'] ?? ''));
        if ($content !== '') {
            $blocks[] = $this->makeBlock('paragraph', $this->defaultTextProps(), $this->convertInline($content));
        }

        return $blocks;
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @return array<int, array<string, mixed>>
     */
    private function renderArgonAlert(array $attrs): array
    {
        $content = trim((string) ($attrs['content'] ?? ''));

        if ($content === '') {
            return [];
        }

        return [$this->makeBlock('paragraph', $this->defaultTextProps(), $this->convertInline($content))];
    }

    /**
     * 未知块：嵌套块保留，散落 HTML 降级为段落。
     *
     * @param  array<int, array<string, mixed>>  $body
     * @return array<int, array<string, mixed>>
     */
    private function renderUnknownNode(array $body): array
    {
        return $this->renderContainerNode($body);
    }

    // ------------------------------------------------------------------
    // 段落/行内
    // ------------------------------------------------------------------

    /**
     * 将散落 HTML 片段转段落块；无可见内容时返回 null。
     *
     * @return array<string, mixed>|null
     */
    private function htmlToParagraph(string $html): ?array
    {
        $items = $this->inlineItems($this->domFragment($html)->documentElement);
        $text = $this->inlineTextOf($items);

        if (count($items) === 0 || (trim($text) === '' && ! $this->hasLinkItems($items))) {
            return null;
        }

        return $this->makeBlock('paragraph', $this->defaultTextProps(), $items);
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function inlineTextOf(array $items): string
    {
        $text = '';
        foreach ($items as $item) {
            $text .= match ($item['type'] ?? '') {
                'text' => (string) ($item['text'] ?? ''),
                'link' => $this->inlineTextOf($item['content'] ?? []),
                default => '',
            };
        }

        return $text;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function hasLinkItems(array $items): bool
    {
        foreach ($items as $item) {
            if (($item['type'] ?? '') === 'link' && count($item['content'] ?? []) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * 从 figure/img 节点构造 image 块。
     *
     * @return array<string, mixed>|null
     */
    private function imageFromNode(DOMNode $node): ?array
    {
        if ($node instanceof DOMElement && $node->tagName === 'img') {
            $url = $this->rewrite((string) $node->getAttribute('src'));
            $block = $this->makeBlock('image', ['url' => $url]);
        } else {
            $html = $this->elementHtml($node instanceof DOMElement ? $node : $this->nodeHtml($node));
            $doc = $this->domFragment($html);
            $img = $doc->getElementsByTagName('img')->item(0);

            if ($img === null) {
                return null;
            }

            $url = $this->rewrite((string) $img->getAttribute('src'));
            $block = $this->makeBlock('image', ['url' => $url]);

            if (($alt = trim((string) $img->getAttribute('alt'))) !== '') {
                $block['props']['alt'] = $alt;
            }

            foreach ($doc->getElementsByTagName('figcaption') as $fig) {
                $caption = trim((string) $fig->textContent);
                if ($caption !== '') {
                    $block['props']['caption'] = $caption;
                }
                break;
            }

            return $url === '' ? null : $block;
        }

        return $url === '' ? null : $block;
    }

    // ------------------------------------------------------------------
    // 块/项构造
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function makeBlock(string $type, array $props, array $content = [], array $children = []): array
    {
        return [
            'id' => (string) Str::uuid(),
            'type' => $type,
            'props' => $props,
            'content' => $type === 'divider' ? null : $content,
            'children' => $children,
        ];
    }

    private function codeBlock(string $code, string $language): array
    {
        return $this->makeBlock('codeBlock', ['language' => $this->normalizeLanguage($language)], [
            $this->textItem($code),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function textItem(string $text, array $styles = []): array
    {
        $item = ['type' => 'text', 'text' => $text];
        $styles = array_filter($styles);

        if (count($styles) > 0) {
            $item['styles'] = $styles;
        }

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultTextProps(): array
    {
        return [
            'backgroundColor' => 'default',
            'textColor' => 'default',
            'textAlignment' => 'left',
        ];
    }

    // ------------------------------------------------------------------
    // 工具
    // ------------------------------------------------------------------

    /**
     * 拼接节点 body 内的散落文本段。
     *
     * @param  array<int, array<string, mixed>>  $body
     */
    private function bodyText(array $body): string
    {
        $parts = [];
        foreach ($body as $item) {
            if ($item['kind'] === 'text') {
                $parts[] = $item['text'];
            }
        }

        return implode("\n", $parts);
    }

    /**
     * 连续同样式文本合并。
     *
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private function mergeConsecutiveText(array $items): array
    {
        $merged = [];

        foreach ($items as $item) {
            $last = end($merged);
            if (
                is_array($last)
                && ($last['type'] ?? '') === 'text'
                && ($item['type'] ?? '') === 'text'
                && ($last['styles'] ?? []) === ($item['styles'] ?? [])
            ) {
                $last['text'] .= $item['text'];
                $merged[count($merged) - 1] = $last;

                continue;
            }

            $item['styles'] ??= [];
            $merged[] = $item;
        }

        return $merged;
    }

    private function domFragment(string $html): DOMDocument
    {
        $doc = new DOMDocument('1.0', 'UTF-8');

        // libxml 对 WP 产生的残缺 HTML（如未闭合标签）会告警，这里静默处理
        $useInternalErrors = libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<?xml encoding="utf-8"?><!DOCTYPE html><html><body><div>'.$html.'</div></body></html>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOWARNING | LIBXML_NOERROR,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($useInternalErrors);

        return $doc;
    }

    /**
     * 序列化 DOM 元素为 HTML 片段。
     */
    private function elementHtml(DOMElement $element): string
    {
        $html = $element->ownerDocument !== null
            ? $element->ownerDocument->saveHTML($element)
            : DOMDocument::saveHTML($element);

        return $html === false ? $this->nodeHtml($element) : $html;
    }

    private function nodeHtml(DOMNode $node): string
    {
        if ($node instanceof DOMElement) {
            return $this->elementHtml($node);
        }

        return htmlspecialchars((string) ($node->nodeValue ?? ''), ENT_QUOTES, 'UTF-8');
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function rewrite(string $url): string
    {
        if ($url === '' || $this->rewriteUrl === null) {
            return $url;
        }

        return ($this->rewriteUrl)($url);
    }
}
