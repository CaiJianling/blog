import { useEffect, useRef } from 'react';
import { useAppearance } from '@/hooks/use-appearance';

interface GridNode {
    restX: number;
    restY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface WhalePoint {
    x: number;
    y: number;
}

interface Palette {
    baseStops: [number, string][];
    inkStops: [number, string][];
    warmStops: [number, string][];
    ribbonColors: string[];
    ribbonWidths: number[];
    cursorGlowActive: string;
    cursorGlowIdle: string;
    cursorGlowEnd: string;
    grain: string;
    gridLine: string;
    gridDot: string;
    letterDot: string;
    letterBaseAlpha: number;
    letterBaseAlphaCompact: number;
    whaleGlowStops: [string, string, string];
}

const DARK_PALETTE: Palette = {
    baseStops: [
        [0, '#040508'],
        [0.28, '#090d14'],
        [0.52, '#101827'],
        [0.7, '#17243a'],
        [0.84, '#0d121d'],
        [1, '#050609'],
    ],
    inkStops: [
        [0, 'rgba(24, 45, 78, 0.48)'],
        [0.46, 'rgba(18, 33, 58, 0.24)'],
        [1, 'rgba(5, 9, 16, 0)'],
    ],
    warmStops: [
        [0, 'rgba(142, 160, 185, 0.26)'],
        [0.25, 'rgba(68, 85, 111, 0.16)'],
        [0.72, 'rgba(20, 31, 49, 0.08)'],
        [1, 'rgba(0, 0, 0, 0)'],
    ],
    ribbonColors: ['rgba(192, 202, 214, 0.18)', 'rgba(91, 117, 151, 0.2)', 'rgba(32, 52, 84, 0.2)'],
    ribbonWidths: [0, 0, 0],
    cursorGlowActive: 'rgba(100, 130, 170, 0.15)',
    cursorGlowIdle: 'rgba(100, 130, 170, 0.06)',
    cursorGlowEnd: 'rgba(27, 44, 70, 0)',
    grain: 'rgba(255, 255, 255, 0.055)',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    gridDot: 'rgba(255, 255, 255, 0.16)',
    letterDot: 'rgba(205, 216, 230,',
    letterBaseAlpha: 0.14,
    letterBaseAlphaCompact: 0.11,
    whaleGlowStops: ['rgba(230,237,246,', 'rgba(188,204,224,', 'rgba(97,124,160,0)'],
};

const LIGHT_PALETTE: Palette = {
    baseStops: [
        [0, '#f8fafc'],
        [0.28, '#eef2f7'],
        [0.52, '#e6ecf4'],
        [0.7, '#dce5f0'],
        [0.84, '#e7ecf4'],
        [1, '#f6f8fb'],
    ],
    inkStops: [
        [0, 'rgba(96, 130, 180, 0.14)'],
        [0.46, 'rgba(148, 163, 184, 0.08)'],
        [1, 'rgba(248, 250, 252, 0)'],
    ],
    warmStops: [
        [0, 'rgba(148, 163, 184, 0.12)'],
        [0.25, 'rgba(203, 213, 225, 0.08)'],
        [0.72, 'rgba(241, 245, 249, 0.03)'],
        [1, 'rgba(0, 0, 0, 0)'],
    ],
    ribbonColors: ['rgba(100, 130, 175, 0.12)', 'rgba(70, 105, 150, 0.1)', 'rgba(160, 180, 205, 0.1)'],
    ribbonWidths: [0, 0, 0],
    cursorGlowActive: 'rgba(59, 130, 246, 0.1)',
    cursorGlowIdle: 'rgba(59, 130, 246, 0.04)',
    cursorGlowEnd: 'rgba(226, 232, 240, 0)',
    grain: 'rgba(15, 23, 42, 0.045)',
    gridLine: 'rgba(15, 23, 42, 0.07)',
    gridDot: 'rgba(15, 23, 42, 0.14)',
    letterDot: 'rgba(51, 65, 85,',
    letterBaseAlpha: 0.17,
    letterBaseAlphaCompact: 0.13,
    whaleGlowStops: ['rgba(147, 197, 253,', 'rgba(191, 219, 254,', 'rgba(226, 232, 240, 0)'],
};

interface HeroCanvasProps {
    /** 点阵剪影显示的应用名。 */
    name?: string;
}

export default function HeroCanvas({ name = '' }: HeroCanvasProps) {
    const ambientRef = useRef<HTMLDivElement>(null);
    const fluidRef = useRef<HTMLCanvasElement>(null);
    const gridRef = useRef<HTMLCanvasElement>(null);
    const whaleRef = useRef<HTMLCanvasElement>(null);
    const { resolvedAppearance } = useAppearance();

    useEffect(() => {
        const ambient = ambientRef.current;
        const fluidCanvas = fluidRef.current;
        const gridCanvas = gridRef.current;
        const whaleCanvas = whaleRef.current;

        if (!ambient || !fluidCanvas || !gridCanvas || !whaleCanvas) {
            return;
        }

        const fluidCtx = fluidCanvas.getContext('2d');
        const gridCtx = gridCanvas.getContext('2d');
        const whaleCtx = whaleCanvas.getContext('2d');

        if (!fluidCtx || !gridCtx || !whaleCtx) {
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
        const compact = window.matchMedia('(max-width: 767px)');
        const dark = resolvedAppearance === 'dark';
        const P = dark ? DARK_PALETTE : LIGHT_PALETTE;

        let gridNodes: GridNode[] = [];
        let gridCols = 0;
        let gridRows = 0;
        let whalePoints: WhalePoint[] = [];
        let width = 1;
        let height = 1;
        let dpr = 1;
        let frame = 0;
        let visible = true;
        const pointer = { x: -1000, y: -1000, active: false };
        const pointerEase = { x: 0, y: 0 };
        let pointerStrength = 0;
        let whaleHovered = false;
        let lastFrameTime = 0;

        function hash(seed: number): number {
            const value = Math.sin(seed * 12.9898) * 43758.5453;

            return value - Math.floor(value);
        }

        const sizeCanvases = () => {
            const rect = ambient.getBoundingClientRect();

            width = Math.max(1, Math.round(rect.width));
            height = Math.max(1, Math.round(rect.height));
            dpr = Math.min(window.devicePixelRatio || 1, 2);

            // 官方分层分辨率：流体 1x（大模糊不需要 Retina）、网格 2x、点阵 1.5x
            for (const [canvas, ctx, ratio] of [
                [fluidCanvas, fluidCtx, 1],
                [gridCanvas, gridCtx, dpr],
                [whaleCanvas, whaleCtx, Math.min(dpr, 1.5)],
            ] as const) {
                canvas.width = Math.round(width * ratio);
                canvas.height = Math.round(height * ratio);
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            }

            pointerEase.x = width * 0.5;
            pointerEase.y = height * 0.34;
            rebuildGrid();
        };

        const rebuildGrid = () => {
            gridCols = Math.ceil(width / 90) + 1;
            gridRows = Math.ceil(height / 90) + 1;

            const offsetX = (width - (gridCols - 1) * 90) / 2;
            const offsetY = (height - (gridRows - 1) * 90) / 2;

            gridNodes = [];

            for (let row = 0; row < gridRows; row += 1) {
                for (let col = 0; col < gridCols; col += 1) {
                    const x = offsetX + col * 90;
                    const y = offsetY + row * 90;

                    gridNodes.push({ restX: x, restY: y, x, y, vx: 0, vy: 0 });
                }
            }
        };

        const drawFluid = (time: number) => {
            fluidCtx.clearRect(0, 0, width, height);

            const base = fluidCtx.createLinearGradient(0, height, width, 0);

            for (const [stop, color] of P.baseStops) {
                base.addColorStop(stop, color);
            }

            fluidCtx.fillStyle = base;
            fluidCtx.fillRect(0, 0, width, height);

            pointerEase.x += ((pointer.active ? pointer.x : width * 0.62) - pointerEase.x) * 0.025;
            pointerEase.y += ((pointer.active ? pointer.y : height * 0.22) - pointerEase.y) * 0.025;
            fluidCtx.globalCompositeOperation = 'screen';

            // 漂移的墨蓝光斑
            const inkX = width * (0.18 + Math.sin(time * 0.13) * 0.05);
            const inkY = height * (0.16 + Math.cos(time * 0.11) * 0.06);
            const ink = fluidCtx.createRadialGradient(inkX, inkY, 0, inkX, inkY, Math.max(width, height) * 0.62);

            for (const [stop, color] of P.inkStops) {
                ink.addColorStop(stop, color);
            }

            fluidCtx.fillStyle = ink;
            fluidCtx.fillRect(0, 0, width, height);

            // 暖灰光斑
            const warmX = width * (0.77 + Math.sin(time * 0.09) * 0.035);
            const warmY = height * (0.03 + Math.cos(time * 0.12) * 0.045);
            const warm = fluidCtx.createRadialGradient(warmX, warmY, 0, warmX, warmY, Math.max(width, height) * 0.44);

            for (const [stop, color] of P.warmStops) {
                warm.addColorStop(stop, color);
            }

            fluidCtx.fillStyle = warm;
            fluidCtx.fillRect(0, 0, width, height);

            // 宽模糊光带（模拟官方着色器的液态光褶皱）
            fluidCtx.save();
            fluidCtx.filter = `blur(${Math.max(24, width * 0.028)}px)`;
            fluidCtx.lineCap = 'round';
            fluidCtx.lineJoin = 'round';

            const ribbonPaths = [
                {
                    from: [0.45 + Math.sin(time * 0.1) * 0.025, -0.16],
                    c1: [0.56, 0.06],
                    c2: [0.39 + Math.cos(time * 0.08) * 0.025, 0.19],
                    to: [0.51, 0.43],
                },
                {
                    from: [0.67, -0.13],
                    c1: [0.87 + Math.sin(time * 0.07) * 0.025, 0.05],
                    c2: [1.02, 0.24],
                    to: [1.04, 0.58],
                },
                {
                    from: [-0.08, 0.65],
                    c1: [0.12, 0.42 + Math.sin(time * 0.09) * 0.035],
                    c2: [0.22, 0.42],
                    to: [0.4, 0.7],
                },
            ];

            const ribbonWidths = [
                Math.max(62, width * 0.07),
                Math.max(86, width * 0.095),
                Math.max(74, width * 0.08),
            ];

            P.ribbonColors.forEach((color, index) => {
                const path = ribbonPaths[index];

                fluidCtx.strokeStyle = color;
                fluidCtx.lineWidth = ribbonWidths[index];
                fluidCtx.beginPath();
                fluidCtx.moveTo(width * path.from[0], height * path.from[1]);
                fluidCtx.bezierCurveTo(
                    width * path.c1[0],
                    height * path.c1[1],
                    width * path.c2[0],
                    height * path.c2[1],
                    width * path.to[0],
                    height * path.to[1],
                );
                fluidCtx.stroke();
            });

            fluidCtx.restore();

            // 鼠标跟随光晕
            const cursorGlow = fluidCtx.createRadialGradient(
                pointerEase.x,
                pointerEase.y,
                0,
                pointerEase.x,
                pointerEase.y,
                210,
            );

            cursorGlow.addColorStop(0, pointer.active ? P.cursorGlowActive : P.cursorGlowIdle);
            cursorGlow.addColorStop(1, P.cursorGlowEnd);
            fluidCtx.fillStyle = cursorGlow;
            fluidCtx.fillRect(0, 0, width, height);

            fluidCtx.globalCompositeOperation = 'source-over';

            // 颗粒
            fluidCtx.fillStyle = P.grain;
            const grainCount = Math.min(420, Math.round((width * height) / 2400));

            for (let grain = 0; grain < grainCount; grain += 1) {
                fluidCtx.fillRect(hash(grain + 4) * width, hash(grain + 307) * height, 1, 1);
            }
        };

        const drawGrid = () => {
            gridCtx.clearRect(0, 0, width, height);

            for (const node of gridNodes) {
                if (pointer.active) {
                    const dx = node.x - pointer.x;
                    const dy = node.y - pointer.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 140 && distance > 0.1) {
                        const force = (1 - distance / 140) * 30;

                        node.vx += (dx / distance) * force * 0.1;
                        node.vy += (dy / distance) * force * 0.1;
                    }
                }

                node.vx += (node.restX - node.x) * 0.05;
                node.vy += (node.restY - node.y) * 0.05;
                node.vx *= 0.85;
                node.vy *= 0.85;
                node.x += node.vx;
                node.y += node.vy;
            }

            gridCtx.strokeStyle = P.gridLine;
            gridCtx.lineWidth = 0.5;

            for (let row = 0; row < gridRows; row += 1) {
                for (let col = 0; col < gridCols - 1; col += 1) {
                    const left = gridNodes[row * gridCols + col];
                    const right = gridNodes[row * gridCols + col + 1];

                    gridCtx.beginPath();
                    gridCtx.moveTo(left.x + 10, left.y);
                    gridCtx.lineTo(right.x - 10, right.y);
                    gridCtx.stroke();
                }
            }

            for (let col = 0; col < gridCols; col += 1) {
                for (let row = 0; row < gridRows - 1; row += 1) {
                    const top = gridNodes[row * gridCols + col];
                    const bottom = gridNodes[(row + 1) * gridCols + col];

                    gridCtx.beginPath();
                    gridCtx.moveTo(top.x, top.y + 10);
                    gridCtx.lineTo(bottom.x, bottom.y - 10);
                    gridCtx.stroke();
                }
            }

            gridCtx.fillStyle = P.gridDot;
            gridNodes.forEach((node) => {
                let dotSize = 3.6;

                if (pointer.active) {
                    const dx = node.x - pointer.x;
                    const dy = node.y - pointer.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 140) dotSize += (1 - distance / 140) * 4;
                }

                gridCtx.fillRect(node.x - dotSize / 2, node.y - dotSize / 2, dotSize, dotSize);
            });
        };

        // 点阵剪影采样：把应用名绘制到 60×60 采样画布后按亮度取点
        const sampleLetter = () => {
            const sampleSize = 60;
            const sampleCanvas = document.createElement('canvas');

            sampleCanvas.width = sampleSize;
            sampleCanvas.height = sampleSize;

            const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

            if (!sampleCtx) return;

            const text = (name || 'B').trim().toUpperCase() || 'B';

            sampleCtx.fillStyle = '#000';
            sampleCtx.fillRect(0, 0, sampleSize, sampleSize);
            sampleCtx.fillStyle = '#fff';
            sampleCtx.textAlign = 'center';
            sampleCtx.textBaseline = 'middle';

            // 名称过长时缩小字号以适配采样宽度
            let fontSize = 40;

            do {
                sampleCtx.font = `900 ${fontSize}px system-ui, sans-serif`;

                if (sampleCtx.measureText(text).width <= sampleSize - 4) {
                    break;
                }

                fontSize -= 2;
            } while (fontSize > 10);

            sampleCtx.fillText(text, sampleSize / 2, sampleSize / 2 + 1);

            const pixels = sampleCtx.getImageData(0, 0, sampleSize, sampleSize).data;
            const luminance = new Float32Array(sampleSize * sampleSize);

            for (let p = 0; p < sampleSize * sampleSize; p += 1) {
                luminance[p] = (pixels[p * 4] * 0.299 + pixels[p * 4 + 1] * 0.587 + pixels[p * 4 + 2] * 0.114) / 255;
            }

            whalePoints = [];

            for (let y = 0; y < sampleSize; y += 1) {
                for (let x = 0; x < sampleSize; x += 1) {
                    if (luminance[y * sampleSize + x] <= 0.2) continue;

                    let neighbors = 0;

                    for (let oy = -2; oy <= 2; oy += 1) {
                        for (let ox = -2; ox <= 2; ox += 1) {
                            if (!ox && !oy) continue;

                            const nx = x + ox;
                            const ny = y + oy;

                            if (nx >= 0 && ny >= 0 && nx < sampleSize && ny < sampleSize && luminance[ny * sampleSize + nx] > 0.2) {
                                neighbors += 1;
                            }
                        }
                    }

                    if (!neighbors) continue;
                    whalePoints.push({ x, y });
                }
            }
        };

        const drawWhale = (time: number) => {
            whaleCtx.clearRect(0, 0, width, height);
            if (!whalePoints.length) return;

            const baseAlpha = compact.matches ? P.letterBaseAlphaCompact : P.letterBaseAlpha;
            // 以屏幕宽度为基准自适应
            const silhouetteSize = compact.matches
                ? width * 0.96
                : width * 0.92;
            const pointStep = silhouetteSize / 60;
            // 点阵居中（位于文案后方，低透明度作背景装饰）
            const centerX = width * 0.5;
            const centerY = height * (compact.matches ? 0.3 : 0.44) + Math.sin(time * 0.4) * (compact.matches ? 3 : 7);
            const groupScale = 0.956;
            const rotation = 0.04 * Math.sin(time * 0.25);

            const pointerTarget = whaleHovered && pointer.active ? 1 : 0;
            const pointerEaseRate = pointerTarget > pointerStrength ? 0.3 : 0.14;

            pointerStrength += (pointerTarget - pointerStrength) * pointerEaseRate;

            const mouseX = pointer.x - centerX;
            const mouseY = pointer.y - centerY;
            const mouseRadius = silhouetteSize * 0.15;

            whaleCtx.save();
            whaleCtx.translate(centerX, centerY);
            whaleCtx.rotate(rotation);
            whaleCtx.scale(groupScale, groupScale * (1 + Math.sin(time * 0.08) * 0.025));

            if (pointerStrength > 0.01 && !reduceMotion.matches) {
                const glow = whaleCtx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, mouseRadius);

                glow.addColorStop(0, `${P.whaleGlowStops[0]}${(0.13 * pointerStrength).toFixed(3)})`);
                glow.addColorStop(0.34, `${P.whaleGlowStops[1]}${(0.065 * pointerStrength).toFixed(3)})`);
                glow.addColorStop(1, P.whaleGlowStops[2]);
                whaleCtx.fillStyle = glow;
                whaleCtx.beginPath();
                whaleCtx.arc(mouseX, mouseY, mouseRadius, 0, Math.PI * 2);
                whaleCtx.fill();
            }

            whalePoints.forEach((point) => {
                const targetX = (point.x - 30) * pointStep;
                const targetY = (point.y - 30) * pointStep;
                let x = targetX;
                let y = targetY;
                const activity = reduceMotion.matches ? 0 : pointerStrength;

                let mouseInfluence = 0;
                let wave = 0;

                if (pointerStrength > 0.01 && !reduceMotion.matches) {
                    const mouseDx = x - mouseX;
                    const mouseDy = y - mouseY;
                    const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

                    if (mouseDistance < mouseRadius && mouseDistance > 0.1) {
                        const mouseFalloff = 1 - mouseDistance / mouseRadius;

                        mouseInfluence = mouseFalloff * mouseFalloff * (3 - 2 * mouseFalloff);
                        wave = Math.sin((mouseDistance / pointStep) * 1.35 - time * 10.5);

                        const direction = Math.atan2(mouseDy, mouseDx);
                        const seed = point.y * 60 + point.x + 1;
                        const randomAngleA = hash(seed + 23) * Math.PI * 2;
                        const randomAngleB = hash(seed + 211) * Math.PI * 2;
                        const randomPulseA = Math.sin(time * (4.8 + hash(seed + 67) * 3.2) + hash(seed + 101) * Math.PI * 2);
                        const randomPulseB = Math.cos(time * (5.6 + hash(seed + 307) * 2.6) + hash(seed + 401) * Math.PI * 2);
                        const randomForce = mouseInfluence * activity * pointStep * 3.05;
                        const rippleForce = mouseInfluence * activity * pointStep * wave * 0.65;

                        x += Math.cos(randomAngleA) * randomPulseA * randomForce;
                        y += Math.sin(randomAngleA) * randomPulseA * randomForce;
                        x += Math.cos(randomAngleB) * randomPulseB * randomForce * 0.42;
                        y += Math.sin(randomAngleB) * randomPulseB * randomForce * 0.42;
                        x += Math.cos(direction) * rippleForce;
                        y += Math.sin(direction) * rippleForce;
                    }
                }

                const pointAlpha = Math.min(0.6, baseAlpha + mouseInfluence * activity * 0.3);

                whaleCtx.fillStyle = `${P.letterDot}${pointAlpha.toFixed(3)})`;
                const pointSize = Math.max(1.4, pointStep * 0.3);

                whaleCtx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
            });

            whaleCtx.restore();
        };

        const drawFrame = (now: number) => {
            const time = reduceMotion.matches ? 0 : now / 1000;

            drawFluid(time);

            if (!compact.matches) {
                drawGrid();
            } else {
                gridCtx.clearRect(0, 0, width, height);
            }

            drawWhale(time);
        };

        const tick = (time: number) => {
            frame = 0;

            if (!visible || document.hidden || reduceMotion.matches) return;

            const interval = 1000 / (compact.matches ? 20 : 30);

            if (time - lastFrameTime >= interval) {
                lastFrameTime = time - ((time - lastFrameTime) % interval);
                drawFrame(time);
            }

            frame = window.requestAnimationFrame(tick);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!finePointer.matches) return;

            const rect = ambient.getBoundingClientRect();

            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;

            const silhouetteSize = width * 0.92;
            const centerX = width * 0.5;
            const centerY = height * 0.44;

            whaleHovered =
                Math.abs(pointer.x - centerX) < silhouetteSize * 0.54 &&
                Math.abs(pointer.y - centerY) < silhouetteSize * 0.43;
        };

