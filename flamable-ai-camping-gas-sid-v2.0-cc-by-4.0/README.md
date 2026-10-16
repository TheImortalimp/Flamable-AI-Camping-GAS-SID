# 🔥 FLAMABLE AI CAMPING GAS SID (v2.4) — Usage Guide & README

> **Authors & Attribution (`CC BY 4.0`):**  
> Created by **[River Lyle Reuveni (`imortalimp.nl`)](https://imortalimp.nl)** & **[Arena.ai Agent (`arena.ai`)](https://arena.ai)**  
> Licensed under **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**

---

## 1. Quick Start — Igniting Playback

1. **Press `🔥 IGNITE SONG` (or hit `Spacebar`):**
   * Starts real-time Web Audio MOS 6581/8580 wavetable playback.
   * The **Butane Flame Oscilloscope (`LIVE SID OUTPUT + WAVETABLE`)** renders both the single-cycle wavetable curve (violet when `Set Synth on Active Voice` is armed, cyan when disarmed) and the real-time master audio output waveform (orange/amber/cyan flame gradient) during both sequence playback and live note auditioning.
2. **Choose Playback Mode (`🎼 SONG MODE` vs `🔁 PATTERN LOOP`):**
   * **`🎼 SONG MODE` (Default):** Plays sequentially through every block in the **Programmable Song Arranger** (`#01` → `#N`), automatically switching patterns (`P00`–`P09+`), applying per-block semitone transpositions, and toggling active voices (`V1`–`V4`).
   * **`🔁 PATTERN LOOP`:** Loops only the currently selected 32-step pattern or active **Quick Tune** so you can jam, audition synths, or program notes in the 4-Voice Tracker.
3. **Adjust Tempo (`BPM`):**
   * Set any tempo from **`60` to `220` BPM**. The total song duration clock (`MM:SS / MM:SS`) updates automatically.

---

## 2. Live SID Output + Wavetable `Quick Tunes` & Instrument Panel Confluence (`v2.3`)

Located in **Panel 1 (`🔥 BUTANE FLAME OSCILLOSCOPE — LIVE SID OUTPUT + WAVETABLE`)** and linked in full two-way confluence with **Panel 2 (`🎛️ WAVETABLE SYNTH SELECTOR`)**:

1. **15 Built-In Quick Tunes + Unlimited Saved Synth Quick Tunes (`#selPreset`):**
   * Includes the **3 Classic Signature Quick Tunes** (*Butane Hubbard Overdrive*, *CyberChip Stove Igniter (`#lukhash`)*, *Midnight Tent Lantern*) **plus 12 Dedicated Wavetable Instrument Quick Tunes** (`🎛️ [01 · Square 50%] Quick Tune` through `🎛️ [12 · SID Noise+Sine Drum Matrix] Quick Tune` — one tailored 32-step 4-voice C64 sequence for every instrument in the Wavetable Synth Selector).
2. **Immediate Live Audio Playback & Panel Sync (`▶ Load & Play` / Dropdown Selection):**
   * Selecting any item in the **`Quick Tunes`** dropdown (`#selPreset`) or clicking **`▶ Load & Play`** (`#btnLoadPreset`) immediately:
     * Restores that Quick Tune's Wavetable Instrument patch (`instrumentSnapshot`) and highlights its tab + all 8 sliders in **Panel 2 (`🎛️ WAVETABLE SYNTH SELECTOR`)**,
     * Loads its 32-step 4-voice sequence into the active pattern and assigns the featured instrument to the active voice,
     * Switches to **`🔁 PATTERN LOOP`** mode so the Song Arranger never overwrites the Quick Tune mid-play, and
     * **Immediately starts playing the Quick Tune through the Live SID Output** while animating `#scopeCanvas`.
3. **Saving Selected Wavetable Instruments to `Quick Tunes` (`💾 Save Synth to Quick Tunes`):**
   * Click **`💾 Save Synth to Quick Tunes`** (`#btnSavePreset` in Panel 1 or `#btnSaveInstQuickTune` in Panel 2), optionally entering a custom name in `#inpQuickPresetName`.
   * Captures the **currently selected Wavetable Instrument** with all 8 current slider settings (`Square Mix`, `Triangle Mix`, `Sine Mix`, `Pulse Width PWM`, `6581 Cutoff`, `Camping Gas Drive`, `Envelope Decay`, `Default 50Hz Arp`) plus the active 32-step pattern, **creates a new entry in the `Quick Tunes` dropdown list (`#selPreset`) AND registers a matching custom synth tab (`⭐ ...`) in the `WAVETABLE SYNTH SELECTOR` panel (`#instTabs`)**, persists to `localStorage` (`FACG_SID_QUICK_TUNES_V23`), and plays it on the Live SID Output.
   * User-saved Quick Tunes can be removed at any time using the **`🗑`** button (`#btnDeletePreset`).

---

## 3. 4-Row Live Play-In & Audition Synth Keyboard (`Z–, & Q–I` + `1–0` / `A–L` Sharps, Minors & FX) with Violet Armed State (`v2.3`)

Located at the bottom of **Panel 1 (`#auditionSynthBox`)**:

* **Glowing Violet Armed Indicator (`🟣 AUDITION ARMED` `#btnArmAuditionSynth`):**
  * When **Armed** (default), the entire Audition Synth container (`#auditionSynthBox`), its **`🟣 AUDITION ARMED`** toggle button, and its key borders glow with a **vibrant Violet hue (`#a855f7` / `#9333ea`)** so you can see at a glance that keyboard & mouse play-in is live.
  * Clicking **`🟣 AUDITION ARMED`** toggles between Armed (Violet) and Disarmed (`⚪ AUDITION DISARMED`), and clicking any piano key automatically re-arms it.
  * Dropdowns (`<select>`) and sliders (`<input type="range">`) automatically release focus on change so keyboard playing is never blocked after tweaking controls.
* **All 4 Computer Keyboard Rows Labeled & Playable (Click, Pointer-Drag Glissando, or Press Keys):**
  * **Row 1 — `1–0 ♯/FX` (Number Row — Upper Sharps, Minors & 50Hz Arp Effects):**
    * `[1]` `FX:min` (Minor 50Hz Arp + High Root) · `[2]` `C#5` (Sharp) · `[3]` `D#5m` (Minor 3rd) · `[4]` `FX:maj` (Major 50Hz Arp) · `[5]` `F#5` (Sharp/Tritone) · `[6]` `G#5m` (Minor 6th) · `[7]` `A#5m` (Minor 7th) · `[8]` `FX:hub` (Rob Hubbard 50Hz Arp) · `[9]` `C#6` (High Sharp) · `[0]` `D#6m` (High Minor 3rd) · `[-]` `FX:oct` (Octave Jump Arp) · `[=]` `FX:luk` (`#lukhash` Cyber Arp).
  * **Row 2 — `Q–I HI` (Upper Octave Natural & Scale Notes):**
    * `[Q]` `C-5` · `[W]` `D-5` · `[E]` `E-5` · `[R]` `F-5` · `[T]` `G-5` · `[Y]` `A-5` · `[U]` `B-5` · `[I]` `C-6`.
  * **Row 3 — `A–L ♯/m/FX` (`A–L` Home Row — Lower Sharps, Minors & Chord/SID Effects):**
    * `[A]` `m-CRD` (Minor Chord 50Hz Arp + Root) · `[S]` `C#4` (Sharp) · `[D]` `D#4m` (Minor 3rd) · `[F]` `FX:sus` (Sus4 50Hz Arp) · `[G]` `F#4` (Sharp) · `[H]` `G#4m` (Minor 6th) · `[J]` `A#4m` (Minor 7th) · `[K]` `FX:pwr` (Power 5th Arp) · `[L]` `C#5fx` (Sharp `C#5` + `#lukhash` Arp) · `[;]` `FX:dry` (Clear 50Hz Arp to Pure Wavetable).
  * **Row 4 — `Z–, LO` (Bottom Octave Notes):**
    * `[Z]` `C-4` · `[X]` `D-4` · `[C]` `E-4` · `[V]` `F-4` · `[B]` `G-4` · `[N]` `A-4` · `[M]` `B-4` · `[,]` `C-5`.
* **Live Play-In / Overdub Recording (`☑ Rec to Tracker`) & Base Octave (`Oct: Auto / 2 / 3 / 4 / 5`):**
  * When **`☑ Rec to Tracker`** is checked, playing any key via mouse or keyboard plays the selected Wavetable Synth out loud on the Live SID Output **and** writes the note/arp into the active Tracker voice (live-overdubbing at `currentStep` while playing, or advancing `selectedStep` while paused). Uncheck `Rec to Tracker` to jam freely over any playing Quick Tune or Song without modifying tracker steps.

---

## 4. `🟣 Set Synth on Active Voice` — Violet Armed Lock & Multi-Pattern Voice Targeting (`v2.3`)

Located in **Panel 3 (`#setSynthVoiceBox`)** and synced with the **4-Voice Tracker Column Headers (`V1`–`V4`)**:

* **Glowing Violet Armed State (`#setSynthVoiceBox.armed` & `#btnAssignInstToVoice.armed`):**
  * Glows in **Violet** when Armed (`🟣 Set Synth on Active Voice (V1 · LEAD): ARMED`), with a matching **Violet column header** (`#thVoice0..3`) in the 4-Voice Tracker and a violet wavetable curve on `#scopeCanvas`.
* **Target Voice Selector Pills (`[V1 · LEAD]` `[V2 · ARP]` `[V3 · BASS]` `[V4 · PERC]` `[ALL V1–V3]`):**
  * Click any pill (or click any `V1`–`V4` header in the Tracker) to choose which voice (or **all 3 melodic voices `V1–V3` at once**) receives the selected Wavetable Synth.
* **Guaranteed Live Output & All-Pattern Assignment:**
  * When Armed, selecting any Wavetable Synth tab or dragging any of the 8 Wavetable Sliders in Panel 2 updates `channelState[ch].instId` and locks live playback (`triggerCurrentStep()`) and `.WAV` rendering (`renderToWavBlob()`) onto that synth across **all patterns (`P00`–`P09+`)** and the active Quick Tune, unmuting the target voice across all Song Arranger blocks so your synth assignment never drops out when the song advances blocks.
  * Click **`⚡ Stamp & Audition`** (`#btnApplySynthOnce`) at any time to stamp and audition the selected synth on the target voice immediately.

---

## 5. One-Click 2–6 Minute Full Varied Song Generator, Timing Master, Style Basis & Direction Templates (`v2.4`)

1. **⏱️ Timing Master / BPM Confluence Dropdown (`#selSongBpm`):**
   * Controls tempo and envelope/pattern confluence across every generated sound and sequence:
     * **`🎲 Auto Style-Confluent BPM`** (picks an authentic tempo range matched to the chosen Style),
     * **11 Curated Tempo Presets:** `68 BPM · Slow Vapor / Cryo`, `82 BPM · Halftime Dub / Chill`, `96 BPM · Lo-Fi Boom-Bap SID`, `108 BPM · Mid-Tempo Darksynth`, `120 BPM · PAL 50Hz Standard`, `128 BPM · Electro Club Groove`, `136 BPM · Demoscene Cracktro`, `148 BPM · High-Octane Arcade`, `162 BPM · Tracker Jungle / Break`, `176 BPM · Speedcore / Turbo Tape`, `192 BPM · NMI Overclock Staccato`, or **`🔒 Lock Current Transport BPM`**.
   * **Sound & Sequence Timing Confluence:** Changing the Timing Master (or transport BPM) automatically scales each Wavetable Synth's `attack`, `decay`, `sustain`, `release`, and high-tempo filter `cutoff` (`applyTimingConfluenceToAllSynths()`) AND selects tempo-confluent rhythmic step archetypes (`dotted_anthem` / `halftime_stomp` at slower tempos vs `cyber_16th_run` / `rolling_16th` / `demoscene_speed` at faster tempos) so notes never smear at 176+ BPM or cut off prematurely at 68–82 BPM.
2. **Expanded `Length`, `Key`, `Scale`, and `Style` Matrices:**
   * **`Length` (`#selSongDuration` — 11 Options):** `🎲 Random (2:15–5:55)`, `1:30 (Cracktro Loop)`, `2:05 (Compact Chip)`, `2:40 (Title Screen Theme)`, `3:15 (Full C64 Song)`, `3:45 (Dual-Drop Cyber)`, `4:15 (Extended Mix)`, `4:50 (Prog SID Suite)`, `5:15 (Demoscene Epic)`, `5:55 (Hubbard Odyssey)`, and `6:30 (Marathon Longplay)`.
   * **`Key` (`#selRoot` — 17 Options):** `🎲 Random Key`, **4 Curated Key Pools** (`🌑 Dark C64 Pool (C/D#/F/G#)`, `🕹️ Bright Arcade (D/E/G/A)`, `🔊 Deep Sub-Bass (E/F/F#/G)`, `🎹 Sharp Pentatonic (C#/D#/F#/G#/A#)`), plus all 12 chromatic keys with C64 character labels (`C · Classic C64 Home` through `B · High Voltage`).
   * **`Scale` (`#selScale` — 16 Scales + 3 Modal Pools):** `🎲 Random Scale (16 Modes)`, **3 Modal Pools** (`🌑 Dark Minor Pool`, `⚡ Cyber Modal Pool`, `🕌 Exotic Boss Pool`), plus **16 Scales**: *C64 Minor Pentatonic*, *Natural Minor (Aeolian)*, *Harmonic Minor (Hubbard)*, *Melodic Minor (Demoscene)*, *Dorian CyberChip (`#lukhash`)*, *Phrygian Demoscene*, *Phrygian Dominant (Hijaz Boss)*, *Lydian Dreamchip (Sci-Fi +4#)*, *Mixolydian Action Funk*, *Coin-Op Major Arcade (Ionian)*, *Bright 8-Bit Major Pentatonic*, *SID Hex-Blues*, *Hungarian Gypsy Minor (Boss)*, *Hirajoshi Cyber-Ninja (5-Note)*, *In-Sen Dark Shrine (Japanese)*, and *Whole-Tone Warp Tunnel*.
   * **`Style` (`#selStyle` — 12 Styles):** `🔥 Camping Gas Burner`, `🕹️ Rob Hubbard 50Hz C64`, `⚡ #lukhash CyberChip`, `🌊 Martin Galway Sweep & Whistle`, `🛡️ Chris Huelsbeck Turrican Brass`, `🧛 Darksynth Horror SID`, `🧪 6581 Acid Squelch`, `👾 1985 Coin-Op Arcade`, `🌆 Vaporwave / Lo-Fi CRT`, `🏕️ Midnight Tent Ambient`, `🥁 Tracker Jungle / Chipbreak`, and `💥 Overpressure Chaos`.
3. **🎨 Wavetable Synth Style Basis Selector (`#selSynthStyleBasis` in Panel 2):**
   * Located at the top of **Panel 2 (`🎛️ WAVETABLE SYNTH SELECTOR`)** and synced bi-directionally with `#selStyle`:
     * Selecting any of the **12 Styles** in `#selSynthStyleBasis` (or clicking **`🎛️ Morph All 12 Synths`**) immediately reshapes all 12 Wavetable Synths' oscillator mixes (`Square`/`Triangle`/`Sine`), `Pulse Width PWM`, `6581 Cutoff`, `Resonance`, `Camping Gas Drive`, tempo-confluent ADSR envelopes, and `50Hz Arp` tables (`maj7`, `min7`, `dim`, `oct2`, `hubbard`, `lukhash`, etc.) to that Style's synthesis profile, updates the active voice assignments across all patterns, and auditions the result.
     * Clicking **`✨ Morph This Synth`** (`#btnMorphSelectedSynth`) reshapes **only** the currently selected Wavetable Synth tab using the chosen Style Basis and Timing Master BPM.
4. **🎯 Direction Templates Dropdown (`#selSongTemplate`):**
   * Directs both pattern step generation (`buildSectionPatternSteps`) and Song Arranger voice masks (`applyTemplateVoiceMask`):
     * **`🎼 Full Harmony (All Voices)` (`full_harmony`):** Full 4-voice C64 arrangement balancing V1 Lead, V2 50Hz Arp/Chords, V3 Sub Bass, and V4 SID Percussion.
     * **`🎹 Melody Only (Lead & Harmony Focus)` (`melody_only`):** Shifts pattern generation toward expressive V1 Lead hooks, V2 50Hz counter-harmonies/arpeggios, and melodic V3 walking/triad bass while muting V4 Percussion across patterns and arranger blocks.
     * **`🥁 Rythm Only (Percussion & Bass Groove)` (`rhythm_only`):** Shifts pattern generation toward high-density V4 SID Drum/Noise grooves, punchy V3 slap/gallop Sub Bass, and syncopated V2 rhythmic chord stabs while muting V1 Lead.
     * Plus **`⚡ Lead + Perc Duet` (`lead_and_perc`)**, **`🌀 50Hz Arp + Bass Drive` (`arp_bass_drive`)**, and **`🎲 Random Template` (`random`)**.
5. **Song Arranger Timeline:**
   * Click any block card to cue and edit its pattern; use per-block dropdowns to change pattern (`P00`–`P09+`), transpose (`-12st` to `+12st`), or toggle active voices (`V1`–`V4`).

---

## 6. Browser Saved States List & Exporting / Loading Files (`.WAV`, `.MID`, `.JSON`)

* **📌 Browser Saved States (`#browserSavesPanel`):**
  * Click any saved state card in the list to immediately restore that entire song (all patterns, arrangement, custom wavetable synths, Quick Tunes, BPM, and voice states).
  * Use **`📌 + Save Current State to List`** to snapshot your current song, or use the per-card **`📄 .JSON`** and **`🔊 .WAV`** buttons.
* **💾 Direct-DSP 44.1 kHz Stereo `.WAV`, `.MID`, and `.JSON` Exports:**
  * **`🔊 Export Full Song (.WAV)`** & **`🔁 Export Pattern (.WAV)`:** Pure-JS Direct-DSP 44.1 kHz 16-bit Stereo PCM renderer with an inline `<audio controls>` preview player and persistent download link.
  * **`🎹 Export Full Song (.MID)`:** Exports a 4-track Standard MIDI File (`.MID`).
  * **`📄 Export Song (.JSON)` & `📂 Load Song (.JSON)`:** Exports and imports complete project JSON (via file picker, drag-and-drop, or the **`📋 Copy / Paste JSON Text`** inspector drawer).

---

## 7. Uploading to `imortalimp.nl`

1. Unzip **`flamable-ai-camping-gas-sid-v2.0-cc-by-4.0.zip`** and upload its 7 files (`flamable-ai-camping-gas-sid.html`, `flamable-ai-camping-gas-sid.js`, `flamable-ai-camping-gas-sid.json`, `flamable-ai-camping-gas-sid-source.html`, `README.md`, `DESCRIPTION.md`, `LICENSE-CC-BY-4.0.txt`) to `imortalimp.nl` (both at root `/` and inside `/flamable-ai-camping-gas-sid-v2.0-cc-by-4.0/`).
2. On **`index.html`** (`home.html`), the **`#facg-sid-home-showcase`** Info & Documentation Navigation Panel links directly to the standalone SID Studio (`flamable-ai-camping-gas-sid.html`), Source Code Browser (`flamable-ai-camping-gas-sid-source.html`), `README.md`, `DESCRIPTION.md`, `LICENSE-CC-BY-4.0.txt`, and `flamable-ai-camping-gas-sid-v2.0-cc-by-4.0.zip`.
