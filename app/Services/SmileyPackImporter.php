<?php

namespace App\Services;

use App\Models\Smiley;
use App\Models\SmileyGroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use ZipArchive;

/**
 * 表情包组导入：整包上传一个 zip（内含一个 json 配置 + 若干图片），
 * 由服务端解压、按配置自动匹配图片，建组并批量写入表情。
 *
 * 配置文件（优先取这些名字：smileys.json / smiley.json / config.json /
 * manifest.json / info.json / package.json，否则用包里唯一的 json）：
 *
 *     {
 *         "name": "小黄脸",
 *         "smileys": [
 *             { "code": "smile", "image": "smile.png", "sort": 1 },
 *             { "code": "cry" }
 *         ]
 *     }
 *
 * 宽容处理：`name` 缺省用 zip 文件名；`image` 也可写 file/path/src，或整个省略
 * （省略时按「代码.扩展名」在包内自动找）；条目直接写字符串时视为图片文件名，
 * 代码取文件名主体；包里完全没有 json 时退化成「每张图一个表情，代码 = 文件名」。
 *
 * 表情代码沿用后台手工录入的字符集约束（字母、数字、下划线、连字符），前台按
 * `:代码:` 渲染成图片，所以配置里写 `:smile:` 会自动去掉两侧冒号。
 */
class SmileyPackImporter
{
    /** 单包条目数与体积上限：防 zip bomb，也照顾 128M 的 memory_limit。 */
    private const MAX_ENTRIES = 400;

    private const MAX_JSON_BYTES = 262_144;

    private const MAX_IMAGE_BYTES = 2_097_152;

    private const MAX_TOTAL_BYTES = 62_914_560;

    /** 与 SmileyController::storeSmiley 一致的代码字符集。 */
    private const CODE_PATTERN = '/^[a-zA-Z0-9_\-]{1,50}$/';

    /** 允许的表情图片类型：MIME → 落盘扩展名（扩展名由探测结果决定，不信任包内命名）。 */
    private const IMAGE_TYPES = [
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/jpeg' => 'jpg',
        'image/bmp' => 'bmp',
    ];

    private const MANIFEST_NAMES = ['smileys.json', 'smiley.json', 'config.json', 'manifest.json', 'info.json', 'package.json'];

    /**
     * 包内一个文件：path 是 zip 里的原始条目名（取内容时必须用它），
     * key / base 是用于不区分大小写匹配的小写形式。
     *
     * @return array{path: string, key: string, base: string, size: int}
     */
    private function file(string $path, int $size): array
    {
        $key = $this->normalizePath($path);

        return ['path' => $path, 'key' => $key, 'base' => basename($key), 'size' => $size];
    }

    /**
     * 导入一个表情包。
     *
     * @param  string  $zipPath  上传文件的临时绝对路径
     * @param  string  $fallbackName  配置未给出组名时的兜底名（一般是 zip 文件名）
     * @return array{group_id: int, group_name: string, imported: int, skipped: array<int, array{code: string, reason: string}>}
     *
     * @throws ValidationException 包打不开、配置不可解析，或一条都没导入成功
     */
    public function import(string $zipPath, string $fallbackName): array
    {
        $zip = new ZipArchive;

        if ($zip->open($zipPath) !== true) {
            throw ValidationException::withMessages(['pack' => '无法打开压缩包，请确认是有效的 zip 文件。']);
        }

        try {
            $files = $this->indexEntries($zip);
            $skipped = [];
            $plan = $this->planFromZip($zip, $files, $skipped);
            $plan = $this->dropDuplicatedCodes($plan, $skipped);

            return $this->persist($zip, $plan, $skipped, $fallbackName);
        } finally {
            $zip->close();
        }
    }

    /**
     * 列出包内可用文件：目录、打包残留、越界路径与符号链接都直接丢掉。
     *
     * @return array<int, array{path: string, key: string, base: string, size: int}>
     */
    protected function indexEntries(ZipArchive $zip): array
    {
        if ($zip->numFiles > self::MAX_ENTRIES) {
            throw ValidationException::withMessages([
                'pack' => "压缩包条目过多（{$zip->numFiles} 个），上限 ".self::MAX_ENTRIES.' 个。',
            ]);
        }

        $files = [];
        $total = 0;

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);

            if ($stat === false) {
                continue;
            }

            $file = $this->file((string) $stat['name'], (int) $stat['size']);

            if ($file['key'] === '' || str_ends_with($file['key'], '/')) {
                continue;
            }

