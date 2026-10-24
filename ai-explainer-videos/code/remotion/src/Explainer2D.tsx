import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { buildStage } from "./scenes2d";

// A Remotion composition is just a React component drawn once per frame.
// useCurrentFrame() gives the current frame; we turn it into seconds and ask the
// shared buildStage(t) for the exact SVG. <Audio> plays the voice-over, so the
// picture and the narration are locked to the same clock.
export const Explainer2D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8f4ff" }}>
      <AbsoluteFill dangerouslySetInnerHTML={{ __html: buildStage(t) }} />
      <Audio src={staticFile("voiceover.mp3")} />
    </AbsoluteFill>
  );
};
