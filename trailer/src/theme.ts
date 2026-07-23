import { loadFont } from "@remotion/google-fonts/PressStart2P";

const { fontFamily } = loadFont("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const FONT = fontFamily;

export const COLORS = {
  bg0: "#050608",
  bg1: "#12151c",
  bg2: "#2a1408",
  steel: "#3a3f4a",
  steelLite: "#6a7180",
  metal: "#c8ced8",
  plate: "#9aa3b2",
  oil: "#ff9a3c",
  oilHot: "#ff8c00",
  oilDeep: "#c45c00",
  neon: "#ff2244",
  good: "#3dff8a",
  warn: "#ffe14a",
  ink: "#0a0c10",
  cream: "#fff4e0",
} as const;

export const FPS = 60;
export const WIDTH = 2560;
export const HEIGHT = 1440;
export const DURATION = 18 * FPS; // 1080

export const SHOT = {
  hook: { from: 0, frames: 180 }, // 0–3s
  loop: { from: 180, frames: 240 }, // 3–7s
  upgrade: { from: 420, frames: 240 }, // 7–11s
  podium: { from: 660, frames: 210 }, // 11–14.5s
  cta: { from: 870, frames: 210 }, // 14.5–18s
} as const;
