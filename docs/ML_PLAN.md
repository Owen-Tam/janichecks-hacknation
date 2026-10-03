---
name: BRACOL ML Model
overview: Train a small classifier on the BRACOL leaf images already in data_raw/leaf. Its output is a single softmax vector over 5 classes (0 healthy, 1 leaf miner, 2 rust, 3 phoma, 4 cercospora) whose probabilities sum to 1. A status of confident, possibly_multiple or not_sure is derived from the probabilities. Augmentation is modeled on Noor's real photo conditions, and a scenario stress test shows how the model holds up under them. Export as an ONNX file of about 5 MB or less, with labels and thresholds.
todos:
  - id: setup
    content: Create ml/ scaffold, requirements.txt, .gitignore for data_raw/, cache/ and artifacts
    status: pending
  - id: data
    content: Build manifest from data_raw/leaf/dataset.csv filtered to the 1,402 images present; exclude predominant_stress==5 into mixed_holdout.csv; stratified 70/15/15 splits on classes 0-4
    status: pending
  - id: masks
    content: masks.py - segment leaf from white background (HSV threshold + morphology + largest component), cache masks, save QA contact sheet
    status: pending
  - id: backgrounds
    content: backgrounds.py - procedural home textures (wood, fabric, concrete, earth floor, paper, hands) + optional ml/backgrounds/ folder for real team photos
    status: pending
  - id: augment
    content: augment.py - home-photo scenario pipeline (background composite, home lighting, picked-leaf curl/dulling, budget-camera artifacts, handheld blur, geometry) with label-safety caps; save aug_preview.png
    status: pending
  - id: train
    content: model.py (MobileNetV3-Small, 5-way head) + train.py with class-weighted loss; train baseline (light aug) and scenario-aug model on MPS
    status: pending
  - id: calibrate
    content: Temperature scaling + tune min_conf / multi_conf -> thresholds.json
    status: pending
  - id: evaluate
    content: Clean test metrics + class-5 holdout fail-safe rate -> metrics.json, confusion_matrix.png
    status: pending
  - id: stress
    content: stress_test.py - deterministic scenario conditions on test split; per-condition macro-F1 and not_sure rate for baseline vs scenario-aug -> stress_test.json + chart
    status: pending
  - id: export
    content: Export ONNX (softmax inside graph) + int8 quantization, parity check, size/latency report, labels.json + preprocess.json
    status: pending
  - id: predict
    content: predict.py CLI printing the 5-class probability vector + status (confident / possibly_multiple / not_sure)
    status: pending
isProject: false
---

# BRACOL Coffee Leaf Model: ML Plan

## Output contract
Input: one leaf photo. Output: a vector of 5 probabilities that sums to 1. Softmax is built into the exported graph, so the app receives probabilities directly.

- 0: healthy
- 1: leaf miner
- 2: rust
- 3: brown leaf spot (phoma)
- 4: cercospora leaf spot

`status` is derived from the probabilities and takes one of three values:
- `confident`
- `possibly_multiple`: the top two classes are both diseases and both are above `multi_conf`.
- `not_sure`: the top probability is below `min_conf`.

Example `predict.py` output:

```json
{"probs": [0.02, 0.05, 0.81, 0.06, 0.06], "top": 2, "label": "rust", "status": "confident"}
```

Artifacts in `ml/artifacts/`:
- `coffee_leaf.int8.onnx`
- `labels.json`: index-to-name mapping, as listed above.
- `preprocess.json`: input size, ImageNet mean/std, resize method.
- `thresholds.json`: temperature, `min_conf`, `multi_conf`.
- `metrics.json` and `confusion_matrix.png`
- `stress_test.json` and `stress_test.png`
- `aug_preview.png`

## Data (already in the repo)
- Source: `data_raw/leaf/images/*.jpg` (2048x1024) and `data_raw/leaf/dataset.csv`. Columns: `id, predominant_stress, miner, rust, phoma, cercospora, severity`.
- **Label: `predominant_stress`.** The separate `severity` column (0–4) is not used by the first model.
- Use only the 1,402 rows whose image file exists. The other 345 images are missing.
- Images available per class:
  - healthy: 142
  - miner: 254
  - rust: 465
  - phoma: 346
  - cercospora: 136
  - `predominant_stress == 5` (no predominant stress): 59
