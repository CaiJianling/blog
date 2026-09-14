<?php

/*
 * 密码重置语言行（对应 Laravel 框架 en/passwords.php 的键）。
 *
 * Fortify 发送重置链接后通过 trans('passwords.sent') 写入 status 闪讯，
 * 缺失此文件时会回退到框架内置英文。
 */

return [

    'reset' => '您的密码已重置。',

    'sent' => '我们已将密码重置链接发送到您的邮箱。',

    'throttled' => '请等待片刻再重试。',

    'token' => '此密码重置令牌无效。',

    'user' => '找不到与该邮箱地址匹配的用户。',

];
