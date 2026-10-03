<?php

use App\Models\Article;
use App\Models\Comment;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->author = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
    $this->article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Edit Test Post',
        'slug' => 'edit-test',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);
    $this->comment = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '作者',
        'author_email' => $this->author->email,
        'ip' => '127.0.0.1',
        'content' => '原始内容',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => $this->author->id,
        'is_private' => false,
        'notify_mail' => false,
        'is_markdown' => true,
        'created_at' => now()->subDay(),
    ]);
});

test('非管理员编辑本人评论进入待审修订', function () {
    $response = $this->actingAs($this->author)
        ->put("/comments/{$this->comment->comment_id}", ['content' => '修改后的内容']);

    $response->assertRedirect();

    $this->comment->refresh();
    expect($this->comment->content)->toBe('原始内容')
        ->and($this->comment->edited_content)->toBe('修改后的内容')
        ->and($this->comment->edited_at)->toBeNull()
        ->and($this->comment->hasPendingEdit())->toBeTrue();
});

test('管理员编辑本人评论直接生效', function () {
    $adminComment = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '管理员',
        'author_email' => $this->admin->email,
        'ip' => '127.0.0.1',
        'content' => '管理员原始内容',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => $this->admin->id,
        'is_private' => false,
        'notify_mail' => false,
        'is_markdown' => true,
        'created_at' => now()->subDay(),
    ]);

    $response = $this->actingAs($this->admin)
        ->put("/comments/{$adminComment->comment_id}", ['content' => '管理员新内容']);

    $response->assertRedirect();

    $adminComment->refresh();
    expect($adminComment->content)->toBe('管理员新内容')
        ->and($adminComment->edited_content)->toBeNull()
        ->and($adminComment->edited_at)->not->toBeNull()
        ->and($adminComment->hasPendingEdit())->toBeFalse();
});

test('不能编辑他人的评论', function () {
    $other = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);

    $this->actingAs($other)
        ->put("/comments/{$this->comment->comment_id}", ['content' => '篡改'])
        ->assertForbidden();

    $this->comment->refresh();
    expect($this->comment->content)->toBe('原始内容')
        ->and($this->comment->edited_content)->toBeNull();
});

test('游客评论不能被编辑', function () {
    $guest = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '游客',
        'author_email' => 'guest@example.com',
        'ip' => '127.0.0.1',
        'content' => '游客内容',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => 0,
        'is_private' => false,
        'notify_mail' => false,
        'is_markdown' => true,
    ]);

    $this->actingAs($this->author)
        ->put("/comments/{$guest->comment_id}", ['content' => '冒名修改'])
        ->assertForbidden();
});

test('未登录不能编辑评论', function () {
    $this->put("/comments/{$this->comment->comment_id}", ['content' => '未登录修改'])
        ->assertForbidden();
});

test('回收站中的评论不能编辑', function () {
    $this->comment->update(['status' => 'trash']);

    $this->actingAs($this->author)
        ->putJson("/comments/{$this->comment->comment_id}", ['content' => '改回收站'])
        ->assertStatus(422);

    $this->comment->refresh();
    expect($this->comment->edited_content)->toBeNull();
});

test('后台编辑：非管理员进入待审，管理员直接生效', function () {
    $this->actingAs($this->author)
        ->put("/admin/comments/{$this->comment->comment_id}/update", ['content' => '后台修改']);

    $this->comment->refresh();
    expect($this->comment->content)->toBe('原始内容')
        ->and($this->comment->edited_content)->toBe('后台修改');

    $this->actingAs($this->admin)
        ->put("/admin/comments/{$this->comment->comment_id}/update", ['content' => '管理员后台修改']);

    $this->comment->refresh();
    expect($this->comment->content)->toBe('管理员后台修改')
        ->and($this->comment->edited_content)->toBeNull()
        ->and($this->comment->edited_at)->not->toBeNull();
});

test('通过修订：待审内容替换正文并记录最后编辑时间', function () {
    $this->comment->update(['edited_content' => '待审新内容']);

    $this->actingAs($this->admin)
        ->put("/admin/comments/{$this->comment->comment_id}/approve-edit")
        ->assertRedirect();

    $this->comment->refresh();
    expect($this->comment->content)->toBe('待审新内容')
        ->and($this->comment->edited_content)->toBeNull()
        ->and($this->comment->edited_at)->not->toBeNull();
});

test('无待审修订时不能通过修订', function () {
    $this->actingAs($this->admin)
        ->put("/admin/comments/{$this->comment->comment_id}/approve-edit")
        ->assertNotFound();
});

test('拒绝修订：丢弃待审内容，正文保持不变', function () {
    $this->comment->update(['edited_content' => '待审新内容']);

    $this->actingAs($this->admin)
        ->put("/admin/comments/{$this->comment->comment_id}/reject-edit")
        ->assertRedirect();

    $this->comment->refresh();
    expect($this->comment->content)->toBe('原始内容')
        ->and($this->comment->edited_content)->toBeNull()
        ->and($this->comment->edited_at)->toBeNull();
});

test('前台文章页评论数据包含编辑相关字段', function () {
    $this->comment->update(['edited_content' => '待审新内容', 'edited_at' => now()->subHour()]);

    $this->actingAs($this->author)
        ->get('/'.$this->article->id.'.html')
        ->assertOk()
        ->assertInertia(function ($page) {
            $comments = collect($page->toArray()['props']['comments']);
            $own = $comments->firstWhere('comment_id', $this->comment->comment_id);

            expect($own)->not->toBeNull()
                ->and($own['content'])->toBe('原始内容')
                ->and($own['pending_edit'])->toBe('待审新内容')
                ->and($own['has_pending_edit'])->toBeTrue()
                ->and($own['edited_at'])->not->toBeNull();
        });
});
