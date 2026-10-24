# AI Explainer Videos - example code

Original code for Parts 2 and 3 of the guide. All of it was rendered to real MP4s.

## Remotion project (`remotion/`)
```
cd remotion
npm install
npm run preview                         # open Remotion Studio
npx remotion render src/index.ts Explainer2D out/airplane-2d.mp4
npx remotion render src/index.ts Explainer3D out/airplane-3d.mp4 --gl=angle
```
`public/voiceover.mp3` is a LOCAL stand-in voice-over (made with Windows text-to-speech)
so the project runs offline. In the real workflow this audio comes from Google AI Studio;
replace the file and the examples work unchanged.

## Standalone pages (no build step)
- `web2d/explainer.html` - the 2D motion-graphics explainer (open in a browser; `?t=SECONDS` freezes a frame).
- `three3d/scene.html` - the Three.js 3D scene (loads three.js from a CDN).

Verified with Node 24, Remotion 4.0.420, three 0.182.0, ffmpeg 8.1.1.
