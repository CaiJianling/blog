<?php

use App\Models\Attachment;
use App\Models\User;
use App\Services\AttachmentService;
use Illuminate\Foundation\Http\Middleware\ValidatePostSize;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('guests are redirected from attachments index', function () {
    $response = $this->get(route('attachments.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view the media library', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('attachments.index'));

    $response->assertOk();
});

test('authenticated users can view the create media page', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('attachments.create'));

    $response->assertOk();
});

test('authenticated users can upload an image attachment', function () {
    $disk = Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('photo.jpg', 800, 600);

    $response = $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $response->assertRedirect(route('attachments.index'));

    $attachment = Attachment::first();
    $year = now()->format('Y');
    $month = now()->format('m');
    expect($attachment)->not->toBeNull()
        ->and($attachment->file_name)->toBe('photo.jpg')
        ->and($attachment->author_id)->toBe($user->id)
        ->and($attachment->mime_type)->toStartWith('image/')
        ->and($attachment->file_size)->toBeGreaterThan(0)
        ->and($attachment->file_path)->toStartWith("uploads/{$year}/{$month}/")
        ->and($attachment->width)->toBe(800)
        ->and($attachment->height)->toBe(600);

    $disk->assertExists($attachment->file_path);
});

test('authenticated users can upload a pdf document attachment', function () {
    $disk = Storage::fake('public');

    $user = User::factory()->create();
    // 用真实 PDF 文件头构造内容，保证第二/三重校验通过
    $content = "%PDF-1.4\n%fake pdf content\n%%EOF\n";
    $file = new UploadedFile(
        tmpfile_stream($content),
        'document.pdf',
        'application/pdf',
        null,
        true
    );

    $response = $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $response->assertRedirect(route('attachments.index'));

    $attachment = Attachment::first();
    expect($attachment)->not->toBeNull()
        ->and($attachment->mime_type)->toBe('application/pdf');

    $disk->assertExists($attachment->file_path);
});

test('uploaded file path matches uploads year month pattern', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('test.jpg', 100, 100);

    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $attachment = Attachment::first();
    $year = now()->format('Y');
    $month = now()->format('m');

    expect($attachment->file_path)->toMatch("/^uploads\/{$year}\/{$month}\/[A-Za-z0-9_]+\.jpg$/");
});

test('store requires files to be uploaded', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('attachments.store'), []);

    $response->assertSessionHasErrors(['files']);
});

test('authenticated users can delete their own attachment', function () {
    $disk = Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('photo.jpg');

    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $attachment = Attachment::first();
    $path = $attachment->file_path;

    $disk->assertExists($path);

    $response = $this->actingAs($user)->delete(route('attachments.destroy', $attachment));

    $response->assertRedirect();
    expect(Attachment::find($attachment->id))->toBeNull();
    $disk->assertMissing($path);
});

test('blocked extensions are rejected by mimes validator', function (string $badName) {
    $user = User::factory()->create();
    // 不管内容如何，扩展名会在 Laravel Validator mimes 规则层被拦截
    $content = "<?php echo 'shell';\n";
    $file = new UploadedFile(
        tmpfile_stream($content),
        $badName,
        'application/x-php',
        null,
        true
    );

    $response = $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $response->assertSessionHasErrors('files.0');
    expect(Attachment::count())->toBe(0);
})->with([
    'shell as php' => 'shell.php',
    'php3 variant' => 'backdoor.php3',
    'phtml' => 'bad.phtml',
    'executable' => 'malware.exe',
    'shell sh' => 'run.sh',
    'python' => 'exploit.py',
    'asp' => 'hack.asp',
    'svg XSS risk' => 'xss.svg',
    'html' => 'phish.html',
]);

test('binary file header validation rejects a script renamed to jpg', function () {
    $user = User::factory()->create();

    // 构造内容是 PHP，扩展名却伪装成 .jpg：后缀白名单会通过（jpg 在白名单），
    // 但第二重二进制签名不会匹配 JPEG 魔数（FF D8 FF），会被拒。
    $content = "<?php eval(\$_GET['c']);\n";
    $file = new UploadedFile(
        tmpfile_stream($content),
        'innocent.jpg',
        'image/jpeg', // 客户端声明也骗过去
        null,
        true
    );

    $this->actingAs($user)
        // Laravel 的 mimes 规则不仅看扩展名，还会看 finfo MIME，所以我们用 withoutMiddleware
        // 规避 mimes 拦截，以验证我们自己的第二/三重校验
        ->withoutMiddleware(ValidatePostSize::class)
        ->post(route('attachments.store'), [
            'files' => [$file],
        ]);

    // 要么被 mimes 规则拦截（files.0），要么被我们的自定义校验拦截（upload）
    $hasErrors = session('errors') !== null;
    expect($hasErrors)->toBeTrue();
    expect(Attachment::count())->toBe(0);
});

