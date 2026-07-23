import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { OnScreenText } from "./components/OnScreenText";
import { COLORS, DURATION, FONT, FPS, HEIGHT, SHOT, WIDTH } from "./theme";

/** Real game footage (1280×800) scaled to fill 2K 16:9 with slight crop. */
const GameFootage: React.FC<{
  src: string;
  shake?: boolean;
  slamAt?: number;
}> = ({ src, shake = false, slamAt = 44 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let shakeY = 0;
  if (shake && frame >= slamAt) {
    const settle = spring({
      frame: frame - slamAt,
      fps,
      config: { damping: 12, stiffness: 240, mass: 0.4 },
    });
    shakeY = Math.sin((frame - slamAt) * 1.85) * 15 * (1 - settle);
  }

  // Cover 2560×1440 from 1280×800 (16:10 → 16:9)
  const scale = Math.max(WIDTH / 1280, HEIGHT / 800);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg0,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 1280,
          height: 800,
          scale,
          translate: `0px ${shakeY}px`,
          imageRendering: "pixelated",
        }}
      >
        <Video
          src={staticFile(src)}
          style={{
            width: 1280,
            height: 800,
            objectFit: "fill",
            imageRendering: "pixelated",
          }}
          muted
        />
      </div>
    </AbsoluteFill>
  );
};

const Shot1Hook: React.FC = () => {
  return (
    <AbsoluteFill>
      <GameFootage src="footage/shot1_press.mp4" shake slamAt={44} />
      <Sequence from={95} layout="none">
        <OnScreenText lines={["PACK TIGHT.", "PRESS HARD."]} fontSize={72} />
      </Sequence>
      <Sequence from={44} layout="none">
        <Audio src={staticFile("sfx/press.ogg")} volume={0.95} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Shot2Loop: React.FC = () => {
  return (
    <AbsoluteFill>
      <GameFootage src="footage/shot2_loop.mp4" />
      <Sequence from={36} layout="none">
        <OnScreenText
          lines={["HIGH STAKES.", "3 OVERLOADS & YOU’RE OUT."]}
          fontSize={52}
          accent={COLORS.warn}
          anchor="top"
        />
      </Sequence>
      <Sequence from={40} layout="none">
        <Audio src={staticFile("sfx/place_soft.ogg")} volume={0.7} />
      </Sequence>
      <Sequence from={70} layout="none">
        <Audio src={staticFile("sfx/alloy.ogg")} volume={0.55} />
      </Sequence>
      <Sequence from={100} layout="none">
        <Audio src={staticFile("sfx/place_soft.ogg")} volume={0.65} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Shot3Upgrade: React.FC = () => {
  return (
    <AbsoluteFill>
      <GameFootage src="footage/shot3_upgrade.mp4" />
      <Sequence from={24} layout="none">
        <OnScreenText
          lines={["DRAFT UPGRADES.", "EXPAND YOUR CHAMBER."]}
          fontSize={52}
          anchor="top"
        />
      </Sequence>
      <Sequence from={0} layout="none">
        <Audio src={staticFile("sfx/ui.ogg")} volume={0.5} />
      </Sequence>
      <Sequence from={110} layout="none">
        <Audio src={staticFile("sfx/buy.ogg")} volume={0.8} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Shot4Podium: React.FC = () => {
  const frame = useCurrentFrame();
  const cash = Math.round(
    interpolate(frame, [8, 70], [0, 12450], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    }),
  );

  return (
    <AbsoluteFill>
      <GameFootage src="footage/shot4_podium.mp4" />
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 90,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 64,
            color: COLORS.good,
            textShadow: "0 0 18px #3dff8a, 3px 3px 0 #000",
            background: "rgba(6,8,12,0.72)",
            border: `3px solid ${COLORS.good}`,
            padding: "16px 28px",
            opacity: interpolate(frame, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          ${cash.toLocaleString("en-US")}
        </div>
      </AbsoluteFill>
      <Sequence from={40} layout="none">
        <OnScreenText
          lines={["CLAIM THE TOP-10 PODIUM"]}
          fontSize={56}
          anchor="top"
        />
      </Sequence>
      <Sequence from={12} layout="none">
        <Audio src={staticFile("sfx/start.ogg")} volume={0.65} />
      </Sequence>
      <Sequence from={80} layout="none">
        <Audio src={staticFile("sfx/ui.ogg")} volume={0.55} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Shot5Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.55 },
  });
  const cta = interpolate(frame, [55, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      <GameFootage src="footage/shot5_cta.mp4" />
      {/* Soft golden veil so brand/CTA read over title chrome */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, #ff8c0033 0%, transparent 55%), linear-gradient(180deg, rgba(5,6,8,0.15), rgba(5,6,8,0.55))",
          opacity: interpolate(logo, [0, 1], [0.4, 1]),
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 36,
          opacity: logo,
          scale: interpolate(logo, [0, 1], [0.88, 1]),
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 88,
            lineHeight: 1.35,
            textAlign: "center",
            color: COLORS.oil,
            textShadow:
              "0 0 18px #ff8c00, 0 0 40px #ff8c0088, 4px 4px 0 #000",
          }}
        >
          SCRAP &
          <br />
          PRESSURE
        </div>
        <div
          style={{
            opacity: cta,
            translate: `0px ${interpolate(cta, [0, 1], [24, 0])}px`,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 48,
              color: COLORS.cream,
              textShadow: "0 0 12px #ff8c00, 3px 3px 0 #000",
              background: "rgba(6,8,12,0.75)",
              border: `4px solid ${COLORS.oilHot}`,
              padding: "20px 36px",
            }}
          >
            BEAT THE RECORD!
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 26,
              color: COLORS.ink,
              background: COLORS.oilHot,
              border: `4px solid ${COLORS.warn}`,
              padding: "22px 36px",
              boxShadow: "0 0 28px #ff8c0088",
            }}
          >
            PLAY FREE IN BROWSER ON ITCH.IO
          </div>
        </div>
      </AbsoluteFill>
      <Sequence from={8} layout="none">
        <Audio src={staticFile("sfx/start.ogg")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const ScrapPressureTrailer: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg0 }}>
      <Audio
        src={staticFile("sfx/track_part02_groove.ogg")}
        volume={(f) =>
          interpolate(f, [0, 30, DURATION - 45, DURATION], [0, 0.55, 0.55, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      <Sequence name="Shot1 Hook" from={SHOT.hook.from} durationInFrames={SHOT.hook.frames}>
        <Shot1Hook />
      </Sequence>
      <Sequence name="Shot2 Loop" from={SHOT.loop.from} durationInFrames={SHOT.loop.frames}>
        <Shot2Loop />
      </Sequence>
      <Sequence
        name="Shot3 Upgrade"
        from={SHOT.upgrade.from}
        durationInFrames={SHOT.upgrade.frames}
      >
        <Shot3Upgrade />
      </Sequence>
      <Sequence
        name="Shot4 Podium"
        from={SHOT.podium.from}
        durationInFrames={SHOT.podium.frames}
      >
        <Shot4Podium />
      </Sequence>
      <Sequence name="Shot5 CTA" from={SHOT.cta.from} durationInFrames={SHOT.cta.frames}>
        <Shot5Cta />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scrapPressureTrailerMeta = {
  id: "ScrapPressureTrailer",
  component: ScrapPressureTrailer,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;
