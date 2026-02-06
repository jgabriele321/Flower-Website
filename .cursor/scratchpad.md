## Background and Motivation
- Build a static bouquet arranger with Konva.js and manifest-driven asset loading to keep first load lightweight (<10s) and mobile/desktop friendly.

## Key Challenges and Analysis
- Load only the currently selected bouquet assets; avoid bundling hundreds of images.
- Provide draggable/tap-to-front interactivity while keeping layering and vase overlay correct.
- Prep script must downscale/convert PNGs and generate manifest from palette/bucket structure.

## High-level Task Breakdown
- Scaffold Vite vanilla project with minimal HTML entry and config.
- Add folder structure, placeholders, and manifest example in `public`.
- Implement bouquet generation + Konva stage loading from manifest.
- Implement asset prep Python script (PNG -> WebP, resize, manifest generation).
- Add styling and README; add GitHub Pages workflow.

## Project Status Board
- [x] Scaffold Vite project and base files
- [x] Create asset prep script and manifest generator
- [x] Add public folder structure with placeholders
- [x] Implement bouquet generation + interactivity
- [x] Add styling and responsive layout
- [x] Add deployment workflow and README

## Current Status / Progress Tracking
- All planned tasks completed (scaffold, prep script, public placeholders, bouquet logic, styling, deploy workflow, README).
- Venv created at `.venv` for Pillow; placeholder vase/background generated.

## Executor's Feedback or Assistance Requests
- None; everything runs locally after `npm install && npm run dev`.

## Lessons
- Include debugging info in program output.
- Read files before editing.
- Run `npm audit` if vulnerabilities appear.
- Ask before using force on git commands.
- Pillow not preinstalled system-wide; use project-local `.venv` for scripts requiring it.
