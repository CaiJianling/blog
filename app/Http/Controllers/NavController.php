<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class NavController extends Controller
{
    public function index()
    {
        $navigation = config('navigation');

        return Inertia::render('Nav/Index', [
            'navigationCategories' => $navigation,
        ]);
    }
}
