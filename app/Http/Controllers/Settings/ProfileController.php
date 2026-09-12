<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-08-06 18:51:21
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-09-08 20:38:53
 * @FilePath: /blog/app/Http/Controllers/Settings/ProfileController.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Services\AttachmentService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'avatar_url' => $request->user()->avatarUrl(),
        ]);
    }

    /**
     * 上传用户头像（更换时删除旧图）。
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:2048',
                'mimes:jpg,jpeg,png,gif,webp',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '头像不能超过 2 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        $meta = $this->attachments->validateUploadedFile($validated['file']);
        $attachment = $this->attachments->replaceSystemImage('user_avatar', $request->user()->id, $validated['file'], $meta);

        return response()->json([
            'id' => $attachment->id,
            'url' => $attachment->isImage() ? Storage::disk('public')->url($attachment->file_path) : null,
        ]);
    }

    /**
     * 恢复默认头像（从文件库删除自定义头像）。
     */
    public function removeAvatar(): RedirectResponse
    {
        $this->attachments->deleteByParent('user_avatar', $request->user()->id ?? Auth::id());

        return to_route('profile.edit')->with('toast', ['type' => 'success', 'message' => '已恢复默认头像。']);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // 昵称为空时默认使用姓名
        if (empty($data['nickname'])) {
            $data['nickname'] = $data['name'];
        }

        $request->user()->fill($data);

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