- **The 59 class-5 images are excluded from training.** They are saved to `ml/splits/mixed_holdout.csv` and used only to test the "not sure" and "possibly multiple" rules.
- Stratified 70/15/15 split of the 1,343 class 0–4 images with a fixed seed, saved to `ml/splits/{train,val,test}.csv`. Use class-weighted cross-entropy and report macro-F1.
- Source and license: BRACOL (Krohling et al., Mendeley Data, CC BY 4.0).
- What the images look like: a single leaf lying flat and horizontal on a uniform white background, evenly lit indoors. Lesions can be very small, a few pixels across at 224 px.

## Scenario-driven augmentation
**How the photo is taken:** Noor picks a suspicious leaf on the slope during the week and brings it home. The leaf is photographed at home on the weekend, when the daughter and her smartphone are there. The photo is never taken in the field. So augmentation simulates a picked leaf, photographed at home, on a budget phone. Every augmentation is synthetic, and the data card will say so.

**1. Home lighting** (no Wi-Fi, possibly little or no grid power):
- Daylight through a doorway or window: strong light from one side, gradients, soft shadows (`RandomShadow`, gradient brightness masks).
- Taken in the yard or on the doorstep: brighter, harder light, some overexposure (`RandomBrightnessContrast`, `RandomGamma`).
- Dim interior or evening: low brightness and gamma, with low-light noise (`ISONoise`).
- Warm or odd white balance from a bulb, solar lamp or kerosene lamp: color temperature shift in the RGB channels.

**2. Home backgrounds** (via background replacement):
- Wooden table, patterned cloth such as a kanga or kitenge, concrete floor, packed-earth floor or doorstep, paper or a notebook page, the palm of a hand holding the leaf.
- The white background is also kept sometimes (p=0.4): someone may well lay the leaf on paper, as in BRACOL.

**3. A picked leaf that waited for the weekend** (it may be hours to days old):
- Mild curling and warping: `ElasticTransform`, `GridDistortion`, perspective.
- Slight dulling, with less saturation and contrast.
- **No yellowing or browning.** Wilting colors look like disease and would corrupt the label. In the app, Noor should be told to pick the leaf on Friday or Saturday and keep it in a bag or wrapped in cloth. That is a real-world constraint, not something to learn from augmentation.

