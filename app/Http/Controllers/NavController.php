<?php

namespace App\Http\Controllers;

use App\Models\NavCategory;
use App\Models\NavLink;
use App\Services\AttachmentService;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 公开的导航页：分类与链接由后台「导航设置」维护。
 */
class NavController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    public function index(): Response
    {
        $navigationCategories = NavCategory::orderBy('sort_order')
            ->with('links')
            ->get()
            ->map(fn (NavCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'links' => $category->links
                    ->map(fn (NavLink $link) => [
                        'id' => $link->id,
                        'name' => $link->name,
                        'url' => $link->url,
                        'description' => $link->description,
                        'color' => $link->color,
                        'icon_url' => $this->attachments->systemImageUrl('nav_link_icon', $link->id),
                        'has_intro' => $link->intro_content !== null,
                    ])
                    ->values(),
            ])
            ->values();

        return Inertia::render('Nav/Index', [
            'navigationCategories' => $navigationCategories,
        ]);
    }

    /**
     * 链接的图文介绍页（前台"查看介绍"跳转的独立页面）。
     */
    public function show(NavLink $link): Response
    {
        return Inertia::render('Nav/Intro', [
            'link' => [
                'id' => $link->id,
                'name' => $link->name,
                'url' => $link->url,
                'description' => $link->description,
                'color' => $link->color,
                'intro_content' => $link->intro_content,
            ],
        ]);
    }
}
