<?php

namespace App\Http\Controllers;

use App\Models\Term;
use App\Models\TermTaxonomy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TermTaxonomyController extends Controller
{
    /**
     * Display a listing of categories or tags based on taxonomy query param.
     */
    public function index(Request $request)
    {
        $taxonomy = $request->query('taxonomy', 'category');
        abort_unless(in_array($taxonomy, ['category', 'tag'], true), 404);

        $items = TermTaxonomy::where('taxonomy', $taxonomy)
            ->with('term')
            ->orderBy('term_taxonomy_id')
            ->get()
            ->map(fn ($item) => $this->transform($item));

        $component = $taxonomy === 'tag' ? 'Article/Tags' : 'Article/Categories';

        return Inertia::render($component, [
            $taxonomy === 'tag' ? 'tags' : 'categories' => $items,
        ]);
    }

    /**
     * Store a newly created term + taxonomy in one shot.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'taxonomy' => ['required', Rule::in(['category', 'tag'])],
            'name' => 'required|string|max:200',
            'slug' => 'nullable|string|max:200',
            'description' => 'nullable|string',
            'parent' => 'nullable|integer',
        ]);

        $taxonomy = $validated['taxonomy'];

        $term = Term::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? str()->slug($validated['name']),
        ]);

        TermTaxonomy::create([
            'term_id' => $term->term_id,
            'taxonomy' => $taxonomy,
            'description' => $validated['description'] ?? '',
            'parent' => $validated['parent'] ?? 0,
        ]);

        return back();
    }

    /**
     * Update the given term + taxonomy pair.
     */
    public function update(Request $request, TermTaxonomy $termTaxonomy): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:200',
            'slug' => 'nullable|string|max:200',
            'description' => 'nullable|string',
        ]);

        $termTaxonomy->term->update([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? str()->slug($validated['name']),
        ]);

        $termTaxonomy->update([
            'description' => $validated['description'] ?? $termTaxonomy->description,
        ]);

        return back();
    }

    /**
     * Remove the given taxonomy along with its term and relationships.
     */
    public function destroy(TermTaxonomy $termTaxonomy): RedirectResponse
    {
        $termId = $termTaxonomy->term_id;

        $termTaxonomy->relationships()->delete();
        $termTaxonomy->delete();

        // 删除最后一个指向该 term 的 taxonomy 时，连 term 一起删
        if (! TermTaxonomy::where('term_id', $termId)->exists()) {
            Term::where('term_id', $termId)->delete();
        }

        return back();
    }

    private function transform(TermTaxonomy $item): array
    {
        return [
            'id' => $item->term_taxonomy_id,
            'name' => $item->term->name,
            'slug' => $item->term->slug,
            'description' => $item->description,
            'count' => (int) $item->count,
            'parent' => $item->parent,
        ];
    }
}
