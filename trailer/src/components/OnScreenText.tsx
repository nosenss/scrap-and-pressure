import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT } from "../theme";

type Props = {
  lines: string[];
  enterFrames?: number;
  fontSize?: number;
  accent?: string;
  anchor?: "center" | "top";
};

export const OnScreenText: React.FC<Props> = ({
  lines,
  enterFrames = 18,
  fontSize = 64,
  accent = COLORS.oilHot,
  anchor = "center",
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const y = interpolate(frame, [0, enterFrames], [36, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: anchor === "top" ? "flex-start" : "center",
        alignItems: "center",
        paddingTop: anchor === "top" ? 120 : 0,
        pointerEvents: "none",
        opacity: enter,
        translate: `0px ${y}px`,
      }}
    >
      <div
        style={{
          maxWidth: 2100,
          padding: "28px 48px",
          background: "rgba(6, 8, 12, 0.78)",
          border: `4px solid ${accent}`,
          boxShadow: `0 0 28px ${accent}66, inset 0 0 24px #00000088`,
          textAlign: "center",
        }}
      >
        {lines.map((line) => (
          <div
            key={line}
            style={{
              fontFamily: FONT,
              fontSize,
              lineHeight: 1.45,
              color: COLORS.cream,
              textShadow: `0 0 12px ${accent}, 0 0 4px ${accent}aa, 3px 3px 0 #000`,
              letterSpacing: 2,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
