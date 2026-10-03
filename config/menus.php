<?php

/**
 * 前台菜单位置
 * 键为 nav_menus.slug（MenuService 按 slug 取用对应挂点），值为后台
 * 「菜单设置」中展示的位置名称。位置固定、不可增删，因此菜单管理页只维护
 * 菜单项，不提供创建/删除菜单；每个位置对应一条 nav_menus 记录。
 */

return [
    'locations' => [
        'top' => '顶部导航',
    ],
];