test('AttachmentService triple validation passes for a genuine JPEG', function () {
    // 真实 JPEG 魔数
    $content = "\xFF\xD8\xFF\xE0".str_repeat("\x00", 100);
    $file = new UploadedFile(
        tmpfile_stream($content),
        'real.jpg',
        'image/jpeg',
        null,
        true
    );

    $service = app(AttachmentService::class);
    $meta = $service->validateUploadedFile($file);

    expect($meta['extension'])->toBe('jpg')
        ->and($meta['is_image'])->toBeTrue();
});

test('AttachmentService binary signature rejects PHP disguised as jpg', function () {
    $content = "<?php system('id'); ?>\n";
    $file = new UploadedFile(
        tmpfile_stream($content),
        'not-real.jpg',
        'image/jpeg',
        null,
        true
    );

    $service = app(AttachmentService::class);
    $this->expectException(RuntimeException::class);
    $this->expectExceptionMessage('文件头校验失败');
    $service->validateUploadedFile($file);
});

test('AttachmentService rejects extension not in whitelist', function () {
    $content = '<?xml version="1.0"?><svg onload="alert(1)"/>';
    $file = new UploadedFile(
        tmpfile_stream($content),
        'xss.svg',
        'image/svg+xml',
        null,
        true
    );

    $service = app(AttachmentService::class);
    $this->expectException(RuntimeException::class);
    $this->expectExceptionMessage('文件后缀不允许');
    $service->validateUploadedFile($file);
});

test('media library index returns attachments with type counts', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    // 上传一张图片
    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [UploadedFile::fake()->image('a.jpg')],
    ]);

    // 上传一份文档（真实 PDF 文件头）
    $pdfContent = "%PDF-1.4\ncontent\n%%EOF\n";
    $pdf = new UploadedFile(
        tmpfile_stream($pdfContent),
        'doc.pdf',
        'application/pdf',
        null,
        true
    );
    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$pdf],
    ]);

    $response = $this->actingAs($user)->get(route('attachments.index'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('attachments')
            ->has('typeCounts')
            ->where('typeCounts.all', 2)
            ->where('typeCounts.image', 1)
            ->where('typeCounts.document', 1)
        );
});

test('media library can filter by type', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [UploadedFile::fake()->image('a.jpg')],
    ]);

    $pdfContent = "%PDF-1.4\ncontent\n%%EOF\n";
    $pdf = new UploadedFile(
        tmpfile_stream($pdfContent),
        'doc.pdf',
        'application/pdf',
        null,
        true
    );
    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$pdf],
    ]);

    $response = $this->actingAs($user)->get(route('attachments.index', ['type' => 'image']));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('attachments.data')
            ->where('currentType', 'image')
        );

    expect(count($response->inertiaProps()['attachments']['data']))->toBe(1);
});

test('delete attachment also removes the physical file from disk', function () {
    $disk = Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('photo.jpg');

    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [$file],
    ]);

    $attachment = Attachment::first();
    $path = $attachment->file_path;

    // 文件确实存在
    $disk->assertExists($path);

    $this->actingAs($user)->delete(route('attachments.destroy', $attachment));

    // 数据库记录删除
    expect(Attachment::find($attachment->id))->toBeNull();
    // 磁盘源文件也删除
    $disk->assertMissing($path);
});

test('bulk delete removes multiple attachments and their files', function () {
    $disk = Storage::fake('public');

    $user = User::factory()->create();

    // 上传 3 张图片
    $this->actingAs($user)->post(route('attachments.store'), [
        'files' => [
            UploadedFile::fake()->image('a.jpg'),
            UploadedFile::fake()->image('b.jpg'),
            UploadedFile::fake()->image('c.jpg'),
        ],
    ]);

    expect(Attachment::count())->toBe(3);

    $attachments = Attachment::all();
    $paths = $attachments->pluck('file_path')->all();
    $ids = $attachments->pluck('id')->all();

    // 验证磁盘上文件存在
    foreach ($paths as $p) {
        $disk->assertExists($p);
    }

    // 批量删除
    $response = $this->actingAs($user)
        ->delete(route('attachments.bulk-destroy'), ['ids' => $ids]);

    $response->assertRedirect();

    // 数据库与磁盘都被清空
    expect(Attachment::count())->toBe(0);
    foreach ($paths as $p) {
        $disk->assertMissing($p);
    }
});

test('bulk delete requires at least one id', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->delete(route('attachments.bulk-destroy'), ['ids' => []]);

    $response->assertSessionHasErrors(['ids']);
});

test('bulk delete rejects non-existent ids', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->delete(route('attachments.bulk-destroy'), ['ids' => [999999]]);

    $response->assertSessionHasErrors(['ids.0']);
});

/**
 * 测试辅助：根据给定的字符串内容创建一个临时文件句柄，
 * 配合 UploadedFile($test = true) 构造方式让 PHP 把它当成上传文件。
 */
function tmpfile_stream(string $content): string
{
    $tmp = tempnam(sys_get_temp_dir(), 'att_test_');
    file_put_contents($tmp, $content);

    return $tmp;
}
