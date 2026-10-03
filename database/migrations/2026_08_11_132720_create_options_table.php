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
        Schema::create('options', function (Blueprint $table) {
            $table->bigIncrements('option_id');
            $table->string('option_name', 191)->default('');
            $table->longText('option_value');
            $table->string('autoload', 20)->default('yes');
            $table->unique('option_name', 'idx_option_name');
            $table->index('autoload', 'idx_autoload');
        });

        // Seed default site options
        $defaults = [
            'site_title' => '又一个 CMS 站点',
            'site_tagline' => '又一个 CMS 站点',
            'site_icon' => '',
            'cms_url' => config('app.url'),
            'site_url' => config('app.url'),
            'admin_email' => config('mail.from.address', 'admin@example.com'),
            'membership' => '0',
            'default_role' => 'subscriber',
            'site_language' => 'zh',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y年n月j日',
            'time_format' => 'ag:i',
            'start_of_week' => '1',
        ];

        foreach ($defaults as $name => $value) {
            DB::table('options')->insert([
                'option_name' => $name,
                'option_value' => is_array($value) ? json_encode($value) : (string) $value,
                'autoload' => 'yes',
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('options');
    }
};
