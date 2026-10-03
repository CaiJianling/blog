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
        Schema::table('articles', function (Blueprint $table) {
            $table->string('meta_title', 200)->nullable()->after('excerpt')->comment('SEO 标题，留空则使用文章标题');
            $table->text('meta_description')->nullable()->after('meta_title')->comment('SEO 描述，留空则使用摘要');
        });

        Schema::table('pages', function (Blueprint $table) {
            $table->string('meta_title', 200)->nullable()->after('slug')->comment('SEO 标题，留空则使用页面标题');
            $table->text('meta_description')->nullable()->after('meta_title')->comment('SEO 描述');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['meta_title', 'meta_description']);
        });

        Schema::table('pages', function (Blueprint $table) {
            $table->dropColumn(['meta_title', 'meta_description']);
        });
    }
};
