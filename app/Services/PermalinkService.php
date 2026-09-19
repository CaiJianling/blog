<?php

namespace App\Services;

use App\Models\Article;
use App\Models\Option;
use App\Models\Page;

/**
 * 固定链接服务：按站点固定链接结构生成和解析文章 URL。
 *
 * 支持的标签：%year% %monthnum% %day% %hour% %minute% %second%
 *            %post_id% %postname% %category% %author%
 */
class PermalinkService
{
    /**
     * 常用固定链接结构预设。
     *
     * @var array<string, string>
     */
    public const PRESETS = [
        'plain' => '',
        'day' => '/%year%/%monthnum%/%day%/%postname%/',
        'month' => '/%year%/%monthnum%/%postname%/',
        'numeric' => '/archives/%post_id%',
        'postname' => '/%postname%/',
    ];

    /**
     * @var array<string, string>
     */
    private const TAG_PATTERNS = [
        '%year%' => '(?P<year>[0-9]{4})',
        '%monthnum%' => '(?P<monthnum>[0-9]{1,2})',
        '%day%' => '(?P<day>[0-9]{1,2})',
        '%hour%' => '(?P<hour>[0-9]{1,2})',
        '%minute%' => '(?P<minute>[0-9]{1,2})',
        '%second%' => '(?P<second>[0-9]{1,2})',
        '%post_id%' => '(?P<post_id>[0-9]+)',
        '%postname%' => '(?P<postname>[^/]+)',
        '%category%' => '(?P<category>[^/]+)',
        '%author%' => '(?P<author>[^/]+)',
    ];

    /**
     * 获取当前固定链接结构（如 /%post_id%.html）。
     */
    public function structure(): string
    {
        return (string) Option::get('permalink_structure', '/%post_id%.html');
    }

    /**
     * 获取当前结构的预设键名，自定义结构返回 'custom'。
     */
    public function presetKey(): string
    {
        $structure = $this->structure();

        foreach (self::PRESETS as $key => $preset) {
            if ($preset === $structure) {
                return $key;
            }
        }

        return 'custom';
    }

    /**
     * 生成文章的固定链接路径（以 / 开头，如 /3178.html）。
     */
    public function articlePath(Article $article): string
    {
        $structure = $this->structure();

        if ($structure === '') {
            return '/?p='.$article->id;
        }

        $replacements = [
            '%year%' => $article->created_at?->format('Y') ?? date('Y'),
            '%monthnum%' => $article->created_at?->format('m') ?? date('m'),
            '%day%' => $article->created_at?->format('d') ?? date('d'),
            '%hour%' => $article->created_at?->format('H') ?? date('H'),
            '%minute%' => $article->created_at?->format('i') ?? date('i'),
            '%second%' => $article->created_at?->format('s') ?? date('s'),
            '%post_id%' => (string) $article->id,
            '%postname%' => $article->slug ?: (string) $article->id,
            '%category%' => $this->firstCategorySlug($article),
            '%author%' => $article->author?->nickname ?? $article->author?->name ?? 'author',
        ];

        $path = str_replace(array_keys($replacements), array_values($replacements), $structure);

        return '/'.trim($path, '/');
    }

    /**
     * 生成页面的固定链接路径（与文章共用同一固定链接结构，如 /3.html）。
     */
    public function pagePath(Page $page): string
    {
        $structure = $this->structure();

        if ($structure === '') {
            return '/?p='.$page->id;
        }

        $replacements = [
            '%year%' => $page->created_at?->format('Y') ?? date('Y'),
            '%monthnum%' => $page->created_at?->format('m') ?? date('m'),
            '%day%' => $page->created_at?->format('d') ?? date('d'),
            '%hour%' => $page->created_at?->format('H') ?? date('H'),
            '%minute%' => $page->created_at?->format('i') ?? date('i'),
            '%second%' => $page->created_at?->format('s') ?? date('s'),
            '%post_id%' => (string) $page->id,
            '%postname%' => $page->slug ?: (string) $page->id,
            '%category%' => 'uncategorized',
            '%author%' => $page->author?->nickname ?? $page->author?->name ?? 'author',
        ];

        $path = str_replace(array_keys($replacements), array_values($replacements), $structure);

        return '/'.trim($path, '/');
    }

    /**
     * 按结构解析路径并定位已发布页面（与文章共用同一固定链接结构）。
     */
    public function resolvePage(string $path): ?Page
    {
        $structure = $this->structure();

        if ($structure === '') {
            return null;
        }

        $regex = $this->buildRegex($structure);

        if ($regex === null || ! preg_match($regex, '/'.trim($path, '/'), $matches)) {
            return null;
        }

        $query = Page::where('status', 'publish');

        if (isset($matches['post_id']) && $matches['post_id'] !== '') {
            $query->where('id', (int) $matches['post_id']);
        } elseif (isset($matches['postname']) && $matches['postname'] !== '') {
            $query->where(function ($q) use ($matches) {
                $q->where('slug', $matches['postname'])->orWhere('id', (int) $matches['postname']);
            });
        } else {
            return null;
        }

        if (($matches['year'] ?? '') !== '') {
            $query->whereYear('created_at', (int) $matches['year']);
        }
        if (($matches['monthnum'] ?? '') !== '') {
            $query->whereMonth('created_at', (int) $matches['monthnum']);
        }
        if (($matches['day'] ?? '') !== '') {
            $query->whereDay('created_at', (int) $matches['day']);
        }

        return $query->first();
    }

    /**
     * 按结构解析路径并定位文章。
     */
    public function resolve(string $path): ?Article
    {
        $structure = $this->structure();

        if ($structure === '') {
            return null;
        }

        $regex = $this->buildRegex($structure);

        if ($regex === null || ! preg_match($regex, '/'.trim($path, '/'), $matches)) {
            return null;
        }

        $query = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST);

        if (isset($matches['post_id']) && $matches['post_id'] !== '') {
            $query->where('id', (int) $matches['post_id']);
        } elseif (isset($matches['postname']) && $matches['postname'] !== '') {
            $query->where(function ($q) use ($matches) {
                $q->where('slug', $matches['postname'])->orWhere('id', (int) $matches['postname']);
            });
        } else {
            return null;
        }

        if (($matches['year'] ?? '') !== '') {
            $query->whereYear('created_at', (int) $matches['year']);
        }
        if (($matches['monthnum'] ?? '') !== '') {
            $query->whereMonth('created_at', (int) $matches['monthnum']);
        }
        if (($matches['day'] ?? '') !== '') {
            $query->whereDay('created_at', (int) $matches['day']);
        }

        return $query->first();
    }

    /**
     * 将结构转换为命名捕获的正则表达式。
     */
    private function buildRegex(string $structure): ?string
    {
        $structure = rtrim(trim($structure), '/');

        if ($structure === '') {
            return null;
        }

        $regex = '';
        $parts = preg_split('/(%[a-z_]+%)/', $structure, -1, PREG_SPLIT_DELIM_CAPTURE);

        foreach ($parts as $part) {
            if ($part === '') {
                continue;
            }

            if (isset(self::TAG_PATTERNS[$part])) {
                $regex .= self::TAG_PATTERNS[$part];
            } else {
                $regex .= preg_quote($part, '#');
            }
        }

        return '#^'.$regex.'/?$#';
    }

    /**
     * 获取文章第一个分类的 slug。
     */
    private function firstCategorySlug(Article $article): string
    {
        $category = $article->categories()->first();

        return $category?->slug ?? 'uncategorized';
    }
}
