<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::query()
            ->orderBy('id', 'desc')
            ->paginate(10);

        return Inertia::render('User/Index', [
            'users' => $users,
            'breadcrumbs' => [
                ['title' => 'userManagement.title', 'href' => '/admin/users'],
            ],
        ]);
    }

    public function create()
    {
        // 新建用户走用户列表页内的 Dialog（POST /admin/users），无独立 Inertia 页面；
        // 直接访问此资源路由时回落到列表，避免渲染不存在的 User/Create 页面导致 500。
        return redirect()->route('users.index');
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

    public function show(User $user)
    {
        // 用户详情没有独立 Inertia 页面（查看/编辑均在用户列表页 Dialog 内完成）；
        // 直接访问此资源路由时回落到列表，避免因缺失 show 方法导致 500。
        return redirect()->route('users.index');
    }

    public function edit(User $user)
    {
        // 编辑用户走用户列表页内的 Dialog（PUT /admin/users/{id}），无独立 Inertia 页面；
        // 直接访问此资源路由时回落到列表，避免渲染不存在的 User/Edit 页面导致 500。
        return redirect()->route('users.index');
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