            if (str_contains($file['key'], '__macosx/') || str_starts_with($file['base'], '.')) {
                continue;
            }

            $total += $file['size'];
            $files[] = $file;
        }

        if ($total > self::MAX_TOTAL_BYTES) {
            throw ValidationException::withMessages(['pack' => '压缩包解压后体积过大（上限 60MB）。']);
        }

        if ($files === []) {
            throw ValidationException::withMessages(['pack' => '压缩包里没有可用文件。']);
        }

        return $files;
    }

    /**
     * 解析配置并给出导入计划。
     *
     * @param  array<int, array{path: string, key: string, base: string, size: int}>  $files
     * @param  array<int, array{code: string, reason: string}>  $skipped  按引用收集不可用条目及原因
     * @return array{name: string|null, items: array<int, array{code: string, entry: array{path: string, key: string, base: string, size: int}, sort: int}>}
     */
    protected function planFromZip(ZipArchive $zip, array $files, array &$skipped): array
    {
        $manifest = $this->readManifest($zip, $files);

        if ($manifest === null) {
            return $this->planFromImageNames($files, $skipped);
        }

        [$items, $name] = $manifest;

        $plan = [];
        $position = 0;

        foreach ($items as $raw) {
            [$code, $wanted, $sort] = $this->normalizeItem($raw);

            if ($code === null || $code === '' || ! preg_match(self::CODE_PATTERN, $code)) {
                $skipped[] = ['code' => (string) $code, 'reason' => '代码为空或含非法字符（只允许字母、数字、下划线、连字符）'];
                $position++;

                continue;
            }

            $entry = $wanted === null
                ? $this->matchEntryByCode($files, $code)
                : $this->matchEntry($files, $this->normalizePath($wanted));

            if ($entry === null) {
                $skipped[] = ['code' => $code, 'reason' => "压缩包里找不到图片文件 {$wanted}"];
                $position++;

                continue;
            }

            $plan[] = ['code' => $code, 'entry' => $entry, 'sort' => $sort ?? $position];
            $position++;
        }

        if ($plan === []) {
            throw ValidationException::withMessages(['pack' => '表情配置里没有可用条目（代码或图片都没匹配上）。']);
        }

        return ['name' => $name, 'items' => $plan];
    }

    /**
     * 没有配置文件时：包内每张图就是一个表情，代码取文件名主体。
     *
     * @param  array<int, array{path: string, key: string, base: string, size: int}>  $files
     * @param  array<int, array{code: string, reason: string}>  $skipped
     * @return array{name: null, items: array<int, array{code: string, entry: array{path: string, key: string, base: string, size: int}, sort: int}>}
     */
    protected function planFromImageNames(array $files, array &$skipped): array
    {
        $plan = [];
        $position = 0;

        foreach ($files as $file) {
            if (! in_array(pathinfo($file['key'], PATHINFO_EXTENSION), array_values(self::IMAGE_TYPES), true)) {
                continue;
            }

            $code = pathinfo($file['base'], PATHINFO_FILENAME);

            if (! preg_match(self::CODE_PATTERN, $code)) {
                $skipped[] = ['code' => $code, 'reason' => '文件名不能直接作为表情代码（只允许字母、数字、下划线、连字符）'];

                continue;
            }

            $plan[] = ['code' => $code, 'entry' => $file, 'sort' => $position];
            $position++;
        }

        if ($plan === []) {
            throw ValidationException::withMessages(['pack' => '压缩包里既没有表情配置 json，也没有可用的图片。']);
        }

        return ['name' => null, 'items' => $plan];
    }

    /**
     * 读出并解析配置文件；包里没有任何 json 时返回 null（走按文件名导入）。
     *
     * @param  array<int, array{path: string, key: string, base: string, size: int}>  $files
     * @return array{0: array<int, mixed>, 1: string|null}|null
     */
    protected function readManifest(ZipArchive $zip, array $files): ?array
    {
        $jsons = array_values(array_filter(
            $files,
            fn (array $file) => pathinfo($file['key'], PATHINFO_EXTENSION) === 'json',
        ));

        if ($jsons === []) {
            return null;
        }

        $wanted = null;

        foreach ($jsons as $json) {
            if (in_array($json['base'], self::MANIFEST_NAMES, true)) {
                $wanted = $json;

                break;
            }
        }

        // 没有约定名时，只有一个 json 才认，避免误读包里其它 json
        $wanted ??= count($jsons) === 1 ? $jsons[0] : null;

        if ($wanted === null) {
            return null;
        }

        if ($wanted['size'] > self::MAX_JSON_BYTES) {
            throw ValidationException::withMessages(['pack' => '表情配置 json 过大（上限 256KB）。']);
        }

        try {
            $decoded = json_decode((string) $zip->getFromName($wanted['path']), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw ValidationException::withMessages(['pack' => '表情配置 json 解析失败：'.$exception->getMessage()]);
        }

        return $this->manifestItems($decoded);
    }

    /**
     * 把配置结构归一成「条目列表 + 组名」。
     *
     * @return array{0: array<int, mixed>, 1: string|null}
     */
    protected function manifestItems(mixed $decoded): array
    {
        if (is_array($decoded) && array_is_list($decoded)) {
            return [$decoded, null];
        }

        if (! is_array($decoded)) {
            throw ValidationException::withMessages(['pack' => '表情配置 json 必须是对象或数组。']);
        }

        foreach (['smileys', 'items', 'emojis', 'data'] as $key) {
            if (isset($decoded[$key]) && is_array($decoded[$key])) {
                return [$decoded[$key], isset($decoded['name']) ? (string) $decoded['name'] : null];
            }
        }

        throw ValidationException::withMessages(['pack' => '表情配置 json 里缺少 smileys 数组。']);
    }

    /**
     * 归一单条配置：代码、指定的图片名、排序。
     *
     * @return array{0: string|null, 1: string|null, 2: int|null}
     */
    protected function normalizeItem(mixed $raw): array
    {
        if (is_string($raw)) {
            $file = $this->normalizePath($raw);

            return [pathinfo($file, PATHINFO_FILENAME), $file, null];
        }

        if (! is_array($raw)) {
            return [null, null, null];
        }

        $code = $this->firstString($raw, ['code', 'key', 'text', 'tag', 'name']);
        $wanted = $this->firstString($raw, ['image', 'file', 'path', 'src', 'url', 'img']);
        $sort = $raw['sort'] ?? $raw['order'] ?? null;

        return [
            $code === null ? null : trim($code, " \t\n\r\0\x0B:"),
            $wanted,
            is_numeric($sort) ? (int) $sort : null,
        ];
    }

    /**
     * 去掉包内重复与库里已存在的代码（表情代码全站唯一，评论文本要靠它匹配）。
     *
     * @param  array{name: string|null, items: array<int, mixed>}  $plan
     * @param  array<int, array{code: string, reason: string}>  $skipped
     * @return array{name: string|null, items: array<int, mixed>}
     */
    protected function dropDuplicatedCodes(array $plan, array &$skipped): array
    {
        $items = [];
        $codes = [];

        foreach ($plan['items'] as $item) {
            if (isset($codes[$item['code']])) {
                $skipped[] = ['code' => $item['code'], 'reason' => '压缩包内代码重复'];

                continue;
            }

            $codes[$item['code']] = true;
            $items[] = $item;
        }

        $existing = Smiley::query()->whereIn('code', array_keys($codes))->pluck('code')->flip();

        $items = array_values(array_filter($items, function (array $item) use ($existing, &$skipped) {
            if ($existing->has($item['code'])) {
                $skipped[] = ['code' => $item['code'], 'reason' => '表情代码已存在'];

                return false;
            }

            return true;
        }));

        if ($items === []) {
            throw ValidationException::withMessages(['pack' => '压缩包里的表情代码都已存在，没有可导入的新表情。']);
        }

        return ['name' => $plan['name'], 'items' => $items];
    }

    /**
     * 建组、落盘、写库。图片逐个写进 public 盘，任一步失败则清掉已写文件并回滚事务。
     *
     * @param  array{name: string|null, items: array<int, array{code: string, entry: array{path: string, key: string, base: string, size: int}, sort: int}>}  $plan
     * @param  array<int, array{code: string, reason: string}>  $skipped
     * @return array{group_id: int, group_name: string, imported: int, skipped: array<int, array{code: string, reason: string}>}
     */
    protected function persist(ZipArchive $zip, array $plan, array &$skipped, string $fallbackName): array
    {
        $written = [];
        $imported = 0;

        try {
            $group = DB::transaction(function () use ($zip, $plan, &$skipped, &$written, &$imported, $fallbackName) {
                $group = SmileyGroup::create([
                    'name' => $this->uniqueGroupName($plan['name'] ?? $fallbackName),
                    'sort' => (int) SmileyGroup::max('sort') + 1,
                ]);

                foreach ($plan['items'] as $item) {
                    $path = $this->storeImage($zip, $item, $group->id, $skipped, $written);

                    if ($path === null) {
                        continue;
                    }

                    Smiley::create([
                        'group_id' => $group->id,
                        'code' => $item['code'],
                        'image' => $path,
                        'sort' => $item['sort'],
                    ]);

                    $imported++;
                }

                if ($imported === 0) {
                    throw ValidationException::withMessages(['pack' => '压缩包里的图片全部无法识别，没有导入任何表情。']);
                }

                return $group;
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($written);

            throw $exception;
        }

        return [
            'group_id' => $group->id,
            'group_name' => $group->name,
            'imported' => $imported,
            'skipped' => $skipped,
        ];
    }

    /**
     * 校验并写入一张表情图，返回落盘相对路径；类型不受支持时记为跳过并返回 null。
     *
     * @param  array{code: string, entry: array{path: string, key: string, base: string, size: int}, sort: int}  $item
     * @param  array<int, array{code: string, reason: string}>  $skipped
     * @param  array<int, string>  $written
     */
    protected function storeImage(ZipArchive $zip, array $item, int $groupId, array &$skipped, array &$written): ?string
    {
        $entry = $item['entry'];

        if ($entry['size'] > self::MAX_IMAGE_BYTES) {
            $skipped[] = ['code' => $item['code'], 'reason' => '单张图片超过 2MB'];

            return null;
        }

        $bytes = $zip->getFromName($entry['path']);

        $info = $bytes === false ? false : @getimagesizefromstring($bytes);

        if ($info === false) {
            $skipped[] = ['code' => $item['code'], 'reason' => '图片内容无法识别'];

            return null;
        }

        $extension = self::IMAGE_TYPES[$info['mime'] ?? ''] ?? null;

        if ($extension === null) {
            $skipped[] = ['code' => $item['code'], 'reason' => '图片格式不受支持（仅 png/gif/webp/jpg/bmp）'];

            return null;
        }

        $path = "smileys/group-{$groupId}/{$item['code']}.{$extension}";

        Storage::disk('public')->put($path, $bytes);
        $written[] = $path;

        return $path;
    }

    /**
     * 分组名唯一，同名时自动加序号后缀（列上限 50 字符）。
     */
    protected function uniqueGroupName(string $preferred): string
    {
        $base = trim(preg_replace('/[\r\n\t]+/', ' ', $preferred));

        if ($base === '') {
            $base = '未命名表情包';
        }

        $base = mb_substr($base, 0, 40);
        $name = $base;

        for ($suffix = 2; SmileyGroup::where('name', $name)->exists(); $suffix++) {
            $name = $base.' ('.$suffix.')';
        }

        return $name;
    }

    /**
     * 归一化路径：统一分隔符、去掉 ./ 与前导 /；出现 ../ 视为越界，返回空串表示丢弃。
     */
    protected function normalizePath(string $path): string
    {
        $parts = [];

        foreach (explode('/', str_replace('\\', '/', trim($path))) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                return '';
            }

            $parts[] = $segment;
        }

        return mb_strtolower(implode('/', $parts));
    }

    /**
     * 按配置给出的图片名找包内文件：先整体路径，再纯文件名。
     *
     * @param  array<int, array{path: string, key: string, base: string, size: int}>  $files
     * @return array{path: string, key: string, base: string, size: int}|null
     */
    protected function matchEntry(array $files, string $wanted): ?array
    {
        if ($wanted === '') {
            return null;
        }

        $byKey = [];
        $byBase = [];

        foreach ($files as $file) {
            $byKey[$file['key']] ??= $file;
            $byBase[$file['base']] ??= $file;
        }

        return $byKey[$wanted] ?? $byBase[basename($wanted)] ?? null;
    }

    /**
     * 配置没写图片名时，按「代码.扩展名」在包内找图。
     *
     * @param  array<int, array{path: string, key: string, base: string, size: int}>  $files
     * @return array{path: string, key: string, base: string, size: int}|null
     */
    protected function matchEntryByCode(array $files, string $code): ?array
    {
        foreach (array_values(self::IMAGE_TYPES) as $extension) {
            $entry = $this->matchEntry($files, mb_strtolower($code).'.'.$extension);

            if ($entry !== null) {
                return $entry;
            }
        }

        return null;
    }

    /**
     * @param  array<int, string>  $keys
     */
    protected function firstString(array $item, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($item[$key]) && is_string($item[$key]) && trim($item[$key]) !== '') {
                return $item[$key];
            }
        }

        return null;
    }
}