**4. Budget Android camera** (the household's only smartphone):
- `GaussNoise` and `ISONoise`, `ImageCompression` at quality 30–80, `Downscale` to 0.35–0.7 then back up, slight defocus, close-focus blur.

**5. Handheld framing** (the daughter or Noor holding the phone):
- Any rotation (BRACOL leaves are always horizontal), perspective tilt, off-center framing, a partial leaf (60–100% visible), scale variation, light `MotionBlur`.

**Not simulated, by design:** field backgrounds such as foliage, soil or grass, harsh sun on the slope, fog, and dew. The photo isn't taken in the field, so these would add noise without adding realism.

**How background replacement works:**
- `masks.py` separates the leaf from the white background once. Background pixels have low saturation and high brightness. After an HSV threshold, morphological open/close and keeping the largest connected region, the mask is cached in `ml/cache/masks/`. A contact sheet of masks is saved for a quick visual check.
- `backgrounds.py` generates home textures procedurally, so there are no license issues: wood grain, patterned fabric, concrete, packed earth, lined paper, and skin-tone surfaces of several shades for the hand case. It can optionally use an `ml/backgrounds/` folder of real photos (tables, cloth, floors, hands) the team takes on their own phones.
- Compositing: the leaf is cut out with feathered edges and a soft drop shadow, then placed with random scale, position and rotation. Sometimes the background is blurred, as a phone camera's shallow focus would.

**Label-safety caps.** An augmentation must never fake or erase the disease:
- Hue shift no more than about ±5 degrees, and no added yellow or brown blotches, since those look like rust, cercospora or phoma.
- Blur, downscale and JPEG strength are capped so small lesions stay visible. Check `aug_preview.png` (a grid of augmented samples per class) before training at full length.
- Train only on augmented images. Validation and test splits stay clean, and the scenario conditions are measured separately in the stress test.

**Training pipeline probabilities** (albumentations `Compose`; first guesses, to adjust after seeing the preview):
- Background composite: p=0.6. The other 40% keep the white background.
- `OneOf` the home-lighting variants (window or doorway, yard, dim or evening, warm lamp): p=0.8.
- Picked-leaf curl and dulling: p=0.4.
- `OneOf` the camera artifacts: p=0.7.
- `OneOf` motion blur or defocus: p=0.3.
- Geometry: always applied.

**Input resolution:** start at 224. If the small-lesion classes (cercospora, miner) score badly, try 288 or 320. MobileNetV3-Small has the same number of parameters at any resolution, so the file stays small and only inference gets slower.

## Model and training
- `timm` `mobilenetv3_small_100`, ImageNet-pretrained, with one 5-way linear head. If accuracy is poor, try `efficientnet_lite0` next.
- AdamW with a cosine schedule, about 30 epochs. Freeze the backbone for the first 2–3 epochs. Keep the checkpoint with the best validation macro-F1. Device: MPS, falling back to CPU.
- **Two training runs for comparison:**
  - A baseline with light augmentation only (flips and crops).
  - The scenario-augmented model.
  - Comparing them on the stress test shows what the augmentation actually buys.

## Calibration and "not sure"
- Temperature scaling on the validation set. Report the calibration error (ECE) before and after.

```python
if top1 < min_conf:                                      # starting point ~0.5-0.6, tuned on val
    status = "not_sure"
elif top1_is_disease and top2_is_disease and top2 >= multi_conf:   # starting point ~0.3
    status = "possibly_multiple"
else:
    status = "confident"
```

- Tune `min_conf` so the `confident` predictions reach at least 95% validation accuracy. Report the coverage against accuracy trade-off.
- Fail-safe check: report the share of the 59 class-5 holdout images flagged `not_sure` or `possibly_multiple`.

## Scenario stress test (evidence it works)
`stress_test.py` runs the clean test split under fixed, deterministic conditions. Each one is generated with a fixed seed and two strengths (mild, strong):
- clean
- home background (table, cloth, floor, hand)
- side light from a window or doorway, with shadows
- dim, warm evening or lamp light
- picked-leaf curl and dulling
- budget camera (downscale, noise, JPEG)
- handheld motion blur
- "realistic weekend photo at home": background, lighting, curl, camera and blur combined

For each condition and each model (baseline and scenario-augmented), it reports macro-F1, the `not_sure` rate, and **the rate of confident wrong answers**. That last number matters most: when photo quality drops, the model should say "not sure" more often rather than give more confident wrong answers. Output: `stress_test.json` and a bar chart for the video.

## Export
- PyTorch with a temperature-scaled softmax wrapper, exported to ONNX (opset 17), then int8 quantization with onnxruntime.
- Parity check: the top class should match PyTorch on at least 98% of test images. Record the file size and CPU latency.

## Files

```
ml/
  requirements.txt   # torch, torchvision, timm, albumentations, opencv-python, onnx, onnxruntime, scikit-learn, pandas, matplotlib
  backgrounds/       # optional real background photos taken by the team
  cache/masks/       # gitignored
  splits/
  src/
    make_splits.py
    masks.py         # leaf segmentation + QA sheet
    backgrounds.py   # procedural textures + folder loader
    augment.py       # scenario pipelines + label-safety caps + preview grid
    dataset.py
    model.py
    train.py         # --aug {light,scenario}
    calibrate.py     # -> thresholds.json
    evaluate.py      # -> metrics.json, confusion_matrix.png
    stress_test.py   # -> stress_test.json, stress_test.png
    export_onnx.py   # -> coffee_leaf.int8.onnx, labels.json, preprocess.json
    predict.py       # image -> probs vector + status
  artifacts/
```

## Success criteria
- Clean test macro-F1 of 0.85 or higher across classes 0–4.
- On the "realistic weekend photo at home" stress condition, the scenario-augmented model beats the baseline on macro-F1 and has fewer confident wrong answers.
- Most of the class-5 holdout images are flagged `not_sure` or `possibly_multiple`.
- Quantized model of 5 MB or less, CPU inference under 100 ms, probabilities sum to 1.
- Data gaps written down:
  - Brazilian Arabica on white backgrounds only; the home photo conditions are simulated, not real photos.
  - Wilting or drying of a leaf picked days earlier is not modeled. It is handled by guidance to Noor (pick it close to the weekend and keep it wrapped).
  - 345 images missing, and only 142 healthy examples.
  - Leaves only.
  - No classes for coffee berry disease, wilt, or nutrient deficiency.

## Deferred
- A severity head, which would feed the app's urgency score.
- Cross-domain testing on real field photos from JMuBEN (Kenya) or RoCoLe. This is the true check of how well the simulated conditions match reality.
- An out-of-distribution check that rejects photos that aren't coffee leaves.
