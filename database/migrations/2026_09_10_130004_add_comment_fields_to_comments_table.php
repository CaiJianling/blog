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
        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedInteger('user_id')->nullable()->change();
            $table->boolean('is_private')->default(false)->after('user_id');
            $table->boolean('notify_mail')->default(false)->after('is_private');
            $table->boolean('is_markdown')->default(true)->after('notify_mail');
            $table->string('author_qq', 20)->nullable()->after('author_email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedInteger('user_id')->notNull()->default(0)->change();
            $table->dropColumn(['is_private', 'notify_mail', 'is_markdown', 'author_qq']);
        });
    }
};
