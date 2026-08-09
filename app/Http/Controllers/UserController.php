<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();

        return Inertia::render('User/Index', [
            'users' => $users,
            'breadcrumbs' => [
                ['title' => 'userManagement.title', 'href' => '/users'],
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('User/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:subscriber,contributor,author,editor,administrator',
            'is_active' => 'boolean',
        ]);

        User::create($validated);

        return redirect()->route('users.index')->with('success', 'User created successfully');
    }

    public function edit(User $user)
    {
        return Inertia::render('User/Edit', compact('user'));
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'required|string|in:subscriber,contributor,author,editor,administrator',
            'is_active' => 'boolean',
        ]);

        if ($user->id === Auth::id()) {
            unset($validated['is_active']);
            unset($validated['role']);
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        return redirect()->route('users.index')->with('success', 'User updated successfully');
    }

    public function destroy(User $user)
    {
        $user->delete();

        return redirect()->route('users.index')->with('success', 'User deleted successfully');
    }

    public function toggleStatus(User $user)
    {
        if ($user->id === Auth::id()) {
            return redirect()->back()->withErrors(['error' => 'You cannot change your own status']);
        }

        $user->update(['is_active' => ! $user->is_active]);

        return redirect()->back()->with('success', 'User status updated');
    }
}
