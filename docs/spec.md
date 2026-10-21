# Rotating Cube — Project Specification

Version: 1.1  
Status: Approved  
Last updated: 2026-10-21

Revision history:

- 1.0 (2026-10-19) — initial specification.
- 1.1 (2026-10-21) — add deployment to GitHub Pages (NFR-9, AC-16, A-7).

---

## 1. Project Goal

Build a minimal browser-based application that displays an interactive 3D cube.
The project exists to practise harness engineering: all application source code is
written by Claude Code; the human engineer reviews and approves plans and changes
but does not write or edit application source files directly.

---

## 2. Functional Requirements

| ID   | Requirement |
|------|-------------|
| FR-1 | The application renders a 3D cube mesh in a full-viewport WebGL canvas. |
| FR-2 | The user rotates the cube by dragging on the canvas. Horizontal drag changes the cube mesh's Y rotation; vertical drag changes its X rotation. Rotation is applied to the cube mesh, not the camera. OrbitControls must not be used. |
| FR-3 | Input is handled via the Pointer Events API, unifying mouse and touch. The canvas element has `touch-action: none` applied so the browser does not intercept pointer events for scrolling or zooming. |
| FR-4 | Pointer capture is set on `pointerdown` so a drag that starts on the canvas continues to rotate the cube even if the pointer moves outside the canvas boundary or over other page elements. |
| FR-5 | A visible Reset button restores the cube to its defined initial orientation immediately, with no animation. |
| FR-6 | The rendering canvas resizes to fill the browser viewport when the window is resized. |

---

## 3. Acceptance Criteria

### Testability contract

All automated E2E tests observe cube state through two DOM interfaces:

- **Scene wrapper:** `div[data-testid="cube-scene"]` — wraps the `<canvas>`.
- **Rotation attributes:** `data-cube-rx`, `data-cube-ry`, `data-cube-rz` on the
  scene wrapper, updated every render frame. Values are Euler angles in degrees
  (XYZ order), rounded to one decimal place (e.g. `"25.0"`).
- **Reset button:** `button[data-testid="reset-button"]`.

These attributes form a stable, implementation-neutral observation surface.
Tests must not read Three.js internals or compare pixel screenshots.
E2E assertions on these attributes use Playwright auto-retrying assertions
(e.g. `expect(locator).toHaveAttribute(...)`) rather than assuming synchronous
DOM updates.

E2E pointer interactions use Playwright's mouse API. Tests that cover touch input
dispatch pointer events with `pointerType: "touch"` (simulated); behaviour on a
real physical touch device is verified by manual check only.

### Initial orientation

The cube's defined initial state is:  
`data-cube-rx="25.0"`, `data-cube-ry="-45.0"`, `data-cube-rz="0.0"`

### Rotation constraints

- X rotation is clamped to the closed range **[-90°, 90°]**.
- Y rotation is normalised to the half-open range **(-180°, 180°]**.
- Z rotation is always `0.0`; user interaction does not affect it.

### Criteria

| ID    | Criterion | Verification |
|-------|-----------|--------------|
| AC-1  | On load, `div[data-testid="cube-scene"]` is present in the DOM. | E2E |
| AC-2  | On load, the `<canvas>` inside the scene wrapper has a non-zero `clientWidth` and `clientHeight`. | E2E |
| AC-3  | On load, `data-cube-rx`, `data-cube-ry`, `data-cube-rz` equal the initial orientation values. | E2E |
| AC-4  | After a simulated horizontal pointer drag of ≥ 50 px (`pointerType: "mouse"`) on the canvas, `data-cube-ry` differs from its initial value. | E2E |
| AC-5  | After a simulated vertical pointer drag of ≥ 50 px (`pointerType: "mouse"`) on the canvas, `data-cube-rx` differs from its initial value. | E2E |
| AC-6  | After a simulated horizontal pointer drag of ≥ 50 px (`pointerType: "touch"`) on the canvas, `data-cube-ry` differs from its initial value. | E2E |
| AC-7  | After a simulated vertical pointer drag of ≥ 50 px (`pointerType: "touch"`) on the canvas, `data-cube-rx` differs from its initial value. | E2E |
| AC-8  | `button[data-testid="reset-button"]` is visible and enabled on load. | E2E |
| AC-9  | After any drag that changes rotation, clicking the Reset button restores all three `data-cube-r*` attributes to initial values. | E2E |
| AC-10 | At viewport 1280 × 720, `canvas.clientWidth` is within 2 px of `window.innerWidth`. | E2E |
| AC-11 | After resizing the viewport from 1280 × 720 to 375 × 667, `canvas.clientWidth` updates to within 2 px of the new `window.innerWidth`. | E2E |
| AC-12 | A simulated vertical pointer drag of 1000 px on the canvas never produces a `data-cube-rx` value outside the range [-90.0, 90.0]. | E2E |
| AC-13 | The application renders without JavaScript console errors on load. | E2E |
| AC-14 | A drag that starts on the canvas and passes over the Reset button (without releasing) changes `data-cube-ry` from its initial value and does not restore the cube to its initial orientation. | E2E |
| AC-15 | The interactive `<canvas>` element has a computed CSS `touch-action` value of `none`, verified via `getComputedStyle(canvas).touchAction`. | E2E |
| AC-16 | Against the public GitHub Pages URL, in both Chromium and Firefox, the AC-1 and AC-13 tests and the WebGL2 context test (`FR-1`) pass, so the deployed cube scene renders without console errors. | E2E (post-deploy) |

