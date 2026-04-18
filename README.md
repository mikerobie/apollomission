<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Apollo Mission — Retro Space Survival

A retro-styled Apollo 11 survival game with a Three.js 3D spacecraft, authentic DSKY interface, and segmented instrument panel gauges.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the dev server:
   `npm run dev`
3. Open `http://localhost:3000` in your browser

## How to Play

Use the **DSKY keypad** (right panel) to enter mission commands:
- Press **V** → enter verb digits → press **N** → enter noun digits → press **ENT**
- Your first command: **V37 N01** → launches the mission
- Each phase completion shows the next required code in the Mission Log
- Press **PRO** to pause/resume operations

## DSKY Command Reference

| Phase | Code | Action |
|---|---|---|
| Pre-Launch | V37 N01 | Initiate launch sequence |
| Launch | V37 N02 | Translunar injection burn |
| Transit to Moon | V63 N01 | Lunar orbit insertion |
| Lunar Orbit | V63 N02 | Powered descent initiation |
| Landing | V16 N45 | Confirm surface contact |
| Lunar Surface | V37 N05 | Begin ascent |
| Ascent | V37 N06 | Transearth injection |
| Transit to Earth | V37 N07 | Re-entry sequence |
