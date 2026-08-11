<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class AttachmentController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    public function index(Request $request)
    {
        $type = $request->query('type', 'all');
        $search = $request->query('search', '');
        $date = $request->query('date', '');
        $parentType = $request->query('parent_type', '');
        $parentId = $request->query('parent_id', '');

        $query = Attachment::with('author')->orderBy('created_at', 'desc');

        if ($type !== 'all') {
            $query->where('mime_type', 'like', match ($type) {
                'image' => 'image/%',
                'video' => 'video/%',
                default => '%',
            });
        }

        if ($search !== '') {
            $query->where('file_name', 'like', "%{$search}%");
        }

        if ($date !== '' && preg_match('/^\d{4}-\d{2}$/', $date)) {
            [$year, $month] = explode('-', $date);
            $query->whereYear('created_at', $year)
                ->whereMonth('created_at', $month);
        }

        if ($parentType !== '' && $parentId !== '') {
            $query->where('parent_type', $parentType)
                ->where('parent_id', (int) $parentId);
        }

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        $attachments = $query->paginate(24)
            ->through(function ($attachment) use ($publicDisk) {
                return [
                    'id' => $attachment->id,
                    'file_name' => $attachment->file_name,
                    'file_path' => $attachment->file_path,
                    'mime_type' => $attachment->mime_type,
                    'file_size' => $attachment->file_size,
                    'width' => $attachment->width,
                    'height' => $attachment->height,
                    'parent_type' => $attachment->parent_type,
                    'parent_id' => $attachment->parent_id,
                    'author_name' => $attachment->author?->name ?? '',
                    'created_at' => $attachment->created_at?->format('Y-m-d H:i:s'),
                    'type' => $attachment->getTypeLabel(),
                    'thumbnail_url' => $attachment->isImage() ? $publicDisk->url($attachment->file_path) : null,
                ];
            });

        $typeCounts = [
            'all' => Attachment::count(),
            'image' => Attachment::where('mime_type', 'like', 'image/%')->count(),
            'video' => Attachment::where('mime_type', 'like', 'video/%')->count(),
            'document' => Attachment::where(function ($q) {
                $q->where('mime_type', 'not like', 'image/%')
                    ->where('mime_type', 'not like', 'video/%');
            })->count(),
        ];

        // 非 Inertia 的 AJAX 请求返回 JSON（供 media-quick-upload 等组件 fetch 使用）
        // Inertia 页面导航也会带 X-Requested-With，必须排除 X-Inertia 头
        if (! $request->header('X-Inertia') && ($request->expectsJson() || $request->ajax())) {
            return response()->json([
                'data' => $attachments->items(),
                'current_page' => $attachments->currentPage(),
                'last_page' => $attachments->lastPage(),
                'per_page' => $attachments->perPage(),
                'total' => $attachments->total(),
            ]);
        }

        // 可用的年月列表（从数据库中查询所有附件的年月去重，降序排列）
        $availableDates = Attachment::selectRaw('strftime("%Y-%m", created_at) as date')
            ->distinct()
            ->orderBy('date', 'desc')
            ->pluck('date')
            ->values()
            ->toArray();

        return Inertia::render('Media/Index', [
            'attachments' => $attachments,
            'typeCounts' => $typeCounts,
            'currentType' => $type,
            'currentSearch' => $search,
            'currentDate' => $date,
            'availableDates' => $availableDates,
        ]);
    }

    public function create()
    {
        return Inertia::render('Media/Create');
    }

    public function store(Request $request)
    {
        // Laravel Validator 作为第一道基础拦截（同时用 mimes 规则限制扩展）
        $validated = $request->validate([
            'files' => 'required|array',
            'files.*' => [
                'required',
                'file',
                'max:51200',
                'mimes:'.AttachmentService::mimesRule(),
            ],
        ], [
            'files.required' => '请至少选择一个要上传的文件。',
            'files.array' => '上传文件格式不正确。',
            'files.*.required' => '存在空的文件项。',
            'files.*.file' => '请上传文件类型。',
            'files.*.max' => '单个文件不能超过 50 MB。',
            'files.*.mimes' => '文件类型不允许，仅支持 jpg/jpeg/png/gif/webp/ico/mp4/webm/pdf/xlsx/docx/zip/rar。',
        ]);

        /** @var array<int, UploadedFile> $files */
        $files = $validated['files'];

        $errors = [];

        $parentType = $request->input('parent_type', '');
        $parentId = $request->input('parent_id', '');

        foreach ($files as $index => $file) {
            try {
                // 三重校验
                $meta = $this->attachments->validateUploadedFile($file);
                // 持久化（uploads/YYYY/MM/xxx.ext）
                $this->attachments->persistFile(
                    $file,
                    $meta,
                    $parentType !== '' ? $parentType : null,
                    $parentId !== '' ? (int) $parentId : null
                );
            } catch (\RuntimeException $e) {
                $displayName = $file->getClientOriginalName() ?: "文件索引 {$index}";
                $errors[] = "{$displayName}：{$e->getMessage()}";
            }
        }

        if ($errors !== []) {
            return back()->withErrors(['upload' => $errors]);
        }

        return redirect()->route('attachments.index');
    }

    public function destroy(Attachment $attachment)
    {
        $this->attachments->deleteAttachment($attachment);

        return redirect()->back();
    }

    /**
     * 批量删除附件。
     */
    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|integer|exists:attachments,id',
        ], [
            'ids.required' => '请选择要删除的文件。',
            'ids.array' => '参数格式不正确。',
            'ids.min' => '请至少选择一个文件。',
            'ids.*.exists' => '所选文件不存在。',
        ]);

        $attachments = Attachment::whereIn('id', $validated['ids'])->get();

        [$succeeded, $failed] = $this->attachments->deleteAttachments($attachments);

        if ($failed > 0) {
            return redirect()->back()->with([
                'flash' => [
                    'banner' => "成功删除 {$succeeded} 个，{$failed} 个删除失败。",
                    'bannerStyle' => 'warning',
                ],
            ]);
        }

        return redirect()->back()->with([
            'flash' => [
                'banner' => "已删除 {$succeeded} 个文件。",
                'bannerStyle' => 'success',
            ],
        ]);
    }
}
