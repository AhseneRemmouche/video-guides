import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig, staticFile, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";

// A 3D airplane built from primitive meshes (no model files), animated by the
// frame clock. @remotion/three's ThreeCanvas is a react-three-fiber canvas that
// renders deterministically for each frame, so it records cleanly to MP4.

const Plane: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  // Gentle flight: drift across, bob up and down, bank into the turn.
  const x = interpolate(frame, [0, durationInFrames], [-3, 3]);
  const y = Math.sin(t * 1.2) * 0.4;
  const bank = Math.sin(t * 1.2) * 0.25;
  const yaw = Math.sin(t * 0.6) * 0.15;
  return (
    <group position={[x, y, 0]} rotation={[0, yaw, bank]}>
      {/* fuselage */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 2.4, 24]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* nose cone */}
      <mesh position={[1.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, 0.5, 24]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      {/* main wings */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.06, 3.4]} />
        <meshStandardMaterial color="#60a5fa" />
      </mesh>
      {/* tail wing */}
      <mesh position={[-1.0, 0, 0]}>
        <boxGeometry args={[0.4, 0.05, 1.4]} />
        <meshStandardMaterial color="#93c5fd" />
      </mesh>
      {/* tail fin */}
      <mesh position={[-1.0, 0.35, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.05]} />
        <meshStandardMaterial color="#93c5fd" />
      </mesh>
    </group>
  );
};

const Cloud: React.FC<{ pos: [number, number, number]; speed: number }> = ({ pos, speed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = ((pos[0] - (frame / fps) * speed + 12) % 12) - 6;
  return (
    <group position={[drift, pos[1], pos[2]]}>
      {[[0, 0, 0], [0.7, 0.1, 0], [-0.7, 0.05, 0], [0.3, 0.35, 0]].map((o, k) => (
        <mesh key={k} position={o as [number, number, number]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
};

export const ThreeExplainer: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#8ec5ff" }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 1, 7], fov: 55 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[5, 6, 5]} intensity={1.6} />
        <color attach="background" args={["#8ec5ff"]} />
        <Cloud pos={[-4, -1.6, -3]} speed={0.6} />
        <Cloud pos={[3, 1.8, -5]} speed={0.4} />
        <Cloud pos={[0, -2.2, -2]} speed={0.8} />
        <Plane />
      </ThreeCanvas>
      <Audio src={staticFile("voiceover.mp3")} />
    </AbsoluteFill>
  );
};
