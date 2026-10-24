import React from "react";
import { Composition } from "remotion";
import { Explainer2D } from "./Explainer2D";
import { ThreeExplainer } from "./ThreeExplainer";
import { TIMELINE } from "./scenes2d";

// durationInFrames must cover the whole voice-over (37.295s at 30fps = 1119 frames).
const DURATION = Math.ceil(TIMELINE.durationSec * TIMELINE.fps);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Explainer2D"
        component={Explainer2D}
        durationInFrames={DURATION}
        fps={TIMELINE.fps}
        width={1280}
        height={720}
      />
      <Composition
        id="Explainer3D"
        component={ThreeExplainer}
        durationInFrames={DURATION}
        fps={TIMELINE.fps}
        width={1280}
        height={720}
      />
    </>
  );
};