        const onPointerLeave = () => {
            pointer.active = false;
            whaleHovered = false;
        };

        function syncAnimation() {
            if (frame) window.cancelAnimationFrame(frame);

            frame = 0;
            drawFrame(performance.now());

            if (!reduceMotion.matches && visible && !document.hidden) {
                frame = window.requestAnimationFrame(tick);
            }
        }

        const onVisibilityChange = () => {
            syncAnimation();
        };

        const onReduceMotionChange = () => {
            syncAnimation();
        };

        const onCompactChange = () => {
            sizeCanvases();
            syncAnimation();
        };

        // 初始化
        sampleLetter();
        sizeCanvases();
        syncAnimation();

        const heroElement = ambient.parentElement ?? ambient;

        heroElement.addEventListener('pointermove', onPointerMove, { passive: true });
        heroElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
        document.addEventListener('visibilitychange', onVisibilityChange);
        reduceMotion.addEventListener?.('change', onReduceMotionChange);
        compact.addEventListener?.('change', onCompactChange);

        if (window.ResizeObserver) {
            new ResizeObserver(() => {
                sizeCanvases();
                syncAnimation();
            }).observe(ambient);
        } else {
            window.addEventListener('resize', onCompactChange, { passive: true });
        }

        if (window.IntersectionObserver) {
            new IntersectionObserver(
                (entries) => {
                    visible = entries[0] ? entries[0].isIntersecting : true;
                    syncAnimation();
                },
                { threshold: 0.02 },
            ).observe(ambient);
        }

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            heroElement.removeEventListener('pointermove', onPointerMove);
            heroElement.removeEventListener('pointerleave', onPointerLeave);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            reduceMotion.removeEventListener?.('change', onReduceMotionChange);
            compact.removeEventListener?.('change', onCompactChange);
        };
    }, [resolvedAppearance, name]);

    return (
        <div ref={ambientRef} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
            <canvas ref={fluidRef} className="absolute inset-0 block h-full w-full opacity-[0.98]" />
            <canvas
                ref={gridRef}
                className="absolute inset-0 block h-full w-full opacity-90 [mask-image:linear-gradient(rgba(0,0,0,0.99)_0%,rgba(0,0,0,0.91)_9%,transparent_100%)]"
            />
            <canvas ref={whaleRef} className="absolute inset-0 block h-full w-full" />
        </div>
    );
}
