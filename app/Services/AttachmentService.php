<?php

namespace App\Services;

use App\Models\Attachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class AttachmentService
{
    /**
     * 允许的后缀白名单。
     * 键 = 扩展名小写（不含点），值 = 该扩展名对应的合法 MIME 类型数组。
     *
     * @var array<string, array<int, string>>
     */
    public const ALLOWED_EXTENSIONS = [
        // 图片
        'jpg' => ['image/jpeg', 'image/jpg'],
        'jpeg' => ['image/jpeg', 'image/jpg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'ico' => ['image/x-icon', 'image/vnd.microsoft.icon', 'image/ico'],
        // 视频
        'mp4' => ['video/mp4', 'application/mp4', 'video/x-m4v'],
        'webm' => ['video/webm', 'audio/webm'],
        // 文档
        'pdf' => ['application/pdf'],
        'xlsx' => [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip', // xlsx 本质也是 zip，finfo 常识别成 zip
            'application/vnd.ms-excel',
        ],
        'docx' => [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip', // docx 本质也是 zip
            'application/msword',
        ],
        'zip' => [
            'application/zip',
            'application/x-zip-compressed',
            'application/x-zip',
            'application/octet-stream',
            'multipart/x-zip',
        ],
        'rar' => [
            'application/x-rar-compressed',
            'application/x-rar',
            'application/vnd.rar',
            'application/octet-stream',
        ],
    ];

    /**
     * 二进制文件头（魔数）签名映射。
     * 顺序很重要：范围匹配（如 jpeg/jpg）放前面。
     *
     * @var array<string, array<int, array{0:int,1:string}>>
     */
    public const FILE_SIGNATURES = [
        'jpg' => [[0, "\xFF\xD8\xFF"]],
        'jpeg' => [[0, "\xFF\xD8\xFF"]],
        'png' => [[0, "\x89PNG\r\n\x1a\n"]],
        'gif' => [[0, 'GIF87a'], [0, 'GIF89a']],
        'webp' => [[8, 'WEBP']], // 0-3: 'RIFF' + 8-11: 'WEBP'
        'ico' => [[0, "\x00\x00\x01\x00"]],
        'pdf' => [[0, '%PDF']],
        'zip' => [[0, 'PK\x03\x04'], [0, 'PK\x05\x06'], [0, 'PK\x07\x08']],
        'xlsx' => [[0, 'PK\x03\x04']],
        'docx' => [[0, 'PK\x03\x04']],
        'rar' => [[0, "Rar!\x1A\x07\x00"], [0, "Rar!\x1A\x07\x01\x00"]],
        'mp4' => [[4, 'ftyp']], // 4-7 字节为 'ftyp' 盒类型
        'webm' => [[0, "\x1A\x45\xDF\xA3"]], // EBML 头标识
    ];

    /**
     * 最大上传尺寸：50 MB（单位：字节）。
     */
    public const MAX_FILE_SIZE = 50 * 1024 * 1024;

    /**
     * 单个文件完整的三重校验流程。
     * 通过后返回已标准化的校验结果元数据数组，失败抛出 \RuntimeException。
     *
     * @return array{
     *     extension: string,
     *     mime_type: string,
     *     is_image: bool,
     * }
     */
    public function validateUploadedFile(UploadedFile $file): array
    {
        // 1. 基础错误检查
        if (! $file->isValid()) {
            throw new \RuntimeException('上传失败：文件未完整上传或出现错误。');
        }

        if ($file->getSize() === false || $file->getSize() > self::MAX_FILE_SIZE) {
            throw new \RuntimeException('上传失败：文件大小超过 50 MB 限制。');
        }

        // 2. 第一重：后缀白名单匹配
        $extension = strtolower($file->getClientOriginalExtension());
        if (! isset(self::ALLOWED_EXTENSIONS[$extension])) {
            throw new \RuntimeException("文件后缀不允许：.{$extension}。仅支持 jpg/jpeg/png/gif/webp/ico/mp4/webm/pdf/xlsx/docx/zip/rar。");
        }

        // 3. 第二重：二进制文件头（魔数）真实类型校验
        $detectedSignatures = $this->detectFileSignatures($file->getRealPath());
        $signatureMatched = false;
        $allowedSignatures = self::FILE_SIGNATURES[$extension] ?? null;
        if ($allowedSignatures !== null) {
            foreach ($allowedSignatures as [$offset, $needle]) {
                // 任意一个命中即通过
                if (in_array($this->formatSignature($offset, $needle), $detectedSignatures, true)) {
                    $signatureMatched = true;
                    break;
                }
            }
        } else {
            // 没定义签名的扩展名跳过文件头校验（理论不存在该分支，因白名单已覆盖）
            $signatureMatched = true;
        }

        if (! $signatureMatched) {
            throw new \RuntimeException("文件头校验失败：检测到 .{$extension} 的文件内容与扩展名不符，可能是伪装文件。");
        }

        // 4. 第三重：服务端 MIME-Type 二次校验（使用 finfo，不信任 $_FILES['type']）
        $serverMime = $this->getServerMimeType($file->getRealPath());
        if ($serverMime === '') {
            throw new \RuntimeException('无法读取文件真实 MIME 类型。');
        }

        // 对比白名单 MIME 映射：该扩展名允许的 MIME 之一命中即通过
        $allowedMimes = self::ALLOWED_EXTENSIONS[$extension];
        $mimeMatched = in_array($serverMime, $allowedMimes, true);

        // 兼容：office(xlsx/docx) 和压缩包类经常被 finfo 识别为 application/zip 等通用类型，
        // 但该文件已经过二进制签名（魔数）匹配；再辅以扩展名匹配即可放行。
        // 对 xlsx/docx/zip/rar，只要签名通过即视为 MIME 部分通过。
        if (! $mimeMatched && ! in_array($extension, ['xlsx', 'docx', 'zip', 'rar'], true)) {
            throw new \RuntimeException(
                "文件真实 MIME 校验失败：声明类型为 .{$extension}，服务器检测为 {$serverMime}，不匹配。"
            );
        }

        $isImage = in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'ico'], true);

        return [
            'extension' => $extension,
            'mime_type' => $serverMime,
            'is_image' => $isImage,
        ];
    }

    /**
     * 根据校验结果，将文件存入 uploads/年/月/ 目录，创建并返回 Attachment 模型。
     *
     * @param  array{extension:string, mime_type:string, is_image:bool}  $meta
     */
    public function persistFile(UploadedFile $file, array $meta): Attachment
    {
        $year = now()->format('Y');
        $month = now()->format('m');
        $directory = "uploads/{$year}/{$month}";

        $filename = date('YmdHis').'_'.substr(bin2hex(random_bytes(6)), 0, 12).'.'.$meta['extension'];

        $absolutePath = $file->storeAs($directory, $filename, 'public');

        if ($absolutePath === false) {
            throw new \RuntimeException('文件写入磁盘失败。');
        }

        // 图片的尺寸探测（仅在图片类别上尝试，失败回 null）
        $width = null;
        $height = null;
        if ($meta['is_image']) {
            /** @var array<int, int>|false $dimensions */
            $dimensions = @getimagesize($file->getRealPath());
            if (is_array($dimensions)) {
                $width = $dimensions[0] ?? null;
                $height = $dimensions[1] ?? null;
            }
        }

        return Attachment::create([
            'author_id' => Auth::id(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $absolutePath,
            'mime_type' => $meta['mime_type'],
            'file_size' => $file->getSize(),
            'width' => $width,
            'height' => $height,
        ]);
    }

    /**
     * 删除单个附件：先尝试删除磁盘上的源文件，再删除数据库记录。
     * 即使磁盘文件已不存在（或权限不足），仍会尝试删除数据库记录，避免出现"幽灵记录"。
     */
    public function deleteAttachment(Attachment $attachment): bool
    {
        $disk = Storage::disk('public');
        $path = $attachment->file_path;

        // 兼容历史数据：旧版本路径可能是 'attachments/images/xxx.jpg'，新版本是 'uploads/YYYY/MM/xxx.jpg'
        if ($path !== '' && $path !== null && $disk->exists($path)) {
            $deleted = $disk->delete($path);
            if (! $deleted) {
                Log::warning('AttachmentService: 物理文件删除失败，但继续删除数据库记录', [
                    'attachment_id' => $attachment->id,
                    'file_path' => $path,
                ]);
            }
        }

        return (bool) $attachment->delete();
    }

    /**
     * 批量删除附件。返回 [成功条数, 失败条数]。
     *
     * @param  iterable<int|string, Attachment>  $attachments
     * @return array{0:int,1:int}
     */
    public function deleteAttachments(iterable $attachments): array
    {
        $succeeded = 0;
        $failed = 0;

        foreach ($attachments as $attachment) {
            try {
                $this->deleteAttachment($attachment);
                $succeeded++;
            } catch (\Throwable $e) {
                Log::warning('AttachmentService: 批量删除单项失败', [
                    'attachment_id' => $attachment->id ?? null,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        return [$succeeded, $failed];
    }

    /**
     * 获取某文件的合法扩展名集合（用于 Validator mimes 规则，辅助 Laravel 请求层第一道过滤）。
     */
    public static function mimesRule(): string
    {
        return implode(',', array_keys(self::ALLOWED_EXTENSIONS));
    }

    /**
     * 使用 finfo 读取服务器端真实 MIME 类型（不依赖客户端上传声明）。
     */
    private function getServerMimeType(string $realPath): string
    {
        if (! function_exists('finfo_open')) {
            // 退化：fallback 到 mime_content_type（仍比 $_FILES['type'] 可信）
            /** @var string|false $fallback */
            $fallback = @mime_content_type($realPath);

            return is_string($fallback) ? $fallback : '';
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return '';
        }

        /** @var string|false $mime */
        $mime = @finfo_file($finfo, $realPath);
        // PHP 8.3+: finfo_close has been deprecated; the resource auto-releases when $finfo goes out of scope.

        return is_string($mime) ? $mime : '';
    }

    /**
     * 从文件读取 FILE_SIGNATURES 里定义过的所有签名位置，返回匹配命中列表。
     * 元素格式为 `${offset}:${bin2hex(needle)}`。
     *
     * @return array<int, string>
     */
    private function detectFileSignatures(string $realPath): array
    {
        if (! file_exists($realPath) || ! is_readable($realPath)) {
            return [];
        }

        /** @var resource|false $handle */
        $handle = @fopen($realPath, 'rb');
        if (! is_resource($handle)) {
            return [];
        }

        $fileSize = filesize($realPath) ?: 0;
        $matches = [];

        try {
            foreach (self::FILE_SIGNATURES as $entries) {
                foreach ($entries as [$offset, $needle]) {
                    $needleLen = strlen($needle);
                    if (($fileSize > 0 && $offset + $needleLen > $fileSize) || $offset < 0) {
                        continue;
                    }

                    if (fseek($handle, $offset, SEEK_SET) !== 0) {
                        continue;
                    }

                    $got = fread($handle, $needleLen);
                    if ($got === $needle) {
                        $matches[] = $this->formatSignature($offset, $needle);
                    }
                }
            }
        } finally {
            fclose($handle);
        }

        return $matches;
    }

    /**
     * 规范化签名 key，便于比较。
     */
    private function formatSignature(int $offset, string $needle): string
    {
        return "{$offset}:".bin2hex($needle);
    }
}
