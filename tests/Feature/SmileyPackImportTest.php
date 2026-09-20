<?php

use App\Models\Smiley;
use App\Models\SmileyGroup;
use App\Models\User;
use App\Services\CommentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * 表情包组导入：只上传一个 zip（内含表情配置 json + 图片），服务端解压并自动匹配。
 */
const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

function tinyPng(): string
{
    return base64_decode(TINY_PNG_BASE64, true);
}

/**
 * 造一个真实 zip 包（测试模式下的 UploadedFile 需要磁盘上的真文件）。
 *
 * @param  array<string, string>  $files  条目名 => 内容
 */
function uploadSmileyPack(array $files, string $name = 'yellow-face.zip'): UploadedFile
{
    $directory = sys_get_temp_dir().'/smiley-pack-'.uniqid('', true);
    mkdir($directory, 0o700, true);

    $zipPath = $directory.'/'.$name;

    $zip = new ZipArchive;
    $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    foreach ($files as $entry => $contents) {
        $zip->addFromString($entry, $contents);
    }

    $zip->close();

    return new UploadedFile($zipPath, $name, 'application/zip', null, true);
}

function packManifest(array $smileys, ?string $name = '黄脸包'): string
{
    return (string) json_encode(array_filter([
        'name' => $name,
        'smileys' => $smileys,
    ]));
}

beforeEach(function () {
    Storage::fake('public');

    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

test('zip with config json creates a group and matches images', function () {
    $pack = uploadSmileyPack([
        'smileys.json' => packManifest([
            ['code' => ':smile:', 'image' => 'img/SMILE.PNG'],
            ['code' => 'cry', 'sort' => 5],
        ]),
        'img/SMILE.PNG' => tinyPng(),
        'cry.png' => tinyPng(),
        'notes/readme.txt' => 'ignored',
    ]);

    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', ['pack' => $pack])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $group = SmileyGroup::where('name', '黄脸包')->firstOrFail();

    expect($group->smileys()->pluck('code')->all())->toBe(['smile', 'cry']);

    $smile = Smiley::where('code', 'smile')->firstOrFail();

    // 落盘路径由分组隔离，扩展名取探测结果而不是包内命名
    expect($smile->image)->toBe('smileys/group-'.$group->id.'/smile.png');
    expect(Storage::disk('public')->exists($smile->image))->toBeTrue();

    $cry = Smiley::where('code', 'cry')->firstOrFail();
    expect($cry->sort)->toBe(5);

    // 导入完必须刷新评论侧的表情缓存
    expect(app(CommentService::class)->replaceSmileys(':smile:'))->toContain('/storage/smileys/group-');
});

test('packs without json fall back to image file names', function () {
    $pack = uploadSmileyPack([
        'happy.png' => tinyPng(),
        'wink.gif' => base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', true),
        'cover.jpg' => 'not an image at all',
    ], 'stickers');

    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', ['pack' => $pack])
        ->assertSessionHasNoErrors();

    // 分组名兜底用 zip 文件名（去掉扩展名）
    $group = SmileyGroup::where('name', 'stickers')->firstOrFail();

    expect($group->smileys()->pluck('code')->sort()->values()->all())->toBe(['happy', 'wink']);
});

test('taken codes are skipped and colliding group names get a suffix', function () {
    SmileyGroup::create(['name' => '黄脸包', 'sort' => 1]);
    Smiley::create([
        'group_id' => SmileyGroup::first()->id,
        'code' => 'smile',
        'image' => 'smileys/legacy.png',
        'sort' => 0,
    ]);

    $pack = uploadSmileyPack([
        'config.json' => packManifest([
            ['code' => 'smile', 'image' => 'smile.png'],
            ['code' => 'cry', 'image' => 'cry.png'],
            ['code' => 'cry', 'image' => 'cry.png'],
        ]),
        'smile.png' => tinyPng(),
        'cry.png' => tinyPng(),
    ]);

    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', ['pack' => $pack])
        ->assertSessionHasNoErrors();

    $group = SmileyGroup::where('name', '黄脸包 (2)')->firstOrFail();

    // 已存在的与包内重复的 cry 都跳过，只剩一个 cry
    expect($group->smileys()->pluck('code')->all())->toBe(['cry']);
});

test('entry paths escaping the archive are never matched', function () {
    $pack = uploadSmileyPack([
        'smileys.json' => packManifest([['code' => 'evil', 'image' => '../../evil.png']]),
        'evil.png' => tinyPng(),
    ]);

    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', ['pack' => $pack])
        ->assertSessionHasErrors('pack');

    expect(SmileyGroup::count())->toBe(0);
    expect(Smiley::count())->toBe(0);
    expect(Storage::disk('public')->exists('evil.png'))->toBeFalse();
});

test('a file that is not a zip is rejected', function () {
    $directory = sys_get_temp_dir().'/smiley-broken-'.uniqid('', true);
    mkdir($directory, 0o700, true);

    $notZip = $directory.'/broken.zip';
    file_put_contents($notZip, 'this is definitely not a zip archive');

    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', ['pack' => new UploadedFile($notZip, 'broken.zip', 'application/zip', null, true)])
        ->assertSessionHasErrors('pack');

    expect(SmileyGroup::count())->toBe(0);
});

test('corrupted config json reports a parse error', function () {
    $this->actingAs($this->admin)
        ->post('/admin/smileys/pack', [
            'pack' => uploadSmileyPack(['smileys.json' => '{"name": "x", "smileys": [', 'smile.png' => tinyPng()]),
        ])
        ->assertSessionHasErrors('pack');
});

test('guests and non admins cannot import packs', function () {
    $pack = uploadSmileyPack(['smile.png' => tinyPng()]);

    $this->post('/admin/smileys/pack', ['pack' => $pack])->assertRedirect();

    $this->actingAs(User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]))
        ->post('/admin/smileys/pack', ['pack' => $pack])
        ->assertRedirect();

    expect(SmileyGroup::count())->toBe(0);
});

test('single smiley can be added by uploading a file without the url field', function () {
    $group = SmileyGroup::create(['name' => '小黄脸', 'sort' => 1]);

    // 旧的 image:required 校验让「只传文件」这条路必然 422，这里回归
    $this->actingAs($this->admin)
        ->post('/admin/smileys', [
            'group_id' => $group->id,
            'code' => 'ok',
            'image_file' => UploadedFile::fake()->image('ok.png'),
        ])
        ->assertSessionHasNoErrors();

    $smiley = Smiley::where('code', 'ok')->firstOrFail();

    expect($smiley->image)->toStartWith('smileys/');
    expect(Storage::disk('public')->exists($smiley->image))->toBeTrue();
});
