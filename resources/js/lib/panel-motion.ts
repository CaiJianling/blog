import type { Transition } from 'framer-motion';

/**
 * 浮窗（前台右下角的设置弹窗与小助手面板）的开合曲线，两处必须一致才像同一套材质。
 *
 * 入场用临界阻尼弹簧（bounce 0）：弹窗是被点开的，手势里没有动量，
 * 带过冲的弹簧会让它落位后再晃一下。离场用短的 easeIn：收起是「离开」，
 * 比展开更快才不会让人觉得卡了一下。
 */
export const panelEnter: Transition = { type: 'spring', bounce: 0, duration: 0.34 };

export const panelExit: Transition = { duration: 0.16, ease: 'easeIn' };
