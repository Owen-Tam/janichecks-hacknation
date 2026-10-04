# JaniChecks

**Offline coffee leaf-disease diagnosis for smallholder farmers.**

JaniChecks (*janji* = "leaf" in Kiswahili) is an Expo / React Native app built for the HackNation hackathon. A farmer photographs a coffee leaf, an on-device ONNX model classifies it, the app presents agronomic advice with **Swahili audio narration**, and the record is handed off to an agricultural extension officer as a field report.

Everything runs **on the handset**. No account, no network call, no API key. The model, the advice text, and the Swahili audio are all bundled in the app binary.

---

## Table of contents

- [The problem](#the-problem)
- [How it works](#how-it-works)
- [Features](#features)
- [Quick start](#quick-start)
- [Requirements](#requirements)
- [Project structure](#project-structure)
- [How the app works internally](#how-the-app-works-internally)
- [The ML pipeline](#the-ml-pipeline)
- [Model performance](#model-performance)
- [Localization](#localization)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Data model](#data-model)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Credits](#credits)

---

## The problem

A smallholder coffee farmer notices a suspicious leaf during the week. She cannot get a diagnosis then — no connectivity, no extension officer on the slope, and by the time one arrives the damage has spread.

The target user for this design (**"Noor"**, in [`docs/ML_PLAN.md`](docs/ML_PLAN.md)) picks the leaf on a Friday or Saturday and photographs it **at home**, on a budget Android phone, on a kitchen table, under imperfect light. The photo is never taken in the field.

That single constraint drives the entire technical approach — see [The ML pipeline](#the-ml-pipeline).

---

## How it works

```
┌──────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐
│  1. Capture   │ → │ 2. Classify  │ → │ 3. Advise     │ → │  4. Hand off  │
│  camera /    │   │  on-device   │   │  text + audio │   │  extension   │
│  library     │   │  MobileNetV3 │   │  (EN / SW)    │   │  officer     │
└──────────────┘   └──────────────┘   └───────────────┘   └──────────────┘
                     256×256 NCHW         Swahili MP3        field report
                     offline inference   Swahili MP3        field report
                     (~8 ms CPU¹)        narration          + stat tiles
```

> ¹ 8.37 ms is the exported variant's single-thread CPU time **on a laptop** (`ml/export/export_report.json`). It is not a device measurement — no on-device benchmark has been run yet.

Five classes are detected:

| Label | Disease |
| --- | --- |
| `healthy` | Healthy leaf |
| `leaf_miner` | Coffee leaf miner |
| `rust` | Coffee leaf rust |
| `phoma` | Phoma leaf spot |
| `cercospora` | Cercospora leaf spot |

The model can also **abstain**. Rather than guessing, it returns one of three states:

| State | Meaning |
| --- | --- |
| `confident` | Top class ≥ `0.84`. Give a single-disease answer. |
| `possibly_multiple` | Two diseases both plausible. Show both, with combined advice. |
| `not_sure` | Below threshold. Tell the farmer to retry with a better photo. |

Abstention is a **safety feature**, not a UX detail. When photo quality degrades, the model should say "not sure" more often rather than produce confidently wrong answers. On a held-out mixed-stress set, 84.8% of images are correctly flagged instead of misclassified.

---

## Features

- **Two personas, one app.** A role picker at `/` routes farmers to `/user` and extension officers to `/eo`.
- **On-device inference.** MobileNetV3-Small, ONNX opset 17, fp16 weights (3.09 MB), run through `onnxruntime-react-native`. Zero network dependency.
- **Swahili audio advice.** Every advice section has a bundled Swahili MP3 (`swahili/<class>/<section>.mp3`) played back with `expo-audio`. Illiteracy-proof access to agronomic guidance.
- **Bilingual throughout.** Kiswahili (default) and English, switchable from the home screen, persisted to `AsyncStorage`.
- **Seasonal advice.** Advice entries can carry a `seasonal` block injected based on the current month — e.g. Phoma gets rainy-season-end fungicide guidance in April/May.
- **Hand-off workflow.** Record state machine `pending → confirmed → sent`. Confirmed records "arrive" at the extension officer's field report (`/eo/[userId]`) alongside per-farmer stat tiles.
- **Plant registry.** Attach a diagnosis to a new named plant or to an existing plant the farmer has recorded before.
- **Seeded demo data.** Three demo farmers, five plants, five sample diagnoses ship on first run so the extension-officer view is populated immediately.
- **Dev mode.** A flag (persisted to `hacknation:dev-mode`) that reveals per-class probability bars and inference latency.

---

## Quick start

This project requires a **development build**, not Expo Go — `onnxruntime-react-native` ships native code that Expo Go's bundled modules do not include.

```bash
# 1. Install dependencies (npm — package-lock.json is committed)
npm install

# 2. Start the Metro bundler
npm start

# 3. In a second terminal, build and run on a simulator / device
npm run ios       # iOS (Xcode required)
npm run android   # Android (Android Studio + SDK required)
```

`ios/` and `android/` are generated by [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/) and are gitignored. Do not commit or hand-edit them — configure native behaviour in `app.json` and config plugins.

`npm run ios` will prebuild the native project and install pods on first run; subsequent runs reuse the existing `ios/` directory.

To try it without a build, run `npm run web` for the web target. Note that camera capture and ONNX inference are native paths and are not fully functional on web — web is for layout and routing work only.

There is **no environment configuration step**. The app has no `.env` file, no secrets, and no backend.

---

## Requirements

| Requirement | Version |
| --- | --- |
| Node.js | 20+ (LTS recommended) |
| npm | 10+ (`package-lock.json` is committed; use npm, not yarn/pnpm) |
| Expo SDK | 57 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Xcode | 15+ for iOS builds |
| Android Studio | Koala+ with a configured SDK for Android builds |
| Python | 3.10+ **only if** you want to retrain or re-export the model |

---

## Project structure

```
.
├── app.json                  Expo config — name, plugins, permissions, bundle id
├── metro.config.js           Adds `.onnx` to assetExts so Metro resolves the model
├── eslint.config.js          Flat config, eslint-config-expo
├── tsconfig.json             Extends expo/tsconfig.base, strict: true
│
├── src/
│   ├── app/                  Every file here is a route (Expo Router)
│   │   ├── _layout.tsx       Root: fonts, I18nProvider, themed Stack
│   │   ├── index.tsx         Home — role picker + language toggle
│   │   ├── user/
│   │   │   ├── index.tsx     Farmer home
│   │   │   ├── camera.tsx    Capture → preview → classify → name/existing wizard
│   │   │   └── records.tsx   Farmer's record list + detail
│   │   └── eo/
│   │       ├── index.tsx     Extension officer — client list
│   │       └── [userId].tsx  Field report for one farmer
│   │
│   ├── components/           Bg, LanguageSwitch, AdviceReport, DevProbs
│   ├── i18n/                 I18nProvider, useI18n(), en.ts, sw.ts
│   ├── lib/
│   │   ├── leafModel.ts      ONNX session, preprocessing, classification
│   │   ├── advice.ts         Disease → advice + seasonal advice
│   │   ├── swahiliAudio.ts   Disease + section → bundled MP3
│   │   ├── samples.ts        `sample:<key>` pseudo-URI resolution
│   │   ├── store.ts          AsyncStorage CRUD, seed data, types
│   │   ├── theme.ts          Color tokens + font family names
│   │   └── devMode.ts        Dev-mode pub/sub
│   └── types/assets.d.ts     Ambient declarations for `*.onnx` and `*.mp3`
│
├── assets/
│   ├── model/                leaf_model.onnx, labels.json, thresholds.json
│   ├── samples/              Five bundled demo leaf photos
│   └── advice.json           All advice copy, as i18n keys
│
├── swahili/<class>/          Swahili MP3 narration per class per advice section
│
├── ml/                       Python training + export pipeline
│   ├── src/                  config, splits, masks, backgrounds, augment,
│   │                         dataset, model, train, stress, calibrate, export
│   ├── notebooks/            01–08 exploratory and training notebooks
│   ├── splits/               Committed stratified 70/15/15 CSV splits
│   ├── artifacts/            Committed metrics + charts
│   └── export/               Source of assets/model/
│
└── docs/ML_PLAN.md           Design rationale — read this first
```

---

## How the app works internally

### Inference (`src/lib/leafModel.ts`)

1. **Load the session** — lazy singleton `InferenceSession` from the bundled `.onnx`, resolved to a local file URI via `expo-asset`. If loading fails the singleton resets so the next call retries.
2. **Preprocess** — `expo-image-manipulator` resizes the whole photo to fit inside a 256×256 white square (**no cropping** — matching the training view of a leaf centred on white), then `jpeg-js` decodes it to raw RGBA. Pixels are normalized with ImageNet mean/std and packed into an NCHW `Float32Array`.
3. **Run** — a single `session.run`. Measured at 8.37 ms single-threaded on a laptop; not yet benchmarked on a handset.
4. **Decide** — `statusFor(probs)` applies the shipped thresholds (`min_conf`, `multi_conf` from `assets/model/thresholds.json`); `pairedDisease()` returns the second disease when the answer is `possibly_multiple`.

> The preprocessing in `leafModel.ts` is a hard contract with `ml/src/augment.py` and `ml/export/preprocess.json`. If you change one side, change the other — a mismatch degrades accuracy silently.

### Storage (`src/lib/store.ts`)

The entire data layer is a single `AsyncStorage` key, `hacknation:data:v3`, holding a JSON array of `FieldUser` objects. On first run it seeds three demo farmers. `CURRENT_USER_ID` is pinned to `'u1'` — **there is no authentication**; this is a demo scope, not production multi-tenancy.

### Assets

| Concern | Mechanism |
| --- | --- |
| `*.onnx` | `metro.config.js` adds `onnx` to `assetExts`; `src/types/assets.d.ts` declares the module type |
| `*.mp3` | Declared ambiently; resolved through `expo-audio`'s player API |
| Demo photos | Stored as `sample:<key>` pseudo-URIs in `store.ts`; `samples.ts` swaps them for bundled `assets/samples/*.jpg` at render time. Real camera captures stay as file URIs |

---

## The ML pipeline

`ml/` is a full training and export pipeline. You do **not** need it to run the app — the exported model is committed at `assets/model/leaf_model.onnx`. You need it only if you want to retrain.

### The core problem

BRACOL, the source dataset, is leaves photographed on **clean white studio backgrounds**. Real photos will be a picked leaf on a kitchen table under a dim lamp, shot on a cheap camera, slightly out of frame and a little blurry. That is a large domain gap, and closing it is the whole point of the pipeline.

### The approach: scenario-driven synthetic augmentation

Rather than generic image augmentation, `ml/src/augment.py` simulates the specific scenario "leaf picked on a slope, photographed at home on the weekend":

- **Lighting** — window, doorway, yard, dim, warm lamp
- **Backgrounds** — wood, kanga/kitenge cloth, concrete, earth, paper, hand (procedurally generated in `backgrounds.py`)
- **Leaf condition** — picked-leaf curl and dulling (never yellowing or browning, which would corrupt the label)
- **Camera artifacts** — sensor noise, JPEG quality 30–80, downscale to 0.35–0.7, defocus
- **Handheld framing** — rotation, tilt, off-centre placement, partial leaf at 60–100%, motion blur

Deliberately **excluded**: field foliage / soil / grass backgrounds, harsh sun, fog, dew. They would add noise without adding realism.

Leaf wilting is not modelled at all. Instead the app *tells* the farmer to pick the leaf on Friday or Saturday and keep it wrapped in cloth — a real-world constraint, not something to learn from augmentation.

### Pipeline stages

| Module | Role |
| --- | --- |
| `config.py` | Class list, `SEED = 42`, mixed-class index |
| `make_splits.py` | Stratified 70/15/15 train/val/test, plus a mixed-stress holdout |
| `masks.py` | HSV-based leaf segmentation |
| `backgrounds.py` | Procedural home-surface textures |
| `augment.py` | Scenario augmentation + the canonical `eval_view` |
| `dataset.py` | Torch dataset + dataloaders |
| `model.py` | `mobilenetv3_small_100` via `timm` |
| `train.py` | Training loop, per-condition eval |
| `stress.py` | Held-out stress-condition evaluation |
| `calibrate.py` | Temperature scaling (ECE 0.0376 → 0.0205 on seen, 0.0472 → 0.0397 on unseen) |
| `export.py` | ONNX opset 17 export, three quantisation variants, parity check |

### Reproducing

```bash
# BRACOL source images are NOT committed — download from Mendeley Data first
# (Krohling et al., "BRACOL", CC BY 4.0) into ./data_raw/
# then:
python -m ml.src.train
python -m ml.src.stress
python -m ml.src.calibrate
python -m ml.src.export

# copy the chosen export into the app
cp ml/export/leaf_model.onnx   assets/model/leaf_model.onnx
cp ml/export/labels.json       assets/model/labels.json
cp ml/export/thresholds.json   assets/model/thresholds.json
```

There is no `requirements.txt` or `pyproject.toml` — ML dependencies are not pinned. Expect to install `torch`, `timm`, `onnx`, `onnxruntime`, `opencv-python`, `numpy`, `pandas`, `matplotlib`, `scikit-learn` yourself.

### Export variant selection

| Variant | Size | Top-1 agreement vs fp32 | Status agreement |
| --- | --- | --- | --- |
| fp32 | 6.10 MB | 1.000 | 1.000 |
| **fp16_weights** (shipped) | **3.09 MB** | **1.000** | **1.000** |
| int8_weights | 1.92 MB | 0.999 | 0.988 |
| int8_static | 1.87 MB | 0.712 | 0.469 |

`int8_static` was rejected despite being smallest — static quantisation broke the abstention logic. The selection rule is "smallest variant with ≥0.999 top-1 agreement and ≥0.99 status agreement", because **status agreement matters more than raw accuracy**: a quantisation artefact that flips a `confident` prediction into a wrong one is a farmer getting bad advice.

---

## Model performance

Measured on the committed test split (202 leaves). Thresholds fit on validation only; test and mixed holdout were each scored once.

| Condition | Accuracy | Macro F1 | Acc when confident | Confidently wrong |
| --- | --- | --- | --- | --- |
| Clean studio | 0.871 | 0.845 | **0.977** | 0.015 |
| Realistic weekend photo at home | 0.777 | 0.751 | **0.942** | 0.025 |
| Mean, seen stress conditions | 0.820 | 0.790 | 0.967 | 0.016 |
| Mean, unseen stress conditions | 0.825 | 0.808 | — | — |

The realistic row is the one that matters, and it looks *worse* than the clean row by design: the model abstains far more often (37.6% `not_sure` vs 17.8%). That is the intended behaviour under degraded photo quality.

Target was ≥0.95 accuracy on confident predictions; the clean split hits 0.977.

### Abstention behaviour

| Condition | Flagged (`not_sure` or `possibly_multiple`) |
| --- | --- |
| Mixed-stress holdout, clean | 84.8% |
| Mixed-stress holdout, realistic | 88.1% |

On the clean mixed holdout, only 15.3% of leaves produced a confident answer whose top-1 was one of the actually-present stresses. A wrong answer is much more expensive than no answer here.

---

## Localization

- **Kiswahili is the default.** English is opt-in.
- Dictionaries live in `src/i18n/en.ts` (which also exports the `Messages` type) and `src/i18n/sw.ts` (typed as `Loose<Messages>`, so missing keys surface at typecheck).
- `lookup()` resolves dotted paths and returns the key itself on a miss, so a missing translation degrades visibly rather than rendering blank.
- `assets/advice.json` stores **i18n keys, not copy** (`advice.rust.title`, `advice.rust.early`, …) — so every disease reuses the same dictionaries.
- Sample plant names, notes, and crop values in the seed data are stored as `samples.*` keys and resolved through `storedText()`. Free-typed notes are stored and displayed verbatim.
- Swahili narration is one MP3 per `(class, section)` pair. `not_sure` routes to `swahili/unsure/`.

---

## Scripts

| Command | Action |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run ios` | Build and run on iOS (`expo run:ios`) |
| `npm run android` | Build and run on Android (`expo run:android`) |
| `npm run web` | Start the web target |
| `npm run lint` | ESLint via `expo lint` |
| `npx tsc --noEmit` | Typecheck (strict mode) |
| `npx expo-doctor` | Diagnose dependency and config issues |
| `npx expo install <pkg>` | **Always** add dependencies this way, never `npm install <pkg>` directly — it resolves SDK-compatible versions |
| `npx expo install --fix` | Fix incompatible package versions |

There is no `typecheck` script and no test suite. Run `npm run lint` and `npx tsc --noEmit` before declaring work done.

---

## Configuration

Everything is in `app.json`:

| Field | Value |
| --- | --- |
| `name` | `JaniChecks` |
| `slug` | `hacknation-hackathon` |
| `ios.bundleIdentifier` | `com.owent6.hacknation-hackathon` |
| `scheme` | `hacknation` (deep links) |
| `orientation` | portrait |
| `userInterfaceStyle` | light |

Config plugins: `expo-router`, `expo-camera` (custom permission copy), `expo-image-picker` (photos + camera, microphone disabled), `onnxruntime-react-native`, `expo-asset`, `expo-audio`.

**No environment variables.** There are no `EXPO_PUBLIC_*` vars, no `.env`, and no secrets — the app is fully offline.

---

## Data model

```ts
FieldUser {
  id, name, village, crop,
  plants:   Plant[],
  records:  PlantRecord[],
}

Plant       { id, name, species, identifiedAt }

PlantRecord {
  id, plantId, imageUri, date,
  status: 'pending' | 'confirmed' | 'sent',
  note,
  diagnosis?: Diagnosis,
}

Diagnosis  { label, status: 'confident'|'possibly_multiple'|'not_sure', also?, probs? }
```

Status is a one-way state machine: `pending → confirmed → sent`. A farmer confirms a diagnosis, which surfaces it in the matching extension officer's field report.

There is no schema file, ORM, or migration system — the whole dataset is a single JSON document under `hacknation:data:v3`.

---

## Known limitations

Honest list of what this is not yet:

- **No authentication.** `CURRENT_USER_ID` is hardcoded to `'u1'`. Any farmer can see any other farmer's records by URL.
- **No backend.** "Sent to extension officer" is a local status change. There is no sync, no server, no multi-device continuity.
- **No test suite and no CI.** No jest/vitest, no pytest, no `.github/workflows`. The ML metrics in this README are the only automated verification in the repo.
- **No `eas.json`.** No EAS build profiles, no OTA update channels. Builds are local only.
- **iOS only in practice.** `android/` has never been generated or verified.
- **Home conditions are simulated, not real.** Every stress test is a synthetic re-render of a studio photo. The headline "realistic weekend photo" number is not measured against real Kenyan photos. Cross-domain validation on JMuBEN or RoCoLe is listed as future work.
- **Dataset gaps.** BRACOL is Brazilian Arabica on white backgrounds only. 345 of 1,748 images were unusable, and only 142 healthy examples survived filtering. No berry disease, no wilt, no nutrient deficiency — leaves only.
- **Dead code.** `src/components/DevProbs.tsx` (`DevModeSwitch`, `DevProbs`) and `src/lib/devMode.ts` are not wired into any screen. `expo-linear-gradient` is a dependency but `Bg.tsx` uses a solid fill.
- **Stray files in the repo root.** `output.png` through `output5.png` are committed debug screenshots (~8 MB total) and should be moved or removed.

---

## Roadmap

From [`docs/ML_PLAN.md`](docs/ML_PLAN.md):

- A severity head feeding an urgency score into the app, rather than a single label.
- Cross-domain validation on real Kenyan field photos (JMuBEN, RoCoLe).
- Out-of-distribution rejection for photos that are not coffee leaves at all.

Beyond that, the obvious next steps are real auth, a sync backend to make the extension-officer handoff real, and a test suite.

---

## Credits

- **Dataset** — BRACOL, Krohling et al., Mendeley Data. **CC BY 4.0.** The source images are *not* committed to this repository (`data_raw/` is gitignored) and the dataset is not linked from this repo, so locate it on Mendeley Data before running the pipeline.
- **Architecture** — MobileNetV3-Small, via `timm`.
- **Runtime** — [onnxruntime-react-native](https://github.com/microsoft/onnxruntime) for on-device inference.
- **Framework** — [Expo](https://expo.dev) SDK 57 and [Expo Router](https://docs.expo.dev/router/).
- **Fonts** — Fraunces and Sora via `@expo-google-fonts`.

See [`docs/ML_PLAN.md`](docs/ML_PLAN.md) for the full design rationale and [`AGENTS.md`](AGENTS.md) for the tooling rules this project is developed against.