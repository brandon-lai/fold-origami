# Fold

**Fold teaches origami with one realistic 3D sheet of paper that folds itself, one exact crease at a time.** Turn the model any way, scrub through each fold, and copy it with real paper in your hands.

Live: https://fold-origami-six.vercel.app

Design direction and tokens: [DESIGN.md](./DESIGN.md).

## What's here

- **A fold engine and bake pipeline** (`lib/fold`, `models`, `scripts/bake.ts`). Folds are computed offline and baked into keyframes; the browser only plays back geometry that was already checked.
- **The lesson player** (`components/fold/Lesson.tsx`): next/back, a step counter, one sentence per step, the fold's name with a tooltip, a frame-by-frame scrubber, orbit/pinch with double-tap to snap back to the guided camera, a crease guide that draws itself before each fold, a faint glow on the moving flap, a ghost of where it lands, 0.5×/1×/2× speed, flip view, a "check yourself" view (the paper as you hold it), a paper picker (5 colours, 2 washi patterns, white back like real kami), soft synthesised paper sounds (muted by default), progress memory in localStorage, keyboard (Space/→ next, ← back) and swipe, and a finish screen with a share image and the next model.
- **The paper renderer** (`components/fold/PaperScene.tsx`, `paper-material.ts`): physically based material with a fibre bump map, creases that stay as faint ridges after unfolding, colour front/white back, slight translucency, layer offsets about one sheet thick, studio lighting with a real shadow, quality tiers that drop pixel ratio and effects if frames run slow, and a flat-diagram fallback when WebGL is missing.
- **Landing, library, model intro, 404, OG image.** The landing page folds a crane as you scroll and opens it back out.

## The models

| # | Model | Steps | New technique | Status |
|---|---|---|---|---|
| 1 | Paper cup | 6 | Valley folds, tucking a flap | Baked and validated |
| 2 | Masu box | 9 | Blintz fold, opening flat paper into 3D | Baked and validated |
| 3 | Jumping frog | 12 | Pleats, folding through layers | Baked and validated |
| 4 | Square base | 6 | Collapsing along existing creases | Baked and validated |
| 5 | Flapping bird | 18 | Petal fold, the bird base | Baked and validated |
| 6 | Traditional crane | 21 | Narrowing, inside reverse folds | Baked and validated |
| 7 | Lily | — | Frog base, curling petals | **Not authored yet** (shown as a dashed card) |

The lily needs four squash folds and four petal folds on a frog base. Its petal folds sit on a different layer structure from the crane's, and it has not been authored or passed the gate yet. It is held back rather than shipped half-checked.

## How folding works

Each model is TypeScript in `models/`, written in a small vocabulary: valley/mountain folds on flaps (`e.flap`, `e.side`), fold-and-unfold, turn over, collapse, petal fold, inside reverse fold, shaping. `npm run bake` runs the engine and writes `public/models/<slug>.json`, a **FOLD 1.1** file (`file_frames`, `vertices_coords`, `faces_vertices`) with the playback data under `fold:` keys. The largest file is 20 KB gzipped (the budget is 300 KB).

- **State:** faces in crease-pattern space, one rigid transform per face, a global stacking order.
- **Folds are rigid hinge groups.** A flap selection flood-fills every face connected on the moving side, so a fold always takes the layers real paper would take with it.
- **Compound folds** (collapse, petal, squash-like gussets, reverse folds) have free hinges that a small Levenberg–Marquardt solver sets per frame so shared creases stay joined. Reverse folds open the flap along its spine (the two halves mirror exactly) and close it as the tip turns inside out, which is what a rigid sheet requires. The petal fold is driven by its sides, because driving the flap hits a singular point.
- **Stacking order comes from motion.** After each fold, faces that moved are ordered by their height a moment before landing. The tuck, petal folds and reverse folds land in the physically right order without hand-written layer rules.

### The validation gate (PRD "bake step checks")

`npm test` (and `npm run bake`) fail if any of these break:

1. **No face passes through another at any frame.** True geometry is tested every 1/24 of every step: segment–triangle crossings between faces that move differently. Faces that share one smooth motion field, and stacked near-parallel layers (whose order is the stacking check's job), are not compared.
2. **No tear:** every crease shared by two faces stays joined to within 0.0025 sheet widths (about 0.4 mm on 15 cm paper).
3. **Maekawa and Kawasaki** hold at every interior vertex of every flat state.
4. **Budget:** under 300 KB per model.

**Not done:** "the final state matches a reference photo". There are no reference photos, so final shapes were checked by eye against the traditional models only. A photo comparison needs real photographs and a person to take them.

## Decisions on the PRD's open questions

- **Final name and domain:** kept **Fold**. The Vercel project is `fold-origami`; `fold-origami.vercel.app` belongs to someone else, so the live address is `fold-origami-six.vercel.app` until a custom domain is bought.
- **Free forever, or paid model packs later:** free in v1, with no payment code. Models are self-contained files listed in one generated index (`lib/library.ts`), so a later pack is just more files plus an entitlement check.
- **Right- or left-handed guided camera:** the guided camera looks from the folder's side of the table, square on, and is the same for both hands. "Check yourself" shows the paper top-down as it sits in front of you. A mirrored left-hand view would be one more toggle; not built.
- **Phone camera "check my fold":** not in v1. It is close to AR, which the PRD puts out of scope.
- **Sound on or off by default:** off, as the PRD's feature table says. One tap turns it on and the choice is remembered.

## Other choices

- **Next.js app router (static pages, no backend)** rather than `output: "export"`. Every route prerenders statically, and keeping the default output lets the OG image use `next/og`.
- **Authored source is TypeScript, not hand-written FOLD JSON.** It is typed and can compute exact crease points (for example the cup's 22.5° fold). The baked output is FOLD.
- **The cup's tuck:** the PRD's cup "tucks a flap". A rigid point sliding between the two layers of a pinned pocket crossed the pocket's lid in validation, so the lesson lifts the top flap on its own crease, folds the point down under it, and closes the flap. It locks the same way.
- **Masu box** is 9 steps, not the estimated 12; **frog** 12 (est. 14); **flapping bird** 18 (est. 16); **crane** 21 (est. 20).
- **No-WebGL fallback** is a before/after flat diagram per step, drawn from the same baked geometry, rather than pre-rendered video, which would have meant about 90 video files.
- **Post effects:** no depth of field or SSAO yet. The look comes from the material, layer offsets, a soft key light and a real shadow. Quality tiers drop pixel ratio first.
- **Analytics:** Vercel Web Analytics (no cookies) with custom events `lesson_started`, `step_reached`, `lesson_finished`, `share_image`, `next_model`. Custom events need Web Analytics enabled on the Vercel project.

## Develop

```bash
npm install
npm run bake      # engine + validation -> public/models/*.json, lib/library.ts
npm test          # the validation gate as tests
npm run dev
npm run sheet -- crane /tmp/crane.html   # contact sheet of every step (before / mid / after)
```

`/dev/thumb?slug=<model>` (dev only) renders a finished model for the library thumbnails in `public/thumbs`.

## Still needs a person

- The PRD's phase gates are human tests: a side-by-side with real paper judged by three people who didn't build it, a beginner folding the cup and the crane from the site alone, and the frame-rate targets on an iPhone 13 and a mid-range Android. None of these can be run here.
- Authoring the lily.
- Turning on Web Analytics in the Vercel dashboard so custom events are recorded.
