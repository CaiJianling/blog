import { MotionValue } from "framer-motion";
import { useTransform } from "framer-motion";

export function useValueOrMotion<T>(value: T | MotionValue<T>): MotionValue<T> {
  return useTransform(() => getValueOrMotion(value));
}

export function getValueOrMotion<T>(value: T | MotionValue<T>): T {
  return value instanceof MotionValue ? value.get() : value;
}