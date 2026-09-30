import type { Transition } from 'framer-motion';

/**
 * 浮窗（前台右下角的设置弹窗与小助手面板）的开合曲线，两处必须一致才像同一套材质。
 *
 * 入场是「液态果冻」弹簧：整体带过冲才有 duang 的弹回，再把缩放拆成 X / Y 两轴——
 * Y 弹得更久、回弹更狠，两条曲线错相，面板落位时先竖向拽长再横向晃回来，
 * 看着就像水做的一样。opacity 与 y 走默认那档较快的弹簧（它们不需要形变）。
 * 离场保持短的 easeIn：收起是「离开」，跟着一起弹只会显得拖沓。
 */
export const panelEnter: Transition = {
    type: 'spring',
    bounce: 0.3,
    duration: 0.42,
    scaleX: { type: 'spring', bounce: 0.52, duration: 0.66 },
    scaleY: { type: 'spring', bounce: 0.72, duration: 0.82 },
};

export const panelExit: Transition = { duration: 0.16, ease: 'easeIn' };