---

## 4. Non-Functional Requirements

| ID    | Requirement |
|-------|-------------|
| NFR-1 | TypeScript strict mode is enabled (`"strict": true` in `tsconfig.json`). |
| NFR-2 | `tsc --noEmit` reports zero errors. |
| NFR-3 | ESLint reports zero errors and zero warnings. |
| NFR-4 | All Vitest unit tests pass. |
| NFR-5 | All Playwright E2E tests pass on both Chromium and Firefox. |
| NFR-6 | `vite build` completes without errors. |
| NFR-7 | The application runs without errors in the latest stable versions of Chrome and Firefox. |
| NFR-8 | The ESLint configuration must include a `no-restricted-imports` rule that blocks all imports of `OrbitControls` from both `three/examples/jsm/` and `three/addons/`, with or without the `.js` extension. The required patterns are: `three/examples/jsm/controls/OrbitControls`, `three/examples/jsm/controls/OrbitControls.js`, `three/addons/controls/OrbitControls`, and `three/addons/controls/OrbitControls.js`. This rule is configured as part of the initial project setup and enforced as a lint error. |
| NFR-9 | The application is published to GitHub Pages from the `main` branch by a GitHub Actions workflow. A deployment happens only after `npm run check` passes on the commit being deployed. The published site is the unmodified `vite build` output and works from a sub-path URL. |

---

## 5. Technology Stack (fixed)

| Role | Technology |
|------|------------|
| Build tool | Vite |
| UI framework | React |
| Language | TypeScript (strict mode) |
| 3D rendering | Three.js (cube mesh rotation; no OrbitControls) |
| Unit tests | Vitest |
| E2E tests | Playwright (Chromium + Firefox projects) |
| Hosting | GitHub Pages, deployed by GitHub Actions |

No substitutions are permitted without an explicit spec update.

---

## 6. Out of Scope

- Backend, API, or server-side logic.
- Authentication or user accounts.
- Persistent state (localStorage, cookies, database).
- Keyboard-based rotation controls.
- Zoom, pan, or scale gestures.
- Cube face textures, labels, or customisation UI.
- Automatic / continuous rotation animation.
- Animated reset transition.
- Mobile-specific UI chrome (e.g. dedicated toolbar).
- Accessibility (ARIA, keyboard nav) beyond what React provides by default.
- Support for browsers other than latest stable Chrome and Firefox.
- Frame-rate or rendering-performance thresholds.
- Custom domain, preview (per-branch or per-PR) deployments, or CDN/cache tuning.

---

## 7. Verification Strategy

### 7.1 Automated unit tests (Vitest)

Target: pure logic testable in isolation, without a DOM or browser.

| What is tested | Relevant AC |
|----------------|-------------|
| Euler angle calculation from pointer delta (px → degrees) | AC-4, AC-5, AC-6, AC-7 |
| Proportionality of rotation delta (100 px → 2× the angle of 50 px, ±5 %) | AC-4, AC-5 |
| X rotation clamp to [-90°, 90°] | AC-12 |
| Y rotation normalisation to (-180°, 180°] | AC-4 |
| Reset function returns exact initial orientation values | AC-9 |

### 7.2 Automated E2E tests (Playwright)

Target: full browser behaviour via the testability contract defined in §3.

Covers: AC-1 through AC-15 against the local Vite dev server. AC-16 reuses the
AC-1, AC-13 and WebGL2 context tests against the public URL after deployment (see
§7.6).

