# 🔥 FLAMABLE AI CAMPING GAS SID (v2.4) — Project & Technical Description

> **Creative Commons Attribution 4.0 International (`CC BY 4.0`)**  
> **Created by:** [River Lyle Reuveni (Imortalimp — `imortalimp.nl`)](https://imortalimp.nl) & [Arena.ai Agent (`arena.ai`)](https://arena.ai)  
> **License:** [CC BY 4.0 (`https://creativecommons.org/licenses/by/4.0/`)](https://creativecommons.org/licenses/by/4.0/)

---

## 1. Overview

**"FLAMABLE AI CAMPING GAS SID" (v2.4)** is a self-contained, browser-native **Commodore 64 MOS 6581 / 8580 hybrid wavetable synthesizer, 4-voice tracker, programmable Song Arranger, Timing Master & Style-Driven Wavetable Synth Confluence Workstation, Direction-Templated Pattern Generator (`Full Harmony` / `Melody Only` / `Rythm Only`), and one-click 2–6 minute procedural chiptune generator** built for **[imortalimp.nl](https://imortalimp.nl)**.

Inspired by classic C64 demoscene soundtracks (**Rob Hubbard**, **Martin Galway**, **Chris Hülsbeck**) and modern cyber-chiptune synthesis (**Łukasz Polkowski / `#lukhash`**), the instrument blends authentic 8-bit pulse-width modulation (PWM), 50 Hz PAL frame-tick arpeggio tables, and 23-bit LFSR noise percussion with custom wavefolded **Square, Triangle, and Sine** wavetable oscillators.

---

## 2. Core Architecture & Package File Structure

The application is engineered as a modular suite of `.html`, `.js`, and `.json` files accompanied by a visitable HTML source-code browser, Markdown documentation, and CC BY 4.0 license:

| File | Role |
| :--- | :--- |
| **`flamable-ai-camping-gas-sid.html`** | Main interactive studio interface (v2.4) featuring the flame-icon ignition transport, Programmable Song Arranger timeline, One-Click 2–6 Minute Song Generator bar with **Timing Master (`#selSongBpm`)**, expanded **`Length` / `Key` / `Scale` / `Style`** matrices, **Direction Template (`#selSongTemplate`: `Full Harmony`, `Melody Only`, `Rythm Only`)**, Live SID Output + Wavetable Oscilloscope with 15+ Quick Tunes & `💾 Save Synth to Quick Tunes`, 4-Row `Z–, & Q–I` (+ `1–0` / `A–L` Sharps, Minors & FX) Violet-Armed Play-In Keyboard, **Wavetable Synth Selector with Style Basis Dropdown (`#selSynthStyleBasis`)**, `🟣 Set Synth on Active Voice` Violet-Armed multi-pattern voice lock, 4-Voice 32-Step Tracker, Browser Saved States list, and Direct-DSP `.WAV` / `.MID` / `.JSON` export deck. |
| **`flamable-ai-camping-gas-sid.js`** | Standalone ES6 Web Audio synthesis, Timing Master envelope/tempo confluence (`applyTimingConfluenceToAllSynths`), 12-Style Wavetable Synth Basis profiles (`getStyleSynthProfile`, `applyStyleBasisToSingleInstrument`), Direction-Templated procedural pattern & song generator (`buildSectionPatternSteps`, `applyTemplateVoiceMask`), Quick Tunes & Wavetable Instrument confluence engine, 4-row live play-in & overdub recorder, Multi-Slot Browser Save State Manager, and Direct-DSP 44.1 kHz Stereo PCM `.WAV` / `.MID` / `.JSON` exporter (`window.FACG_SID`). |
| **`flamable-ai-camping-gas-sid.json`** | External JSON sound & music bank defining the 12 Square / Triangle / Sine wavetable instruments, **16 musical scales**, **12 C64 50 Hz arpeggio tables** (`maj7`, `min7`, `dim`, `oct2`, `hubbard`, `lukhash`, etc.), signature Quick Tune presets, and `CC BY 4.0` attribution metadata. |
| **`flamable-ai-camping-gas-sid-source.html`** | Visitable HTML Source Code Browser allowing visitors on `imortalimp.nl` to inspect, copy, and download the complete source code of the `.js`, `.json`, `.html`, `.md`, and license files with line numbers. |
| **`README.md`** | Complete usage manual covering v2.4 Timing Master BPM Confluence, Expanded `Length`/`Key`/`Scale`/`Style` variables, Wavetable Synth Style Basis selector, Direction Templates (`Full Harmony`, `Melody Only`, `Rythm Only`), Quick Tunes, 4-row Violet-Armed keyboard, `🟣 Set Synth on Active Voice`, Song Arranger, Browser Saved States, and `.WAV`/`.MID`/`.JSON` exports. |
| **`DESCRIPTION.md`** | This technical and musical architecture document (updated through v2.4). |
| **`LICENSE-CC-BY-4.0.txt`** | Creative Commons Attribution 4.0 International (`CC BY 4.0`) license & attribution notice for **River Lyle Reuveni (`imortalimp.nl`)** and **Arena.ai Agent (`arena.ai`)**. |

---

## 3. Synthesis, Confluence & Live Play-In Engine (`v2.3`)

### 3.1 Custom Square / Triangle / Sine Wavetable Generator
Every melodic voice dynamically computes a 256-sample single-cycle wavetable and converts it via Discrete Fourier Transform (48 harmonics) into a Web Audio `PeriodicWave`:
* **Square Wave (with variable Pulse Width `0.08`–`0.92`):** Recreates the hollow, nasal C64 6581 PWM lead and punchy bass timbres.
* **Triangle Wave:** Provides woody C64 flute/bass warmth and sharktooth harmonics.
* **Sine Wave (with FM phase modulation):** Adds deep sub-bass weight and glassy FM bell overtones.
* **Camping Gas Wavefolder & 7-Bit Quantizer:** Applies symmetrical wavefolding (`drive`), soft hyperbolic tangent saturation, and 7-bit DAC step quantization (`128` levels) before feeding a resonant 6581/8580-style multimode filter (`lowpass`, `bandpass`, `highpass`).

### 3.2 Two-Way Confluence: `LIVE SID OUTPUT + WAVETABLE` Quick Tunes ↔ `WAVETABLE SYNTH SELECTOR`
* **15 Built-In Quick Tunes + Unlimited User-Saved Instrument Quick Tunes:** `initQuickTunesAndConfluence()` builds 3 classic signature tunes plus 12 dedicated instrument Quick Tunes (`qt_inst_*`) — one for every Wavetable Instrument in Panel 2 — and merges user-saved Quick Tunes from `localStorage` (`FACG_SID_QUICK_TUNES_V23`).
* **Instant Live Audio Output & Bidirectional Sync:**
  * Selecting any Quick Tune in `#selPreset` or clicking **`▶ Load & Play`** restores that Quick Tune's `instrumentSnapshot`, selects its tab and all 8 sliders in Panel 2 (`🎛️ WAVETABLE SYNTH SELECTOR`), switches to Pattern Loop mode, and immediately starts playing the Quick Tune on the Live SID Output while rendering both the wavetable curve and live `AnalyserNode` time-domain output on `#scopeCanvas`.
  * Clicking **`💾 Save Synth to Quick Tunes`** (`#btnSavePreset` / `#btnSaveInstQuickTune`) snapshots the selected Wavetable Instrument's current slider values and active 32-step pattern, adds a new entry to `#selPreset` **and** a matching custom synth tab (`⭐ ...`) in Panel 2 (`#instTabs`), persists to `localStorage`, and plays it immediately.

### 3.3 4-Row Keyboard (`Z–, & Q–I` + `1–0` / `A–L` Sharps, Minors & FX) with Glowing Violet Armed State
* **Violet Armed State (`#auditionSynthBox.armed` & `#btnArmAuditionSynth.armed`):** Displays a glowing **Violet hue (`#a855f7`)** when Armed so the user always knows keyboard and mouse play-in is active. Dropdowns and range sliders automatically blur on change so keyboard play-in is never blocked.
* **Full 4-Row Mapping & Key Labels:**
  * **`1–0 ♯/FX` Row:** Upper sharps/minors (`[2] C#5`, `[3] D#5m`, `[5] F#5`, `[6] G#5m`, `[7] A#5m`, `[9] C#6`, `[0] D#6m`) and 50 Hz Arp effects (`[1] FX:min`, `[4] FX:maj`, `[8] FX:hub`, `[-] FX:oct`, `[=] FX:luk`).
  * **`Q–I HI` Row:** Upper octave notes (`C-5` through `C-6`).
  * **`A–L ♯/m/FX` Row:** Lower sharps/minors (`[S] C#4`, `[D] D#4m`, `[G] F#4`, `[H] G#4m`, `[J] A#4m`, `[L] C#5fx`) and chord/SID effects (`[A] m-CRD`, `[F] FX:sus`, `[K] FX:pwr`, `[;] FX:dry`).
  * **`Z–, LO` Row:** Lower octave notes (`C-4` through `C-5`).
* **Live Overdub & Step Play-In (`playInSynthNote`):** Plays the selected Wavetable Synth at full clear volume on the Live SID Output and, when `Rec to Tracker` is checked, live-overdubs at `currentStep` during playback or advances `selectedStep` when paused.

### 3.4 `🟣 Set Synth on Active Voice` — Violet Armed Lock & Multi-Pattern Voice Targeting
* **Glowing Violet Armed UI (`#setSynthVoiceBox.armed`, `#btnAssignInstToVoice.armed`, `#thVoice0..3.voice-col-armed`):** Shows at a glance whether `Set Synth on Active Voice` is Armed and which voice (`V1 · LEAD`, `V2 · ARP`, `V3 · BASS`, `V4 · PERC`, or `ALL V1–V3`) is targeted.
* **All-Pattern & Live Priority Lock:** When Armed, `applyInstrumentToActiveQuickTune()` assigns the selected Wavetable Synth across **all patterns (`P00`–`P09+`)** and unmutes all Song Arranger blocks for that voice, while `triggerCurrentStep()` and `renderToWavBlob()` lock directly onto `channelState[ch].instId` so real-time slider tweaks and synth changes are heard immediately without ever dropping out across block transitions.

### 3.5 Timing Master / BPM Confluence, Expanded Matrices, Style-Driven Synth Basis & Direction Templates (`v2.4`)
* **Timing Master (`#selSongBpm` + `applyTimingConfluenceToAllSynths`):** Provides `Auto Style-Confluent BPM`, `Lock Current Transport BPM`, and 11 tempo presets (`68` to `192` BPM). Scales each Wavetable Synth's `attack`, `decay`, `sustain`, `release`, and high-tempo filter `cutoff` proportionally to `(128 / bpm)` while selecting tempo-matched lead, arp, bass, and drum step archetypes in `buildSectionPatternSteps()`.
* **Expanded `Length`, `Key`, `Scale`, and `Style` Variables:**
  * **11 Length targets** (`1:30` to `6:30` + `Random`), **17 Key options** (12 chromatic + 4 curated C64 key pools), **16 Scales + 3 Modal Pools** (`minor_pentatonic`, `aeolian`, `harmonic_minor`, `melodic_minor`, `dorian`, `phrygian`, `phrygian_dominant`, `lydian`, `mixolydian`, `major_arcade`, `major_pentatonic`, `blues_sid`, `hungarian_minor`, `hirajoshi`, `in_sen`, `whole_tone`), **12 Arp Modes** (`maj7`, `min7`, `dim`, `oct2`, etc.), and **12 Styles** (`camping_gas`, `hubbard`, `lukhash`, `galway`, `huelsbeck`, `darksynth`, `acid_303`, `arcade_coinop`, `vapor_chill`, `ambient`, `chipbreak`, `chaos`).
* **Style-Driven Wavetable Synth Basis (`#selSynthStyleBasis` in Panel 2):** `getStyleSynthProfile(style)` and `applyStyleBasisToSingleInstrument(inst, style, bpm)` reshape oscillator mixes, PWM, filter cutoff/resonance, wavefolder drive, tempo-confluent ADSR, and 50 Hz arpeggio tables both on one-click song generation and directly from the **`🎨 SYNTH STYLE BASIS`** dropdown (`#selSynthStyleBasis`) + `✨ Morph This Synth` + `🎛️ Morph All 12 Synths` in the Wavetable Synth Selector.
* **Direction Templates (`#selSongTemplate`):** `'Full Harmony'` (`full_harmony`), `'Melody Only'` (`melody_only`), `'Rythm Only'` (`rhythm_only`), `'Lead + Perc Duet'` (`lead_and_perc`), `'50Hz Arp + Bass Drive'` (`arp_bass_drive`), and `'Random Template'` (`random`), shifting pattern generation and Song Arranger voice masks (`applyTemplateVoiceMask`) toward LEAD, PERCUSSION, or full 4-voice Harmony.

---

## 4. Direct-DSP `.WAV`, `.MID`, `.JSON` Exports & Multi-Slot Browser Save States

* **Direct-DSP 44.1 kHz 16-Bit Stereo PCM `.WAV` Renderer (`renderToWavBlob`):** Synthesizes full 2–6 minute arranged songs or pattern loops directly in pure JavaScript (`Float32Array` → RIFF WAVE) with zero Web Audio node-count limits, paired with a persistent in-page `<audio controls>` preview player and download link.
* **Multi-Slot Browser Save States (`#browserSavesPanel`):** Click any saved state card in the list to restore that complete song state immediately, or export individual slots to `.JSON` / `.WAV`.

---

## 5. Attribution & License (`CC BY 4.0`)

```text
"FLAMABLE AI CAMPING GAS SID" (v2.4)
Created by River Lyle Reuveni (https://imortalimp.nl) & Arena.ai Agent (https://arena.ai).
Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
https://creativecommons.org/licenses/by/4.0/
```
