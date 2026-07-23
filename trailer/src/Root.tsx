import React from "react";
import { Composition } from "remotion";
import { scrapPressureTrailerMeta } from "./ScrapPressureTrailer";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={scrapPressureTrailerMeta.id}
        component={scrapPressureTrailerMeta.component}
        durationInFrames={scrapPressureTrailerMeta.durationInFrames}
        fps={scrapPressureTrailerMeta.fps}
        width={scrapPressureTrailerMeta.width}
        height={scrapPressureTrailerMeta.height}
      />
    </>
  );
};
