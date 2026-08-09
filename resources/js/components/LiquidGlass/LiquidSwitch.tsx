import {
  mix,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion";
import React, { useEffect, useRef, useId } from "react";
import { Filter } from "./Filter";
import { useAppearance } from "@/hooks/use-appearance";

type Size = "sm" | "md" | "lg" | number;

interface LiquidSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: Size;
  disabled?: boolean;
}

const SIZE_SCALES: Record<"sm" | "md" | "lg", number> = {
  sm: 0.45,
  md: 0.6,
  lg: 1,
};

const SLIDER_HEIGHT = 67;
const SLIDER_WIDTH = 160;
const THUMB_WIDTH = 146;
const THUMB_HEIGHT = 92;
const THUMB_RADIUS = THUMB_HEIGHT / 2;

export const LiquidSwitch: React.FC<LiquidSwitchProps> = ({
  checked: checkedProp,
  defaultChecked = false,
  onChange,
  size = "md",
  disabled = false,
}) => {
  const isControlled = checkedProp !== undefined;
  const filterId = useId();
  const scale = typeof size === "number" ? size : SIZE_SCALES[size];
  const { resolvedAppearance } = useAppearance();

  const colorScheme = useMotionValue(resolvedAppearance as "light" | "dark");

  useEffect(() => {
    colorScheme.set(resolvedAppearance as "light" | "dark");
  }, [resolvedAppearance, colorScheme]);

  const sliderRef = useRef<HTMLDivElement>(null);

  const THUMB_REST_SCALE = 0.65;
  const THUMB_ACTIVE_SCALE = 1;
  const THUMB_REST_OFFSET = ((1 - THUMB_REST_SCALE) * THUMB_WIDTH) / 2;
  const TRAVEL = SLIDER_WIDTH - SLIDER_HEIGHT - (THUMB_WIDTH - THUMB_HEIGHT) * THUMB_REST_SCALE;

  const initialValue = isControlled ? (checkedProp ? 1 : 0) : (defaultChecked ? 1 : 0);
  const checked = useMotionValue(initialValue);
  const pointerDown = useMotionValue(0);
  const forceActive = useMotionValue(false);
  const xDragRatio = useMotionValue(0);
  const initialPointerX = useMotionValue(0);
  const startDragRatio = useMotionValue(0);
  const previousPointerX = useMotionValue(0);
  const velocityX = useMotionValue(0);

  useEffect(() => {
    if (isControlled && pointerDown.get() < 0.5) {
      checked.set(checkedProp ? 1 : 0);
    }
  }, [checkedProp, isControlled, checked]);

  const targetX = useTransform(
    () => {
      const pd = pointerDown.get();
      const drag = xDragRatio.get();
      const chk = checked.get();
      return pd > 0.5 ? drag : chk;
    }
  ) as MotionValue<number>;

  const xRatio = useSpring(targetX, { damping: 40, stiffness: 500 });

  const isLiquid = useTransform(
    () => {
      const x = xRatio.get();
      const c = checked.get();
      const pd = pointerDown.get();
      if (forceActive.get() || pd > 0.5) return 1;
      return Math.abs(x - c) > 0.08 ? 1 : 0;
    }
  ) as MotionValue<number>;

  const liquidEffect = useSpring(isLiquid, {
    stiffness: 400,
    damping: 35,
  });

  const objectScale = useTransform(liquidEffect, [0, 1], [THUMB_REST_SCALE, THUMB_ACTIVE_SCALE]);
  const backgroundOpacity = useTransform(liquidEffect, [0, 1], [1, 0.05]);

  const smoothedVelocity = useSpring(velocityX, { stiffness: 300, damping: 40 });
  const objectScaleY = useTransform(() => {
    const base = objectScale.get();
    const vel = Math.abs(smoothedVelocity.get());
    const stretch = Math.min(vel / 2500, 0.3);
    return base * (1 - stretch);
  });
  const objectScaleX = useTransform(() => {
    const base = objectScale.get();
    const sy = objectScaleY.get();
    return base + (base - sy) * 1.6;
  });

  const blur = useMotionValue(0.2);
  const specularOpacity = useTransform<"light" | "dark", number>(colorScheme, (cs) => cs === "light" ? 0.3 : 0.5);
  const specularSaturation = useTransform<"light" | "dark", number>(colorScheme, (cs) => cs === "light" ? 3 : 6);
  const refractionBase = useMotionValue(1);
  const magnifyingScale = useTransform(liquidEffect, [0, 1], [8, -30]);
  const scaleRatio = useTransform(() => (0.4 + 0.5 * liquidEffect.get()) * refractionBase.get());

  const backgroundColor = useTransform(
    xRatio,
    (value) => value > 0.5 ? "#3BBF4EEE" : "#94949F77"
  );

  const boxShadow = useTransform(liquidEffect, (v) => {
    const alpha = mix(0.12, 0.25, v);
    const blurVal = mix(6, 28, v);
    const sy = mix(4, 18, v);
    const insetAlpha = mix(0, 0.4, v);
    const outer = `0px ${sy}px ${blurVal}px rgba(0,0,0,${alpha})`;
    const inset = v > 0.1
      ? `, inset 4px 10px 20px rgba(0,0,0,${insetAlpha}), inset -4px -10px 20px rgba(255,255,255,${insetAlpha})`
      : '';

    return outer + inset;
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();
    pointerDown.set(1);
    initialPointerX.set(e.clientX);
    previousPointerX.set(e.clientX);
    startDragRatio.set(xRatio.get());
    xDragRatio.set(xRatio.get());
  };

  const handleToggle = (newChecked: number) => {
    checked.set(newChecked);
  };

  useEffect(() => {
    const unsubscribe = checked.on("change", (newValue) => {
      onChange?.(newValue > 0.5);
    });

    return () => unsubscribe();
  }, [onChange]);

  useEffect(() => {
    const handleGlobalUpdate = (e: MouseEvent | TouchEvent) => {
      if (pointerDown.get() < 0.5) return;

      const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const displacementX = clientX - initialPointerX.get();
      const ratio = startDragRatio.get() + displacementX / TRAVEL;

      xDragRatio.set(Math.min(1.1, Math.max(-0.1, ratio)));

      const currentVel = clientX - previousPointerX.get();
      velocityX.set(currentVel * 12);
      previousPointerX.set(clientX);
    };

    const handleGlobalUp = (e: MouseEvent | TouchEvent) => {
      if (pointerDown.get() < 0.5) return;

      const clientX = e instanceof MouseEvent ? e.clientX : e.changedTouches[0].clientX;
      const distance = Math.abs(clientX - initialPointerX.get());

      pointerDown.set(0);
      velocityX.set(0);

      if (distance > 5) {
        handleToggle(xDragRatio.get() > 0.5 ? 1 : 0);
      }
    };

    window.addEventListener("mousemove", handleGlobalUpdate);
    window.addEventListener("touchmove", handleGlobalUpdate, { passive: false });
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalUpdate);
      window.removeEventListener("touchmove", handleGlobalUpdate);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [TRAVEL]);

  return (
    <div
      style={{
        width: SLIDER_WIDTH * scale,
        height: SLIDER_HEIGHT * scale,
        position: "relative",
      }}
      className={cn("touch-none", disabled && "opacity-50 cursor-not-allowed")}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center",
          width: SLIDER_WIDTH,
          height: SLIDER_HEIGHT,
          position: "absolute",
          top: "50%",
          left: "50%",
          marginLeft: -SLIDER_WIDTH / 2,
          marginTop: -SLIDER_HEIGHT / 2,
        }}
      >
        <motion.div
          ref={sliderRef}
          style={{
            width: SLIDER_WIDTH,
            height: SLIDER_HEIGHT,
            backgroundColor,
            borderRadius: SLIDER_HEIGHT / 2,
            position: "relative",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          onClick={(e) => {
            if (disabled) return;
            const distance = Math.abs(e.clientX - initialPointerX.get());
            if (distance < 5) {
              handleToggle(checked.get() < 0.5 ? 1 : 0);
            }
          }}
        >
          {typeof window !== "undefined" && (
            <Filter
              id={filterId}
              blur={blur}
              scaleRatio={scaleRatio}
              specularOpacity={specularOpacity}
              specularSaturation={specularSaturation}
              magnifyingScale={magnifyingScale}
              colorScheme={colorScheme}
              width={THUMB_WIDTH}
              height={THUMB_HEIGHT}
              radius={THUMB_RADIUS}
              bezelWidth={19}
              glassThickness={47}
              bezelType="lip"
              refractiveIndex={1.5}
            />
          )}

          <motion.div
            className="absolute"
            onPointerDown={handlePointerDown}
            style={{
              height: THUMB_HEIGHT,
              width: THUMB_WIDTH,
              left: (SLIDER_HEIGHT - THUMB_HEIGHT * THUMB_REST_SCALE) / 2 - THUMB_REST_OFFSET,
              x: useTransform(() => xRatio.get() * TRAVEL),
              y: "-50%",
              top: "50%",
              borderRadius: THUMB_RADIUS,
              backdropFilter: `url(#${filterId})`,
              scaleX: objectScaleX,
              scaleY: objectScaleY,
              backgroundColor: useTransform(backgroundOpacity, (op) => `rgba(255, 255, 255, ${op})`),
              boxShadow,
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
