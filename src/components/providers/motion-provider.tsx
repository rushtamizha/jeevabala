"use client";

import { MotionConfig } from "framer-motion";

/** Framer Motion is only loaded on the signed-in areas (account, admin); respect the OS reduced-motion setting there. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
