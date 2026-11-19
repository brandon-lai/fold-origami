---
version: alpha
name: Fold
description: A calm studio. Warm-neutral space, near-black type, and one sheet of paper as the only colour on screen.
colors:
  background: "#F5F5F7"
  surface: "#FFFFFF"
  ink: "#1D1D1F"
  secondary-ink: "#6E6E73"
  primary: "#0071E3"
  background-dark: "#000000"
  surface-dark: "#1C1C1E"
  ink-dark: "#F5F5F7"
  secondary-ink-dark: "#A1A1A6"
  primary-dark: "#0A84FF"
  paper-red: "#C8352E"
  paper-white: "#F4F1EA"
  paper-indigo: "#2F3F7A"
  paper-mustard: "#D9A62E"
  paper-sage: "#8FA588"
  paper-back: "#F7F5F0"
typography:
  hero:
    fontFamily: "-apple-system, SF Pro Display, Inter"
    fontSize: 80px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.035em
  section:
    fontFamily: "-apple-system, SF Pro Display, Inter"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.025em
  step:
    fontFamily: "-apple-system, SF Pro Display, Inter"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  body:
    fontFamily: "-apple-system, SF Pro Text, Inter"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, SF Pro Text, Inter"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  panel: 18px
  control: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
components:
  control-bar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: 8px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: 44px
---

# Fold design

## Direction

**Mode.** The landing page *persuades* (one idea per screen, the action on the
first screen). The library and intro pages *operate* quietly. The lesson is an
*experience*: the paper leads and the interface recedes.

**Scene.** A curious beginner at a kitchen table or a teacher at a projector,
real paper in one hand, phone or laptop in front of them, ordinary indoor
light. Light theme by default, dark theme from the system setting (the PRD's
"gallery spotlight").

**World.** The PRD pins the look outright: an Apple product page. Quiet,
precise, generous white space, the object as the hero. Everything here renders
that reference: the system font stack (SF Pro on Apple devices, Inter as the
fallback), the exact PRD greys, one blue for active controls only, 18 px panel
radius, very soft two-layer shadows, frosted glass for the floating control bar.
The paper is the only colour on screen, and the accent never touches it.

**Signature.** The paper folding itself. On the landing page it folds into a
crane as you scroll and opens back out; in a lesson the crease draws itself on
the sheet, the moving flap glows faintly, and the fold plays once and then loops
slowly. Everything else is restraint around that.

## Colour

Restrained posture: tinted near-white space, near-black ink, one accent under
5% of any screen. The accent marks the active control (Next, a pressed tool,
the scrubber), never decoration and never the paper.

PRD deviations from the craft floor, on purpose: the PRD pins `#FFFFFF` for
raised surfaces and `#000000` for the dark background, so those pure values
stand. Neutrals are the PRD's own Apple greys rather than OKLCH-tinted ones.

## Type

System stack first so Apple devices get SF Pro, then Inter. Two weights (400
and 600). Display sizes track tight (−0.025 to −0.035 em); the hero clamps down
from 80 px on small screens. Labels are sentence case, never tracked caps.

## Motion

- Folds: 1.2–1.8 s each, ease-in-out, the flap's far edge trailing the hinge
  slightly so it reads as paper rather than a plank. Fold-and-unfold pre-creases
  take 2.4 s.
- UI: 140 ms presses, 240–320 ms panels, ease-out; the PRD's "springs" are a
  gentle overshoot curve on panels only.
- Crease guide draws itself for 0.75 s before each fold.
- Reduced motion: steps cut to their end state with a short crossfade, no
  camera sweeps, no looping, no turntable.

## The paper

Physically based material: fibre bump map, soft roughness, a faint sheen, a
translucency term so thin flaps glow when lit from behind, colour on the front
and off-white on the back like real kami. Creases that have been made stay as
faint ridges (bump plus a little ambient occlusion) even after unfolding. Layers
are offset by 0.0016 sheet-widths (about 0.25 mm on a 15 cm sheet) so stacks
read clearly and never flicker.

## Known linter notes

- sloplint gate 20 (Hallmark stamp) does not apply outside hallmark's own flow.
- Gate 62 on Base UI's `data-starting-style` / `data-ending-style` selectors is a
  false positive: those attributes exist only while animating.
- Pure white and pure black surfaces are PRD-pinned (see Colour).
