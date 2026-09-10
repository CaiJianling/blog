<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class ToolController extends Controller
{
    public function index()
    {
        $tools = config('tools');

        return Inertia::render('Tools/Index', [
            'toolCategories' => $tools,
        ]);
    }

    public function show(string $slug)
    {
        $tool = null;
        $category = null;

        foreach (config('tools') as $catName => $items) {
            foreach ($items as $item) {
                if ($item['slug'] === $slug) {
                    $tool = $item;
                    $category = $catName;
                    break 2;
                }
            }
        }

        abort_if(! $tool, 404);

        return Inertia::render('Tools/Show', [
            'tool' => $tool,
            'category' => $category,
        ]);
    }
}
