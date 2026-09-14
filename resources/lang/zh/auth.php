<?php

/*
 * 认证语言行（对应 Laravel 框架 en/auth.php 的键）。
 *
 * 登录失败使用 auth.failed，登录过于频繁使用 auth.throttle，
 * 缺失时同样会回退到框架内置英文。
 */

return [
    'failed' => '邮箱或密码错误。',
    'password' => '提供的密码不正确。',
    'throttle' => '尝试登录次数过多，请 :seconds 秒后再试。',
    'The provided password was incorrect.' => '提供的密码不正确。',
];