Configuration requirements:
- `webServer` option configured in `playwright.config.ts` so Playwright starts the
  Vite dev server automatically before the test run.
- Two browser projects: **Chromium** and **Firefox**.

Tests interact only with `data-testid` selectors and `data-cube-r*` attributes.
All assertions on `data-cube-r*` use auto-retrying Playwright assertions.
No pixel comparison (`toHaveScreenshot`) is used.

### 7.3 Manual browser checks

Target: subjective or perceptual qualities impractical to automate.

| What is checked | Relevant requirement |
|-----------------|----------------------|
| Cube appearance looks correct (no z-fighting, correct perspective) | FR-1 |
| Rotation feels smooth and responsive during drag | FR-2 |
| Canvas visually fills the viewport with no gaps or scrollbars | FR-6 |
| Application works on a real physical touch device | FR-3 |
| Application runs without errors in Firefox desktop | NFR-7 |

Manual checks that depend on a browser or device are run on the public GitHub Pages
URL once it exists.

### 7.4 Quality gate commands

The following `package.json` scripts must be defined:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint":      "eslint . --max-warnings 0",
  "test":      "vitest run",
  "build":     "vite build",
  "e2e":       "playwright test",
  "check":     "npm run typecheck && npm run lint && npm run test && npm run build && npm run e2e"
}
```

`npm run check` is the single command that runs all required quality checks in
order. Every check must exit with code 0 for the gate to pass.

The script `"e2e:deployed"` (Playwright against the public URL, see §7.6) must also
be defined. It is deliberately not part of `npm run check`, because it needs a
deployed site.

### 7.5 Enforcement boundary

| Control | Enforced by |
|---------|-------------|
| Zero TypeScript errors | `tsc --noEmit` (automated) |
| Zero ESLint errors and warnings | `eslint --max-warnings 0` (automated) |
| OrbitControls not used | ESLint `no-restricted-imports` rule — NFR-8 (automated, once configured) |
| `touch-action: none` on canvas | Playwright E2E — AC-15 (automated) |
| Rotation logic, clamping, normalisation, proportionality | Vitest unit tests (automated) |
| DOM contract, pointer interaction, reset, resize | Playwright E2E (automated) |
| Production build succeeds | `vite build` (automated) |
| Cube mesh rotates (not camera) | Agent instruction + code review |
| Visual quality, animation smoothness | Manual browser check |
| Real-device touch behaviour | Manual browser check |
| Deployment only after a green `npm run check` | Deploy workflow job dependency (automated) |
| Deployed cube scene renders | Playwright post-deploy run — AC-16 (automated) |

### 7.6 Deployment verification

After each deployment, a separate Playwright configuration runs against the public
URL (supplied through an environment variable, no `webServer`) in the Chromium and
Firefox projects, under a virtual display in CI as for `npm run check`. It reuses
the existing tests `AC-1: cube-scene wrapper is present on load`,
`AC-13: no console errors or page errors on load` and
`FR-1: browser can create a WebGL2 context` unchanged; assertions are not
weakened or duplicated. A bounded wait for the site to become reachable absorbs
Pages propagation delay; if the limit is reached the run fails. Test retries are not
used to hide failures.

---

## 8. Assumptions

| ID  | Assumption |
|-----|------------|
| A-1 | The application is single-page with no routing. |
| A-2 | Only one cube is displayed at a time. |
| A-3 | The canvas always fills 100 % of the viewport (no margins or sidebars). |
| A-4 | Drags that begin outside the canvas are ignored; once a drag starts on the canvas, pointer capture ensures it continues regardless of where the pointer moves. |
| A-5 | `data-cube-r*` attributes are updated at least once per animation frame after each pointer event, so Playwright auto-retrying assertions will observe the updated values within their default timeout. |
| A-6 | The rotation sensitivity (degrees per pixel) is a single configurable constant; the exact value is decided during implementation and captured in unit tests. |
| A-7 | GitHub Pages is enabled for the repository with Source set to "GitHub Actions" (a manual step done by the human), and the repository visibility permits Pages. |

---

## 9. Resolved Decisions

The following ambiguities from earlier drafts are now resolved:

| ID   | Decision |
|------|----------|
| OA-1 | X rotation clamped to [-90°, 90°]; Y rotation normalised to (-180°, 180°]. |
| OA-2 | Pointer capture (`setPointerCapture`) keeps the drag active when the pointer leaves the canvas. |
| OA-3 | No frame-rate threshold is imposed. |
| OA-4 | Reset is immediate; no animation. |
