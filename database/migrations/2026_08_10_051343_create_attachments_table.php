<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id()->comment('素材ID');
            $table->foreignId('author_id')->constrained('users')->comment('上传者users.ID');
            $table->string('file_name', 255)->comment('原始文件名');
            $table->string('file_path', 255)->comment('服务器存储路径/OSS地址');
            $table->string('mime_type', 100)->comment('文件类型 image/jpeg、video/mp4');
            $table->bigInteger('file_size')->default(0)->comment('文件大小字节');
            $table->integer('width')->nullable()->comment('图片宽');
            $table->integer('height')->nullable()->comment('图片高');
            $table->string('parent_type', 32)->nullable()->comment('归属类型 article/page');
            $table->unsignedBigInteger('parent_id')->nullable()->comment('归属文章/页面ID');
            $table->timestamps();

            $table->index(['parent_type', 'parent_id'], 'idx_parent');
            $table->index('mime_type', 'idx_mime');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
