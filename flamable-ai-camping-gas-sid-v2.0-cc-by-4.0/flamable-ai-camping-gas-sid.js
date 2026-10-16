/**
 * ============================================================================
 *  FLAMABLE AI CAMPING GAS SID v2.2
 *  Web Audio Wavetable SID Synth, 4-Voice Tracker, Song Arranger,
 *  One-Click 2–6 Minute Procedural Song Generator, Multi-Slot Browser State
 *  Manager & Direct-DSP .WAV / .MID / .JSON Exporter
 *
 *  Authors & Attribution (CC BY 4.0):
 *    Created by River Lyle Reuveni (https://imortalimp.nl)
 *    & Arena.ai Agent (https://arena.ai)
 *  License:
 *    Creative Commons Attribution 4.0 International (CC BY 4.0)
 *    https://creativecommons.org/licenses/by/4.0/
 *
 *  File: flamable-ai-camping-gas-sid.js
 *  Companion Data: flamable-ai-camping-gas-sid.json
 * ============================================================================
 */
(function () {
  "use strict";

  const NOTE_NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
  const NOTE_TO_SEMI = {
    "C-": 0, "C#": 1, "D-": 2, "D#": 3, "E-": 4, "F-": 5,
    "F#": 6, "G-": 7, "G#": 8, "A-": 9, "A#": 10, "B-": 11
  };

  const STORAGE_KEY_SLOTS = "FACG_SID_SAVE_SLOTS_V22";
  const STORAGE_KEY_QUICK_TUNES = "FACG_SID_QUICK_TUNES_V23";

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randFloat(min, max, decimals = 2) {
    const val = min + Math.random() * (max - min);
    return Number(val.toFixed(decimals));
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function noteToMidi(noteStr) {
    if (!noteStr || typeof noteStr !== "string" || noteStr === "---" || noteStr === "===") return null;
    const clean = noteStr.trim().toUpperCase();
    let prefix = clean.slice(0, 2);
    let octStr = clean.slice(2);
    if ( prefix.length === 2 && prefix[1] !== "#" && prefix[1] !== "-" ) {
      prefix = clean[0] + "-";
      octStr = clean.slice(1);
    }
    const oct = parseInt(octStr, 10);
    if (!(prefix in NOTE_TO_SEMI) || isNaN(oct)) return null;
    return (oct + 1) * 12 + NOTE_TO_SEMI[prefix];
  }

  function midiToNote(midi) {
    const clamped = Math.max(24, Math.min(96, Math.round(midi)));
    const semi = ((clamped % 12) + 12) % 12;
    const oct = Math.floor(clamped / 12) - 1;
    return NOTE_NAMES[semi] + oct;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function formatDuration(sec) {
    const total = Math.max(0, Math.round(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /**
   * Build single-cycle wavetable (256 samples) + Fourier coefficients from
   * Square (PWM), Triangle, and Sine mixes + Gas Drive wavefolder.
   */
  function buildWavetableData(inst) {
    const N = 256;
    const samples = new Float32Array(N);
    const sqMix = Number(inst.squareMix ?? 0.5);
    const triMix = Number(inst.triangleMix ?? 0.0);
    const sinMix = Number(inst.sineMix ?? 0.0);
    const pw = Math.max(0.05, Math.min(0.95, Number(inst.pulseWidth ?? 0.5)));
    const drive = Math.max(0, Math.min(1, Number(inst.drive ?? 0.15)));

    let maxAmp = 0.0001;
    for (let i = 0; i < N; i++) {
      const phase = i / N;
      const sq = phase < pw ? 1.0 : -1.0;
      const tri = phase < 0.5 ? (4.0 * phase - 1.0) : (3.0 - 4.0 * phase);
      const sin = Math.sin(2 * Math.PI * phase + drive * 1.4 * Math.sin(4 * Math.PI * phase));

      let val = sq * sqMix + tri * triMix + sin * sinMix;
      if (drive > 0.01) {
        const gain = 1.0 + drive * 2.6;
        val = val * gain;
        if (val > 1.0) val = 2.0 - val;
        if (val < -1.0) val = -2.0 - val;
        val = Math.tanh(val * (1.0 + drive * 1.5));
      }
      val = Math.round(val * 128) / 128;
      samples[i] = val;
      if (Math.abs(val) > maxAmp) maxAmp = Math.abs(val);
    }

    for (let i = 0; i < N; i++) {
      samples[i] /= maxAmp;
    }

    const harmonics = 48;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) {
      let a = 0;
      let b = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        a += samples[n] * Math.cos(angle);
        b += samples[n] * Math.sin(angle);
      }
      real[k] = (2 * a) / N;
      imag[k] = (-2 * b) / N;
    }

    return { samples, real, imag };
  }

  function makeDistortionCurve(driveAmount) {
    const n = 512;
    const curve = new Float32Array(n);
    const k = Math.max(0.1, driveAmount * 28);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  const CHORD_PROGRESSIONS = {
    INTRO: [
      [0, 0, 5, 4], [0, 5, 3, 4], [0, 6, 5, 6],
      [0, 2, 5, 6], [5, 3, 0, 4], [0, 3, 0, 6]
    ],
    VERSE: [
      [0, 5, 3, 4], [0, 6, 5, 4], [0, 2, 5, 4], [0, 3, 6, 4],
      [0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 2, 6], [0, 1, 5, 4]
    ],
    BUILD: [
      [3, 4, 5, 6], [2, 3, 4, 4], [5, 3, 4, 4],
      [3, 5, 6, 4], [1, 3, 4, 6]
    ],
    CHORUS: [
      [0, 5, 2, 4], [0, 3, 5, 4], [5, 6, 0, 4], [0, 6, 3, 4],
      [3, 0, 5, 4], [0, 4, 5, 6], [0, 2, 3, 4]
    ],
    BREAK: [
      [5, 3, 0, 4], [3, 5, 0, 6], [0, 5, 3, 2], [5, 2, 3, 4]
    ],
    SOLO: [
      [0, 6, 5, 4], [0, 5, 3, 4], [0, 3, 4, 6],
      [5, 6, 4, 0], [0, 2, 6, 4]
    ],
    OUTRO: [
      [0, 5, 4, 0], [3, 4, 0, 0], [5, 4, 0, 0], [0, 6, 5, 0]
    ]
  };

  class FlamableCampingGasSID {
    constructor(configData) {
      this.baseConfig = JSON.parse(JSON.stringify(configData));
      this.data = JSON.parse(JSON.stringify(configData));
      this.ctx = null;
      this.masterGain = null;
      this.analyser = null;
      this.noiseBuffer = null;

      this.isPlaying = false;
      this.playMode = "song";
      this.bpm = this.data.defaultBpm || 132;
      this.stepCount = this.data.defaultStepCount || 32;
      this.currentStep = 0;
      this.activeArrangeIndex = 0;
      this.activePatternIndex = 0;
      this.stepTimer = null;

      this.selectedChannel = 0;
      this.selectedStep = 0;
      this.selectedInstrumentId = this.data.wavetableInstruments[0].id;
      this.autoStep = true;
      this.octave = 4;

      this.lastSongMeta = {
        root: "C-",
        scale: "harmonic_minor",
        style: "camping_gas",
        bpm: 132,
        timingMaster: "random",
        template: "full_harmony",
        architecture: "Demoscene Ignition Odyssey"
      };

      this.setSynthOnVoiceArmed = true;
      this.activeVoiceTargetMode = "single"; // "single" (selectedChannel) or "all_melodic" (V1-V3)
      this.channelState = [
        { name: "VOICE 1 · LEAD", muted: false, solo: false, volume: 0.85, instId: "sq_pwm_hubbard", vu: 0, synthArmed: true },
        { name: "VOICE 2 · 50Hz ARP", muted: false, solo: false, volume: 0.78, instId: "sq_arp_chord", vu: 0, synthArmed: false },
        { name: "VOICE 3 · SUB BASS", muted: false, solo: false, volume: 0.90, instId: "sq_sub_bass", vu: 0, synthArmed: false },
        { name: "VOICE 4 · SID PERC", muted: false, solo: false, volume: 0.85, instId: "perc_sid_noise", vu: 0, synthArmed: false }
      ];

      this.factoryInstruments = JSON.parse(JSON.stringify(this.baseConfig.wavetableInstruments));
      this.patterns = [];
      this.arrangement = [];
      this.memorySaveSlots = [];
      this.customQuickTunes = [];
      this.activeQuickTuneIndex = 0;

      // Initialize Quick Tunes + Wavetable Instrument Panel Confluence (15 built-in + user-saved)
      this.initQuickTunesAndConfluence();

      // Boot with an initial generated song
      this.generateFullVariedSong({
        targetMinutes: 3.25,
        root: "C-",
        scale: "harmonic_minor",
        style: "camping_gas",
        density: 0.68,
        randomizeMusicality: false,
        randomizeSynths: true
      });

      this.initBrowserSaveSlots();
    }

    get pattern() {
      if (!this.patterns || !this.patterns.length) {
        this.patterns = [{ id: "P00", name: "P00 · MAIN", sectionType: "VERSE", steps: [[], [], [], []] }];
      }
      const idx = Math.max(0, Math.min(this.patterns.length - 1, this.activePatternIndex || 0));
      return this.patterns[idx].steps;
    }

    set pattern(newSteps) {
      if (this.patterns[this.activePatternIndex]) {
        this.patterns[this.activePatternIndex].steps = newSteps;
      }
    }

    ensureAudioContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.78;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.78;

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        const sr = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
        const out = this.noiseBuffer.getChannelData(0);
        let lfsr = 0x7ffff8;
        for (let i = 0; i < out.length; i++) {
          if (i % 4 === 0) {
            const bit = ((lfsr >> 22) ^ (lfsr >> 17)) & 1;
            lfsr = ((lfsr << 1) | bit) & 0x7fffff;
          }
          out[i] = ((lfsr & 0xff) / 127.5) - 1.0;
        }
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    getInstrument(instId) {
      return (
        this.data.wavetableInstruments.find((i) => i.id === instId) ||
        this.data.wavetableInstruments[0]
      );
    }

    stepDurationSec() {
      return 60 / Math.max(40, this.bpm || 132) / 4;
    }

    patternDurationSec() {
      return this.stepCount * this.stepDurationSec();
    }

    totalSongDurationSec() {
      return Math.max(1, this.arrangement.length) * this.patternDurationSec();
    }

    currentSongElapsedSec() {
      if (this.playMode === "pattern") {
        return this.currentStep * this.stepDurationSec();
      }
      return (this.activeArrangeIndex * this.stepCount + this.currentStep) * this.stepDurationSec();
    }

    isChannelAudible(chIdx, voiceMask) {
      if (Array.isArray(voiceMask) && voiceMask[chIdx] === false) return false;
      const anySolo = this.channelState.some((c) => c.solo);
      if (anySolo) return this.channelState[chIdx].solo;
      return !this.channelState[chIdx].muted;
    }

    /**
     * Randomize the wavetable synth parameters across all 11 melodic instruments
     */
    getStyleSynthProfile(style = "camping_gas") {
      const profiles = {
        camping_gas: {
          label: "🔥 Camping Gas Burner",
          sqBias: [0.70, 1.0], triBias: [0.15, 0.55], sinBias: [0.10, 0.45],
          pwRange: [0.18, 0.78], cutoffLead: [2400, 6800], cutoffBass: [700, 2200],
          resRange: [2.2, 6.8], driveRange: [0.22, 0.58],
          atkRange: [0.003, 0.014], decRange: [0.14, 0.36], susRange: [0.42, 0.78], relRange: [0.08, 0.24],
          vibRange: [0.08, 0.35], arpProb: 0.42,
          arpPref: ["hubbard", "min", "pwr", "oct"],
          leadPool: ["sq_pwm_hubbard", "sq_classic", "tri_folded", "tri_shark"],
          arpPool: ["sq_arp_chord", "tri_folded", "sq_pwm_hubbard", "sin_fm_bell"],
          bassPool: ["sq_sub_bass", "sin_cyberchip", "tri_shark"]
        },
        hubbard: {
          label: "🕹️ Rob Hubbard 50Hz C64",
          sqBias: [0.80, 1.0], triBias: [0.10, 0.40], sinBias: [0.0, 0.25],
          pwRange: [0.12, 0.42], cutoffLead: [2800, 7600], cutoffBass: [800, 2400],
          resRange: [2.8, 7.5], driveRange: [0.18, 0.45],
          atkRange: [0.002, 0.010], decRange: [0.12, 0.32], susRange: [0.45, 0.82], relRange: [0.07, 0.22],
          vibRange: [0.18, 0.46], arpProb: 0.65,
          arpPref: ["hubbard", "min", "maj", "oct", "oct2"],
          leadPool: ["sq_pwm_hubbard", "sq_classic", "tri_ringmod"],
          arpPool: ["sq_arp_chord", "sq_pwm_hubbard", "tri_ringmod"],
          bassPool: ["sq_sub_bass", "tri_pure", "sq_classic"]
        },
        lukhash: {
          label: "⚡ #lukhash CyberChip",
          sqBias: [0.75, 1.0], triBias: [0.25, 0.70], sinBias: [0.20, 0.65],
          pwRange: [0.15, 0.85], cutoffLead: [3200, 8800], cutoffBass: [900, 2900],
          resRange: [3.5, 9.2], driveRange: [0.32, 0.74],
          atkRange: [0.002, 0.008], decRange: [0.09, 0.28], susRange: [0.38, 0.76], relRange: [0.05, 0.18],
          vibRange: [0.05, 0.32], arpProb: 0.55,
          arpPref: ["lukhash", "pwr", "oct2", "min7"],
          leadPool: ["tri_shark", "sq_pwm_hubbard", "sin_cyberchip", "tri_folded"],
          arpPool: ["sq_arp_chord", "sin_fm_bell", "tri_folded"],
          bassPool: ["sin_cyberchip", "sq_sub_bass", "tri_shark"]
        },
        galway: {
          label: "🌊 Martin Galway Sweep & Whistle",
          sqBias: [0.25, 0.72], triBias: [0.65, 1.0], sinBias: [0.45, 0.90],
          pwRange: [0.32, 0.68], cutoffLead: [1600, 5200], cutoffBass: [600, 1900],
          resRange: [3.0, 8.2], driveRange: [0.08, 0.32],
          atkRange: [0.005, 0.025], decRange: [0.18, 0.45], susRange: [0.52, 0.86], relRange: [0.12, 0.32],
          vibRange: [0.22, 0.48], arpProb: 0.38,
          arpPref: ["min", "maj", "sus4", "hubbard"],
          leadPool: ["tri_pure", "tri_folded", "sin_pure", "sq_pwm_hubbard"],
          arpPool: ["tri_ringmod", "sin_fm_bell", "sq_arp_chord"],
          bassPool: ["tri_pure", "sin_pure", "sq_sub_bass"]
        },
        huelsbeck: {
          label: "🛡️ Chris Huelsbeck Turrican Brass",
          sqBias: [0.82, 1.0], triBias: [0.30, 0.68], sinBias: [0.10, 0.40],
          pwRange: [0.22, 0.58], cutoffLead: [2600, 7400], cutoffBass: [750, 2500],
          resRange: [2.4, 6.4], driveRange: [0.24, 0.54],
          atkRange: [0.003, 0.015], decRange: [0.15, 0.38], susRange: [0.50, 0.85], relRange: [0.09, 0.25],
          vibRange: [0.12, 0.36], arpProb: 0.48,
          arpPref: ["pwr", "maj", "min", "oct"],
          leadPool: ["sq_classic", "sq_pwm_hubbard", "tri_shark"],
          arpPool: ["sq_arp_chord", "sq_classic", "tri_folded"],
          bassPool: ["sq_sub_bass", "tri_shark", "sin_cyberchip"]
        },
        darksynth: {
          label: "🧛 Darksynth Horror SID",
          sqBias: [0.70, 1.0], triBias: [0.40, 0.85], sinBias: [0.15, 0.55],
          pwRange: [0.14, 0.64], cutoffLead: [1500, 5600], cutoffBass: [520, 1850],
          resRange: [3.8, 9.8], driveRange: [0.38, 0.82],
          atkRange: [0.003, 0.018], decRange: [0.14, 0.40], susRange: [0.40, 0.80], relRange: [0.08, 0.26],
          vibRange: [0.10, 0.40], arpProb: 0.40,
          arpPref: ["dim", "min", "pwr", "oct"],
          leadPool: ["tri_shark", "tri_folded", "sq_pwm_hubbard", "tri_ringmod"],
          arpPool: ["tri_folded", "sq_arp_chord", "tri_ringmod"],
          bassPool: ["sq_sub_bass", "sin_cyberchip", "tri_shark"]
        },
        acid_303: {
          label: "🧪 6581 Acid Squelch",
          sqBias: [0.78, 1.0], triBias: [0.35, 0.78], sinBias: [0.0, 0.30],
          pwRange: [0.10, 0.48], cutoffLead: [1100, 6400], cutoffBass: [480, 2400],
          resRange: [6.5, 12.0], driveRange: [0.34, 0.78],
          atkRange: [0.002, 0.007], decRange: [0.07, 0.22], susRange: [0.22, 0.55], relRange: [0.04, 0.14],
          vibRange: [0.04, 0.24], arpProb: 0.45,
          arpPref: ["oct", "oct2", "min7", "lukhash"],
          leadPool: ["sq_pwm_hubbard", "tri_shark", "tri_folded"],
          arpPool: ["sq_arp_chord", "tri_shark", "sq_pwm_hubbard"],
          bassPool: ["sq_sub_bass", "tri_shark", "sin_cyberchip"]
        },
        arcade_coinop: {
          label: "👾 1985 Coin-Op Arcade",
          sqBias: [0.85, 1.0], triBias: [0.05, 0.45], sinBias: [0.05, 0.35],
          pwRange: [0.42, 0.58], cutoffLead: [3400, 8600], cutoffBass: [950, 2800],
          resRange: [1.5, 4.5], driveRange: [0.08, 0.30],
          atkRange: [0.002, 0.006], decRange: [0.08, 0.24], susRange: [0.35, 0.72], relRange: [0.04, 0.15],
          vibRange: [0.05, 0.25], arpProb: 0.52,
          arpPref: ["maj", "min", "oct", "hubbard"],
          leadPool: ["sq_classic", "sq_pwm_hubbard", "sin_fm_bell"],
          arpPool: ["sq_arp_chord", "sq_classic", "sin_fm_bell"],
          bassPool: ["tri_pure", "sq_sub_bass", "sin_pure"]
        },
        vapor_chill: {
          label: "🌆 Vaporwave / Lo-Fi CRT",
          sqBias: [0.15, 0.55], triBias: [0.55, 0.95], sinBias: [0.60, 1.0],
          pwRange: [0.35, 0.65], cutoffLead: [1100, 3800], cutoffBass: [480, 1500],
          resRange: [1.4, 4.2], driveRange: [0.05, 0.24],
          atkRange: [0.008, 0.036], decRange: [0.22, 0.52], susRange: [0.50, 0.86], relRange: [0.16, 0.38],
          vibRange: [0.18, 0.45], arpProb: 0.35,
          arpPref: ["maj7", "min7", "sus4", "min"],
          leadPool: ["sin_fm_bell", "tri_pure", "sin_pure", "tri_folded"],
          arpPool: ["sin_fm_bell", "tri_pure", "sq_arp_chord"],
          bassPool: ["sin_pure", "tri_pure", "sq_sub_bass"]
        },
        ambient: {
          label: "🏕️ Midnight Tent Ambient",
          sqBias: [0.10, 0.48], triBias: [0.58, 1.0], sinBias: [0.65, 1.0],
          pwRange: [0.30, 0.70], cutoffLead: [900, 3600], cutoffBass: [420, 1400],
          resRange: [1.2, 4.6], driveRange: [0.03, 0.22],
          atkRange: [0.012, 0.055], decRange: [0.26, 0.64], susRange: [0.55, 0.88], relRange: [0.20, 0.48],
          vibRange: [0.14, 0.42], arpProb: 0.32,
          arpPref: ["sus4", "maj7", "min7", "min"],
          leadPool: ["sin_pure", "tri_pure", "sin_fm_bell", "tri_ringmod"],
          arpPool: ["sin_fm_bell", "tri_ringmod", "tri_pure"],
          bassPool: ["sin_pure", "tri_pure", "sq_sub_bass"]
        },
        chipbreak: {
          label: "🥁 Tracker Jungle / Chipbreak",
          sqBias: [0.72, 1.0], triBias: [0.30, 0.75], sinBias: [0.25, 0.72],
          pwRange: [0.14, 0.82], cutoffLead: [2800, 8400], cutoffBass: [680, 2600],
          resRange: [3.2, 8.8], driveRange: [0.28, 0.68],
          atkRange: [0.002, 0.007], decRange: [0.06, 0.20], susRange: [0.28, 0.68], relRange: [0.04, 0.14],
          vibRange: [0.06, 0.30], arpProb: 0.48,
          arpPref: ["lukhash", "oct2", "pwr", "min7"],
          leadPool: ["sq_pwm_hubbard", "tri_shark", "sin_cyberchip"],
          arpPool: ["sq_arp_chord", "tri_folded", "sin_fm_bell"],
          bassPool: ["sin_cyberchip", "sq_sub_bass", "tri_shark"]
        },
        chaos: {
          label: "💥 Overpressure Chaos",
          sqBias: [0.60, 1.0], triBias: [0.40, 1.0], sinBias: [0.35, 0.95],
          pwRange: [0.08, 0.90], cutoffLead: [1600, 9800], cutoffBass: [700, 3800],
          resRange: [4.2, 12.0], driveRange: [0.42, 0.92],
          atkRange: [0.002, 0.010], decRange: [0.07, 0.32], susRange: [0.30, 0.78], relRange: [0.04, 0.20],
          vibRange: [0.15, 0.50], arpProb: 0.62,
          arpPref: ["lukhash", "dim", "oct2", "hubbard", "pwr"],
          leadPool: ["tri_ringmod", "tri_folded", "sin_fm_bell", "tri_shark"],
          arpPool: ["tri_ringmod", "sq_arp_chord", "sin_fm_bell"],
          bassPool: ["sin_cyberchip", "tri_shark", "sq_sub_bass"]
        }
      };
      return profiles[style] || profiles.camping_gas;
    }

    /**
     * Scales synth envelope & modulation parameters so every sound's gate/decay/release
     * has natural musical confluence with the song's Master BPM (16th-note step = 15 / bpm).
     */
    applyTimingConfluenceToInstrument(inst, bpm = this.bpm) {
      if (!inst || inst.id === "perc_sid_noise") return;
      const safeBpm = Math.max(60, Math.min(220, Number(bpm) || 128));
      const tempoRatio = Math.max(0.62, Math.min(1.55, 128 / safeBpm));
      inst.attack = Number(Math.max(0.002, Math.min(0.08, (inst.attack || 0.006) * Math.pow(tempoRatio, 0.65))).toFixed(3));
      inst.decay = Number(Math.max(0.04, Math.min(0.88, (inst.decay || 0.20) * tempoRatio)).toFixed(2));
      inst.release = Number(Math.max(0.03, Math.min(0.60, (inst.release || 0.14) * tempoRatio)).toFixed(2));
      if (safeBpm >= 152) {
        inst.cutoff = Math.min(10500, Math.round((inst.cutoff || 3200) * 1.12));
      } else if (safeBpm <= 92) {
        inst.sustain = Number(Math.min(0.90, Math.max(0.42, (inst.sustain || 0.55) * 1.12)).toFixed(2));
      }
    }

    applyTimingConfluenceToAllSynths(bpm = this.bpm) {
      this.data.wavetableInstruments.forEach((inst) => {
        this.applyTimingConfluenceToInstrument(inst, bpm);
      });
    }

    applyStyleBasisToSingleInstrument(inst, style = "camping_gas", bpm = this.bpm) {
      if (!inst || inst.id === "perc_sid_noise") return;
      const prof = this.getStyleSynthProfile(style);
      const arpKeys = Object.keys(this.data.arpModes).filter((k) => k !== "none");
      const validPrefArps = (prof.arpPref || []).filter((k) => arpKeys.includes(k));
      const arpChoices = validPrefArps.length ? validPrefArps : arpKeys;

      if (inst.family === "square") {
        inst.squareMix = randFloat(prof.sqBias[0], prof.sqBias[1]);
        inst.triangleMix = randFloat(0.0, Math.min(0.55, prof.triBias[1] * 0.65));
        inst.sineMix = randFloat(0.0, Math.min(0.45, prof.sinBias[1] * 0.55));
      } else if (inst.family === "triangle") {
        inst.squareMix = randFloat(0.0, Math.min(0.50, prof.sqBias[1] * 0.52));
        inst.triangleMix = randFloat(Math.max(0.62, prof.triBias[0]), 1.0);
        inst.sineMix = randFloat(prof.sinBias[0] * 0.5, prof.sinBias[1]);
      } else {
        inst.squareMix = randFloat(0.05, Math.min(0.55, prof.sqBias[1] * 0.55));
        inst.triangleMix = randFloat(prof.triBias[0] * 0.4, prof.triBias[1] * 0.85);
        inst.sineMix = randFloat(Math.max(0.62, prof.sinBias[0]), 1.0);
      }

      inst.pulseWidth = randFloat(prof.pwRange[0], prof.pwRange[1]);
      const isBass = inst.id.includes("sub") || inst.id.includes("bass");
      inst.cutoff = isBass
        ? randInt(prof.cutoffBass[0], prof.cutoffBass[1])
        : randInt(prof.cutoffLead[0], prof.cutoffLead[1]);
      inst.resonance = randFloat(prof.resRange[0], prof.resRange[1], 1);
      inst.drive = randFloat(prof.driveRange[0], prof.driveRange[1]);
      inst.attack = randFloat(prof.atkRange[0], prof.atkRange[1], 3);
      inst.decay = randFloat(prof.decRange[0], prof.decRange[1]);
      inst.sustain = randFloat(prof.susRange[0], prof.susRange[1]);
      inst.release = randFloat(prof.relRange[0], prof.relRange[1]);
      inst.vibratoDepth = randFloat(prof.vibRange[0], prof.vibRange[1]);

      if (inst.id.includes("arp") || Math.random() < prof.arpProb) {
        inst.arp = pickRandom(arpChoices);
      } else {
        inst.arp = "none";
      }

      this.applyTimingConfluenceToInstrument(inst, bpm);
    }

    randomizeWavetableSynths(style = "camping_gas", bpmOverride = null) {
      const targetBpm = bpmOverride || this.bpm || 128;
      const prof = this.getStyleSynthProfile(style);

      this.data.wavetableInstruments.forEach((inst) => {
        if (inst.id === "perc_sid_noise") return;
        this.applyStyleBasisToSingleInstrument(inst, style, targetBpm);
      });

      const allIds = this.data.wavetableInstruments
        .filter((i) => i.id !== "perc_sid_noise")
        .map((i) => i.id);

      const leadPool = (prof.leadPool || []).filter((id) => allIds.includes(id));
      const arpPool = (prof.arpPool || []).filter((id) => allIds.includes(id));
      const bassPool = (prof.bassPool || []).filter((id) => allIds.includes(id));

      this.channelState[0].instId = pickRandom(leadPool.length ? leadPool : allIds);
      this.channelState[1].instId = pickRandom(arpPool.length ? arpPool : allIds);
      this.channelState[2].instId = pickRandom(bassPool.length ? bassPool : allIds);
      this.channelState[3].instId = "perc_sid_noise";
    }

    scheduleNoteOnContext(targetCtx, destNode, noiseBuf, inst, midiNote, arpModeKey, velocity, startTime, durationSec, chVolume) {
      const amp = Math.max(0.02, Math.min(1.0, velocity * chVolume * 0.42));
      if (inst.id === "perc_sid_noise") {
        this.scheduleSidPercussion(targetCtx, destNode, noiseBuf, midiNote, amp, startTime);
        return;
      }

      const wt = buildWavetableData(inst);
      const wave = targetCtx.createPeriodicWave(wt.real, wt.imag, { disableNormalization: false });
      const osc = targetCtx.createOscillator();
      osc.setPeriodicWave(wave);

      const subOsc = targetCtx.createOscillator();
      subOsc.type = inst.family === "triangle" ? "triangle" : "sine";
      const subGain = targetCtx.createGain();
      subGain.gain.value = (inst.sineMix || 0) * 0.25 + (inst.triangleMix || 0) * 0.18;

      const baseFreq = midiToFreq(midiNote);
      osc.frequency.setValueAtTime(baseFreq, startTime);
      subOsc.frequency.setValueAtTime(baseFreq * 0.5, startTime);

      const arpKey = arpModeKey && arpModeKey !== "none" ? arpModeKey : (inst.arp || "none");
      const arpEntry = this.data.arpModes[arpKey] || { offsets: [0] };
      const offsets = arpEntry.offsets && arpEntry.offsets.length ? arpEntry.offsets : [0];

      const rel = Math.max(0.02, Number(inst.release || 0.12));
      if (offsets.length > 1) {
        const tickSec = 0.022;
        const totalTicks = Math.ceil((durationSec + rel) / tickSec);
        for (let t = 0; t < totalTicks; t++) {
          const semiOffset = offsets[t % offsets.length];
          const f = midiToFreq(midiNote + semiOffset);
          osc.frequency.setValueAtTime(f, startTime + t * tickSec);
          subOsc.frequency.setValueAtTime(f * 0.5, startTime + t * tickSec);
        }
      } else if (inst.vibratoDepth > 0.02) {
        const lfo = targetCtx.createOscillator();
        const lfoGain = targetCtx.createGain();
        lfo.frequency.value = 6.0;
        lfoGain.gain.value = baseFreq * 0.012 * inst.vibratoDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + durationSec + rel + 0.05);
      }

      const filter = targetCtx.createBiquadFilter();
      filter.type = inst.filterType || "lowpass";
      const cutoff = Math.max(120, Math.min(14000, Number(inst.cutoff || 3800)));
      filter.frequency.setValueAtTime(cutoff * 1.35, startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.65), startTime + Math.max(0.04, Number(inst.decay || 0.18)));
      filter.Q.value = Math.max(0.5, Math.min(18, Number(inst.resonance || 3.0)));

      const shaper = targetCtx.createWaveShaper();
      shaper.curve = makeDistortionCurve(Number(inst.drive || 0.15));

      // Strictly monotonic ADSR envelope timestamps
      const env = targetCtx.createGain();
      const atk = Math.min(durationSec * 0.35, Math.max(0.002, Number(inst.attack || 0.006)));
      const dec = Math.min(Math.max(0.01, durationSec - atk - 0.005), Math.max(0.02, Number(inst.decay || 0.16)));
      const sus = Math.max(0.05, Math.min(1.0, Number(inst.sustain || 0.6)));
      const releaseStart = Math.max(startTime + atk + dec + 0.002, startTime + durationSec);

      env.gain.setValueAtTime(0.0001, startTime);
      env.gain.linearRampToValueAtTime(amp, startTime + atk);
      env.gain.linearRampToValueAtTime(amp * sus, startTime + atk + dec);
      env.gain.setValueAtTime(amp * sus, releaseStart);
      env.gain.exponentialRampToValueAtTime(0.0001, releaseStart + rel);

      osc.connect(shaper);
      subOsc.connect(subGain);
      subGain.connect(shaper);
      shaper.connect(filter);
      filter.connect(env);
      env.connect(destNode);

      const stopAt = releaseStart + rel + 0.03;
      osc.start(startTime);
      subOsc.start(startTime);
      osc.stop(stopAt);
      subOsc.stop(stopAt);
    }

    scheduleSidPercussion(targetCtx, destNode, noiseBuf, midiNote, amp, startTime) {
      if (midiNote <= 44) {
        const osc = targetCtx.createOscillator();
        osc.type = "triangle";
        const env = targetCtx.createGain();
        const startFreq = midiNote <= 36 ? 155 : 210;
        const endFreq = midiNote <= 36 ? 32 : 55;
        osc.frequency.setValueAtTime(startFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.11);
        env.gain.setValueAtTime(amp * 1.4, startTime);
        env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);
        osc.connect(env);
        env.connect(destNode);
        osc.start(startTime);
        osc.stop(startTime + 0.18);
      } else if (midiNote <= 56) {
        const osc = targetCtx.createOscillator();
        osc.type = "triangle";
        const oscEnv = targetCtx.createGain();
        osc.frequency.setValueAtTime(230, startTime);
        osc.frequency.exponentialRampToValueAtTime(92, startTime + 0.07);
        oscEnv.gain.setValueAtTime(amp * 0.9, startTime);
        oscEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);
        osc.connect(oscEnv);
        oscEnv.connect(destNode);
        osc.start(startTime);
        osc.stop(startTime + 0.09);

        if (noiseBuf) {
          const nSrc = targetCtx.createBufferSource();
          nSrc.buffer = noiseBuf;
          const bp = targetCtx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = midiNote >= 52 ? 2400 : 1800;
          bp.Q.value = 1.4;
          const nEnv = targetCtx.createGain();
          nEnv.gain.setValueAtTime(amp * 1.1, startTime);
          nEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);
          nSrc.connect(bp);
          bp.connect(nEnv);
          nEnv.connect(destNode);
          nSrc.start(startTime);
          nSrc.stop(startTime + 0.17);
        }
      } else if (noiseBuf) {
        const nSrc = targetCtx.createBufferSource();
        nSrc.buffer = noiseBuf;
        const hp = targetCtx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = midiNote >= 72 ? 4200 : 5800;
        const nEnv = targetCtx.createGain();
        const hatDur = midiNote >= 72 ? 0.32 : midiNote >= 68 ? 0.18 : 0.052;
        nEnv.gain.setValueAtTime(amp * 0.78, startTime);
        nEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + hatDur);
        nSrc.connect(hp);
        hp.connect(nEnv);
        nEnv.connect(destNode);
        nSrc.start(startTime);
        nSrc.stop(startTime + hatDur + 0.02);
      }
    }

    auditionNote(noteStr, instIdOverride, durationSec = 0.34) {
      this.ensureAudioContext();
      const midi = noteToMidi(noteStr);
      if (midi === null) return;
      const inst = this.getInstrument(instIdOverride || this.selectedInstrumentId);
      const targetCh = inst.id === "perc_sid_noise" ? 3 : (this.selectedChannel === 3 ? 0 : this.selectedChannel);
      if (this.channelState[targetCh]) {
        this.channelState[targetCh].vu = 1.0;
      }
      this.scheduleNoteOnContext(
        this.ctx,
        this.masterGain,
        this.noiseBuffer,
        inst,
        midi,
        inst.arp || "none",
        0.96,
        this.ctx.currentTime,
        durationSec,
        0.92
      );
    }

    playInSynthNote(noteStr, options = {}) {
      const instId = options.instId || this.selectedInstrumentId;
      const inst = this.getInstrument(instId);
      const dur = options.durationSec || 0.36;
      if (options.arpOverride) {
        inst.arp = options.arpOverride;
      }

      // Always play the note immediately on the Live SID Output
      this.auditionNote(noteStr, inst.id, dur);

      const recordToTracker = options.recordToTracker !== false;
      const targetCh = inst.id === "perc_sid_noise" ? 3 : (this.selectedChannel === 3 ? 0 : this.selectedChannel);
      this.channelState[targetCh].instId = inst.id;
      this.channelState[targetCh].muted = false;

      let writtenStep = this.isPlaying ? this.currentStep : this.selectedStep;
      writtenStep = Math.max(0, Math.min(this.stepCount - 1, writtenStep || 0));

      if (recordToTracker && this.pattern && this.pattern[targetCh]) {
        const newCell = {
          note: noteStr,
          inst: inst.id,
          arp: inst.arp || "none",
          vel: 0.92
        };
        this.pattern[targetCh][writtenStep] = newCell;
        const curQt = this.data.presets[this.activeQuickTuneIndex];
        if (curQt && Array.isArray(curQt.pattern) && Array.isArray(curQt.pattern[targetCh])) {
          curQt.pattern[targetCh][writtenStep] = { ...newCell };
          if (curQt.isUserSaved) this.persistCustomQuickTunes();
        }
        if (!this.isPlaying) {
          this.selectedStep = (writtenStep + 1) % this.stepCount;
        } else {
          this.selectedStep = writtenStep;
        }
      }

      return {
        note: noteStr,
        instId: inst.id,
        channel: targetCh,
        step: writtenStep,
        recorded: recordToTracker
      };
    }

    triggerCurrentStep() {
      this.ensureAudioContext();
      const stepDur = this.stepDurationSec();
      const now = this.ctx.currentTime;

      let patSteps = this.pattern;
      let transpose = 0;
      let voiceMask = [true, true, true, true];

      if (this.playMode === "song" && this.arrangement.length > 0) {
        const block = this.arrangement[this.activeArrangeIndex] || this.arrangement[0];
        this.activePatternIndex = Math.max(0, Math.min(this.patterns.length - 1, block.patternIndex || 0));
        patSteps = this.patterns[this.activePatternIndex].steps;
        transpose = Number(block.transpose || 0);
        voiceMask = block.voices || [true, true, true, true];
      }

      for (let ch = 0; ch < 4; ch++) {
        if (!this.isChannelAudible(ch, voiceMask)) {
          this.channelState[ch].vu *= 0.65;
          continue;
        }
        const cell = patSteps[ch]?.[this.currentStep];
        if (!cell || !cell.note || cell.note === "---" || cell.note === "===") {
          this.channelState[ch].vu *= 0.7;
          continue;
        }
        let midi = noteToMidi(cell.note);
        if (midi === null) continue;
        if (ch < 3 && transpose !== 0) {
          midi = Math.max(24, Math.min(96, midi + transpose));
        }

        let holdSteps = 1;
        for (let look = 1; look < 8; look++) {
          const nextIdx = (this.currentStep + look) % this.stepCount;
          const nextCell = patSteps[ch]?.[nextIdx];
          if (nextCell && nextCell.note === "---") holdSteps++;
          else break;
        }

        const isVoiceLocked = !!(this.setSynthOnVoiceArmed && this.channelState[ch]?.synthArmed);
        const effectiveInstId = isVoiceLocked
          ? (this.channelState[ch].instId || cell.inst)
          : (cell.inst || this.channelState[ch].instId);
        const inst = this.getInstrument(effectiveInstId);
        const effectiveArp = isVoiceLocked && inst.arp && inst.arp !== "none"
          ? inst.arp
          : (cell.arp && cell.arp !== "none" ? cell.arp : (inst.arp || "none"));
        this.channelState[ch].vu = Math.min(1.0, cell.vel || 0.85);
        this.scheduleNoteOnContext(
          this.ctx,
          this.masterGain,
          this.noiseBuffer,
          inst,
          midi,
          effectiveArp,
          cell.vel || 0.85,
          now,
          stepDur * holdSteps * 0.92,
          this.channelState[ch].volume
        );
      }
    }

    play(onStepCallback) {
      this.ensureAudioContext();
      if (this.isPlaying) return;
      this.isPlaying = true;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "FACG_SID_PLAY" }, "*");
        }
      } catch (_e) {}

      const tick = () => {
        if (!this.isPlaying) return;
        const playedStep = this.currentStep;
        const playedBlock = this.activeArrangeIndex;
        const playedPat = this.activePatternIndex;

        this.triggerCurrentStep();
        if (typeof onStepCallback === "function") {
          onStepCallback(playedStep, playedBlock, playedPat);
        }

        this.currentStep++;
        if (this.currentStep >= this.stepCount) {
          this.currentStep = 0;
          if (this.playMode === "song" && this.arrangement.length > 0) {
            this.activeArrangeIndex = (this.activeArrangeIndex + 1) % this.arrangement.length;
            this.activePatternIndex = this.arrangement[this.activeArrangeIndex].patternIndex;
          }
        }
        this.stepTimer = setTimeout(tick, this.stepDurationSec() * 1000);
      };
      tick();
    }

    stop(onStopCallback) {
      this.isPlaying = false;
      if (this.stepTimer) {
        clearTimeout(this.stepTimer);
        this.stepTimer = null;
      }
      for (let ch = 0; ch < 4; ch++) {
        this.channelState[ch].vu = 0;
      }
      if (typeof onStopCallback === "function") onStopCallback();
    }

    resolveKeySelection(keyChoice) {
      const pools = {
        pool_dark_c64: ["C-", "D#", "F-", "G#"],
        pool_bright_arcade: ["D-", "E-", "G-", "A-"],
        pool_deep_sub: ["E-", "F-", "F#", "G-"],
        pool_black_keys: ["C#", "D#", "F#", "G#", "A#"]
      };
      if (!keyChoice || keyChoice === "random") return pickRandom(NOTE_NAMES);
      if (pools[keyChoice]) return pickRandom(pools[keyChoice]);
      return NOTE_NAMES.includes(keyChoice) ? keyChoice : "C-";
    }

    resolveScaleSelection(scaleChoice, style = "camping_gas") {
      const allScales = Object.keys(this.data.scales);
      const pools = {
        pool_minor_dark: ["harmonic_minor", "aeolian", "phrygian", "hungarian_minor"].filter((s) => allScales.includes(s)),
        pool_cyber_modal: ["dorian", "mixolydian", "lydian", "melodic_minor"].filter((s) => allScales.includes(s)),
        pool_eastern_exotic: ["phrygian_dominant", "hirajoshi", "in_sen", "hungarian_minor"].filter((s) => allScales.includes(s))
      };
      if (scaleChoice && pools[scaleChoice] && pools[scaleChoice].length) {
        return pickRandom(pools[scaleChoice]);
      }
      if (scaleChoice && scaleChoice !== "random" && allScales.includes(scaleChoice)) {
        return scaleChoice;
      }
      const styleScalePrefs = {
        camping_gas: ["harmonic_minor", "aeolian", "dorian", "minor_pentatonic"],
        hubbard: ["harmonic_minor", "phrygian", "melodic_minor", "aeolian"],
        lukhash: ["dorian", "phrygian", "minor_pentatonic", "blues_sid"],
        galway: ["dorian", "mixolydian", "lydian", "aeolian"],
        huelsbeck: ["aeolian", "harmonic_minor", "major_arcade", "mixolydian"],
        darksynth: ["phrygian_dominant", "hungarian_minor", "phrygian", "harmonic_minor"],
        acid_303: ["phrygian", "dorian", "blues_sid", "minor_pentatonic"],
        arcade_coinop: ["major_arcade", "major_pentatonic", "mixolydian", "lydian"],
        vapor_chill: ["lydian", "dorian", "major_pentatonic", "melodic_minor"],
        ambient: ["lydian", "hirajoshi", "in_sen", "dorian"],
        chipbreak: ["minor_pentatonic", "blues_sid", "dorian", "phrygian"],
        chaos: ["hungarian_minor", "whole_tone", "phrygian_dominant", "blues_sid"]
      };
      const prefs = (styleScalePrefs[style] || []).filter((s) => allScales.includes(s));
      return pickRandom(prefs.length ? prefs : allScales);
    }

    resolveBpmFromTimingMaster(timingMaster, style = "camping_gas") {
      if (timingMaster === "lock_current") {
        return Math.max(60, Math.min(220, Number(this.bpm) || 128));
      }
      if (timingMaster && timingMaster !== "random" && timingMaster !== "auto") {
        const parsed = parseInt(timingMaster, 10);
        if (!isNaN(parsed) && parsed >= 60 && parsed <= 220) {
          return parsed;
        }
      }
      const bpmRanges = {
        camping_gas: [120, 144],
        hubbard: [122, 150],
        lukhash: [124, 146],
        galway: [104, 128],
        huelsbeck: [126, 148],
        darksynth: [102, 126],
        acid_303: [128, 148],
        arcade_coinop: [132, 158],
        vapor_chill: [76, 98],
        ambient: [72, 96],
        chipbreak: [154, 174],
        chaos: [144, 184]
      };
      const [minB, maxB] = bpmRanges[style] || [116, 148];
      return randInt(minB, maxB);
    }

    buildSectionPatternSteps(sectionType, options = {}) {
      const rootName = options.root || this.lastSongMeta.root || "C-";
      const rootSemi = NOTE_TO_SEMI[rootName.length === 1 ? rootName + "-" : rootName] ?? 0;
      const scaleKey = options.scale || this.lastSongMeta.scale || "harmonic_minor";
      const style = options.style || this.lastSongMeta.style || "camping_gas";
      const template = options.template || this.lastSongMeta.template || "full_harmony";
      const songBpm = Number(options.bpm || this.bpm || 128);
      const baseDensity = Number(options.density ?? 0.68);
      const scaleObj = this.data.scales[scaleKey] || this.data.scales.harmonic_minor;
      const intervals = scaleObj.intervals;

      const pickDegreeNote = (degIdx, baseOct) => {
        const len = intervals.length;
        const normIdx = ((degIdx % len) + len) % len;
        const octShift = Math.floor(degIdx / len);
        return (baseOct + 1 + octShift) * 12 + rootSemi + intervals[normIdx];
      };

      const progFamily = sectionType.startsWith("VERSE")
        ? CHORD_PROGRESSIONS.VERSE
        : sectionType.startsWith("CHORUS")
        ? CHORD_PROGRESSIONS.CHORUS
        : CHORD_PROGRESSIONS[sectionType] || CHORD_PROGRESSIONS.VERSE;
      const baseProg = [...pickRandom(progFamily)];
      if (Math.random() < 0.45) {
        baseProg[3] = pickRandom([4, 5, 6, 1, 2]);
      }

      const validMelodicIds = this.data.wavetableInstruments
        .filter((i) => i.id !== "perc_sid_noise")
        .map((i) => i.id);

      const prof = this.getStyleSynthProfile(style);
      const allLeadInsts = (prof.leadPool || ["sq_pwm_hubbard", "sq_classic", "tri_folded"]).filter((x) => validMelodicIds.includes(x));
      const allArpInsts = (prof.arpPool || ["sq_arp_chord", "tri_folded", "sin_fm_bell"]).filter((x) => validMelodicIds.includes(x));
      const allBassInsts = (prof.bassPool || ["sq_sub_bass", "sin_cyberchip", "tri_pure"]).filter((x) => validMelodicIds.includes(x));

      const primaryLeadInst = options.primaryLeadInst || this.channelState[0]?.instId || pickRandom(allLeadInsts.length ? allLeadInsts : validMelodicIds);
      const accentLeadInst = pickRandom((allLeadInsts.length > 1 ? allLeadInsts : validMelodicIds).filter((x) => x !== primaryLeadInst));
      const primaryArpInst = options.primaryArpInst || this.channelState[1]?.instId || pickRandom(allArpInsts.length ? allArpInsts : validMelodicIds);
      const accentArpInst = pickRandom((allArpInsts.length > 1 ? allArpInsts : validMelodicIds).filter((x) => x !== primaryArpInst));
      const primaryBassInst = options.primaryBassInst || this.channelState[2]?.instId || pickRandom(allBassInsts.length ? allBassInsts : validMelodicIds);
      const accentBassInst = pickRandom((allBassInsts.length > 1 ? allBassInsts : validMelodicIds).filter((x) => x !== primaryBassInst));

      // Tempo-confluent archetype selection based on Master BPM + Style + Template
      const isSlowTempo = songBpm <= 98;
      const isFastTempo = songBpm >= 146;

      const leadArchetype = template === "melody_only"
        ? pickRandom(["syncopated_hook", "dotted_anthem", "call_response", "arp_ornament", "octave_leaper"])
        : isSlowTempo
        ? pickRandom(["dotted_anthem", "call_response", "syncopated_hook", "arp_ornament"])
        : isFastTempo
        ? pickRandom(["cyber_16th_run", "octave_leaper", "syncopated_hook", "arp_ornament"])
        : pickRandom(["syncopated_hook", "dotted_anthem", "cyber_16th_run", "call_response", "octave_leaper", "arp_ornament"]);

      const arpArchetype = template === "rhythm_only"
        ? pickRandom(["chord_stabs", "euclidean_332", "offbeat_trance"])
        : isSlowTempo
        ? pickRandom(["euclidean_332", "chord_stabs", "alternating_oct"])
        : isFastTempo
        ? pickRandom(["tracker_16th", "gallop_arp", "alternating_oct", "offbeat_trance"])
        : pickRandom(["tracker_16th", "offbeat_trance", "euclidean_332", "chord_stabs", "alternating_oct", "gallop_arp"]);

      const bassArchetype = template === "melody_only"
        ? pickRandom(["walking_scale", "triad_arp_bass", "sub_drop_pickup", "offbeat_pump"])
        : template === "rhythm_only"
        ? pickRandom(["electro_slap", "octave_gallop", "rolling_16th", "offbeat_pump"])
        : isSlowTempo
        ? pickRandom(["sub_drop_pickup", "walking_scale", "offbeat_pump", "electro_slap"])
        : isFastTempo
        ? pickRandom(["rolling_16th", "octave_gallop", "electro_slap", "triad_arp_bass"])
        : pickRandom(["octave_gallop", "rolling_16th", "offbeat_pump", "electro_slap", "walking_scale", "sub_drop_pickup", "triad_arp_bass"]);

      const drumArchetype = style === "chipbreak" || isFastTempo
        ? pickRandom(["demoscene_speed", "syncopated_break", "four_on_floor"])
        : isSlowTempo || style === "vapor_chill" || style === "ambient"
        ? pickRandom(["halftime_stomp", "syncopated_break", "tom_groove"])
        : pickRandom(["four_on_floor", "syncopated_break", "halftime_stomp", "demoscene_speed", "electro_shaker", "tom_groove"]);

      const availableArps = Object.keys(this.data.arpModes).filter((k) => k !== "none");
      const stylePrefArps = (prof.arpPref || []).filter((k) => availableArps.includes(k));
      const arpPool = shuffleArray(stylePrefArps.length ? stylePrefArps : availableArps);

      const motifA = [];
      const motifB = [];
      let degA = pickRandom([0, 2, 4, 7]);
      let degB = degA + pickRandom([2, 3, 4, -2]);
      for (let i = 0; i < 8; i++) {
        motifA.push(degA);
        motifB.push(degB);
        degA = Math.max(-3, Math.min(12, degA + pickRandom([-3, -2, -1, 1, 1, 2, 3, 4])));
        degB = Math.max(-3, Math.min(12, degB + pickRandom([-4, -2, -1, 1, 2, 2, 3])));
      }

      const leadBaseOct = sectionType === "SOLO"
        ? pickRandom([4, 5])
        : sectionType === "BREAK" || sectionType === "INTRO"
        ? pickRandom([3, 4])
        : 4;
      const arpBaseOct = pickRandom([3, 4]);
      const bassBaseOct = pickRandom([1, 2]);

      const muteLeadByTemplate = (template === "rhythm_only" || template === "arp_bass_drive");
      const muteArpByTemplate = (template === "lead_and_perc");
      const mutePercByTemplate = (template === "melody_only");
      const leadDensityBoost = template === "melody_only" ? 0.22 : template === "lead_and_perc" ? 0.16 : 0.0;
      const percDensityBoost = template === "rhythm_only" ? 0.28 : template === "lead_and_perc" ? 0.14 : 0.0;

      const steps = [[], [], [], []];

      for (let s = 0; s < this.stepCount; s++) {
        const barIdx = Math.floor(s / 8) % 4;
        const degRoot = (s % 8 >= 6 && Math.random() < 0.35)
          ? (baseProg[barIdx] + pickRandom([1, 2, 4])) % 7
          : baseProg[barIdx];
        const inBar = s % 8;

        // VOICE 1: LEAD
        if (muteLeadByTemplate) {
          steps[0].push({ note: "---", inst: primaryLeadInst, arp: "none", vel: 0.8 });
        } else {
          let leadGate = false;
          const effLeadDensity = Math.min(0.96, baseDensity + leadDensityBoost);
          if (leadArchetype === "syncopated_hook") {
            leadGate = [0, 2, 3, 5, 6].includes(inBar) && Math.random() < effLeadDensity + 0.12;
          } else if (leadArchetype === "dotted_anthem") {
            leadGate = [0, 3, 6, 7].includes(inBar) && Math.random() < effLeadDensity + 0.18;
          } else if (leadArchetype === "cyber_16th_run") {
            leadGate = Math.random() < Math.min(0.96, effLeadDensity + 0.22);
          } else if (leadArchetype === "call_response") {
            leadGate = barIdx % 2 === 0 ? [0, 1, 2, 4, 6].includes(inBar) : [0, 3, 4, 5, 7].includes(inBar);
          } else if (leadArchetype === "octave_leaper") {
            leadGate = s % 2 === 0 || (inBar === 7 && Math.random() < 0.7);
          } else {
            leadGate = Math.random() < effLeadDensity;
          }

          if (sectionType === "OUTRO" && s >= 24 && s !== 24) leadGate = false;
          if (sectionType === "SOLO") leadGate = Math.random() < 0.90;

          if (s === this.stepCount - 1 && Math.random() < 0.7) {
            steps[0].push({ note: "===", inst: primaryLeadInst, arp: "none", vel: 0 });
          } else if (leadGate) {
            const motif = barIdx % 2 === 0 ? motifA : motifB;
            let deg = degRoot + motif[inBar];
            if (leadArchetype === "octave_leaper" && inBar % 2 === 1) deg += 7;
            const octShift = (sectionType === "SOLO" && s % 3 === 0) ? 1 : 0;
            const midi = pickDegreeNote(deg, leadBaseOct + octShift);
            const stepInst = (inBar === 3 || inBar === 6) && Math.random() < 0.4 ? accentLeadInst : primaryLeadInst;
            const stepArp = (leadArchetype === "arp_ornament" || Math.random() < 0.25)
              ? pickRandom(arpPool.slice(0, 4).concat(["none"]))
              : "none";

            steps[0].push({
              note: midiToNote(midi),
              inst: stepInst,
              arp: stepArp,
              vel: randFloat(0.76, 0.98)
            });
          } else if ((isFastTempo && inBar % 4 === 3 && Math.random() < 0.45) || (inBar === 7 && Math.random() < 0.35)) {
            steps[0].push({ note: "===", inst: primaryLeadInst, arp: "none", vel: 0 });
          } else {
            steps[0].push({ note: "---", inst: primaryLeadInst, arp: "none", vel: 0.8 });
          }
        }

        // VOICE 2: 50Hz ARP / COUNTER-MELODY
        if (muteArpByTemplate) {
          steps[1].push({ note: "---", inst: primaryArpInst, arp: "none", vel: 0.72 });
        } else if (template === "rhythm_only") {
          const stabSteps = [0, 3, 6];
          if (stabSteps.includes(inBar) && Math.random() < 0.72) {
            const midi = pickDegreeNote(degRoot + pickRandom([0, 2, 4]), arpBaseOct);
            const chosenArp = arpPool[(barIdx + inBar) % arpPool.length];
            steps[1].push({
              note: midiToNote(midi),
              inst: primaryArpInst,
              arp: chosenArp,
              vel: randFloat(0.74, 0.92)
            });
          } else if ([1, 4, 7].includes(inBar)) {
            steps[1].push({ note: "===", inst: primaryArpInst, arp: "none", vel: 0 });
          } else {
            steps[1].push({ note: "---", inst: primaryArpInst, arp: "none", vel: 0.72 });
          }
        } else {
          let arpGate = false;
          if (arpArchetype === "tracker_16th") {
            arpGate = s % 2 === 0 || (sectionType === "SOLO" && Math.random() < 0.8);
          } else if (arpArchetype === "offbeat_trance") {
            arpGate = s % 4 === 2 || s % 4 === 3;
          } else if (arpArchetype === "euclidean_332") {
            arpGate = [0, 3, 6].includes(inBar);
          } else if (arpArchetype === "chord_stabs") {
            arpGate = [0, 2, 5].includes(inBar);
          } else if (arpArchetype === "alternating_oct") {
            arpGate = s % 2 === 0;
          } else {
            arpGate = [0, 2, 3, 4, 6, 7].includes(inBar) && Math.random() < 0.80;
          }

          if (template === "melody_only" && [1, 4, 6].includes(inBar) && Math.random() < 0.65) {
            arpGate = true;
          }

          if (arpGate) {
            const degOffset = arpArchetype === "alternating_oct" && s % 4 === 2
              ? 7
              : [0, 2, 4, 6][Math.floor(Math.random() * (template === "melody_only" ? 4 : 3))];
            const midi = pickDegreeNote(degRoot + degOffset, arpBaseOct);
            const chosenArp = arpPool[(barIdx + Math.floor(s / 2)) % arpPool.length];
            const useAccent = inBar >= 6 && Math.random() < 0.4;
            steps[1].push({
              note: midiToNote(midi),
              inst: useAccent ? accentArpInst : primaryArpInst,
              arp: chosenArp,
              vel: randFloat(0.68, 0.90)
            });
          } else if ((arpArchetype === "offbeat_trance" && s % 4 === 0) || (inBar === 7 && Math.random() < 0.45)) {
            steps[1].push({ note: "===", inst: primaryArpInst, arp: "none", vel: 0 });
          } else {
            steps[1].push({
              note: "---",
              inst: primaryArpInst,
              arp: steps[1][Math.max(0, s - 1)]?.arp || arpPool[0],
              vel: 0.72
            });
          }
        }

        // VOICE 3: SUB BASS
        const lowBass = pickDegreeNote(degRoot, bassBaseOct);
        const octBass = lowBass + 12;
        const fifthBass = pickDegreeNote(degRoot + 4, bassBaseOct);
        const flatSevenBass = pickDegreeNote(degRoot + 6, bassBaseOct);
        const walkBass = pickDegreeNote(degRoot + (inBar % 5), bassBaseOct);

        let bassNote = null;
        let bassInstStep = primaryBassInst;
        let bassArpStep = "none";

        if (sectionType === "BREAK" && Math.random() < 0.65 && template !== "rhythm_only") {
          if (inBar === 0 || inBar === 6) bassNote = lowBass;
        } else if (bassArchetype === "octave_gallop") {
          bassNote = s % 2 === 0 ? lowBass : octBass;
        } else if (bassArchetype === "rolling_16th") {
          bassNote = [lowBass, lowBass, octBass, fifthBass][s % 4];
          if (s % 4 === 2) bassInstStep = accentBassInst;
        } else if (bassArchetype === "offbeat_pump") {
          if (s % 4 === 0) bassNote = lowBass;
          else if (s % 4 === 2) {
            bassNote = octBass;
            bassInstStep = accentBassInst;
          } else if (inBar === 7) bassNote = fifthBass;
        } else if (bassArchetype === "electro_slap") {
          if ([0, 2, 3, 5, 6, 7].includes(inBar)) {
            bassNote = inBar === 0 ? lowBass : inBar === 3 ? octBass : inBar === 5 ? fifthBass : flatSevenBass;
            if (inBar === 3 || inBar === 6) bassInstStep = accentBassInst;
          }
        } else if (bassArchetype === "walking_scale") {
          if (s % 2 === 0 || inBar === 7) bassNote = inBar === 0 ? lowBass : walkBass;
        } else if (bassArchetype === "sub_drop_pickup") {
          if (inBar === 0) bassNote = lowBass;
          else if (inBar === 4 && template === "melody_only") bassNote = fifthBass;
          else if (inBar === 6) bassNote = fifthBass;
          else if (inBar === 7) {
            bassNote = octBass;
            bassArpStep = "oct";
          }
        } else {
          if (s % 2 === 0) {
            bassNote = [lowBass, fifthBass, octBass, fifthBass][(s / 2) % 4];
            if (inBar === 4) bassArpStep = "pwr";
          }
        }

        if (bassNote !== null) {
          steps[2].push({
            note: midiToNote(bassNote),
            inst: bassInstStep,
            arp: bassArpStep,
            vel: inBar === 0 ? 0.96 : randFloat(0.8, 0.94)
          });
        } else if ((template === "rhythm_only" && s % 2 === 1) || (inBar === 7 && Math.random() < 0.35)) {
          steps[2].push({ note: "===", inst: primaryBassInst, arp: "none", vel: 0 });
        } else {
          steps[2].push({ note: "---", inst: primaryBassInst, arp: "none", vel: 0.84 });
        }

        // VOICE 4: SID PERCUSSION
        if (mutePercByTemplate) {
          steps[3].push({ note: "---", inst: "perc_sid_noise", arp: "none", vel: 0 });
        } else {
          let percNote = "---";
          let percVel = 0.85;
          const effPercDensity = Math.min(0.98, baseDensity + percDensityBoost);

          if (sectionType === "BUILD" && s >= 24) {
            percNote = s % 2 === 0 ? "D-3" : "G-2";
            percVel = Number((0.62 + ((s - 24) / 8) * 0.36).toFixed(2));
          } else if (s >= 28 && Math.random() < 0.78) {
            percNote = pickRandom(["D-3", "G-2", "F-3", "A#4", "C-2"]);
            percVel = randFloat(0.78, 0.98);
          } else if (s === 0 && (sectionType.startsWith("CHORUS") || sectionType === "SOLO" || template === "rhythm_only")) {
            percNote = "C-5";
            percVel = 0.96;
          } else if (template === "rhythm_only") {
            if (inBar === 0 || (inBar === 3 && barIdx % 2 === 1) || (inBar === 5 && barIdx % 2 === 0)) {
              percNote = "C-2"; percVel = 0.98;
            } else if (inBar === 2 || inBar === 6) {
              percNote = barIdx % 2 === 1 && inBar === 6 ? "F-3" : "D-3"; percVel = 0.94;
            } else if (inBar === 4) {
              percNote = pickRandom(["G-2", "C-2", "F-3"]); percVel = 0.90;
            } else if (inBar === 7) {
              percNote = pickRandom(["A#4", "G-2", "D-3"]); percVel = 0.86;
            } else {
              percNote = Math.random() < effPercDensity ? pickRandom(["F#4", "A#4", "G-2"]) : "F#4";
              percVel = randFloat(0.64, 0.84);
            }
          } else if (drumArchetype === "four_on_floor") {
            if (s % 4 === 0) { percNote = "C-2"; percVel = 0.96; }
            else if (s % 4 === 2) { percNote = barIdx % 2 === 1 && inBar === 6 ? "F-3" : "D-3"; percVel = 0.9; }
            else if (s % 2 === 1) { percNote = inBar === 7 ? "A#4" : (Math.random() < effPercDensity ? "F#4" : "---"); percVel = 0.65; }
          } else if (drumArchetype === "syncopated_break") {
            if (inBar === 0 || inBar === 5) { percNote = "C-2"; percVel = 0.96; }
            else if (inBar === 2 || inBar === 6) { percNote = "D-3"; percVel = 0.92; }
            else if (inBar === 3) { percNote = "G-2"; percVel = 0.82; }
            else { percNote = Math.random() < effPercDensity ? "F#4" : "---"; percVel = 0.62; }
          } else if (drumArchetype === "halftime_stomp") {
            if (inBar === 0 || inBar === 3) { percNote = "C-2"; percVel = 0.98; }
            else if (inBar === 4) { percNote = "D-3"; percVel = 0.95; }
            else if (inBar === 7) { percNote = "A#4"; percVel = 0.78; }
            else if (s % 2 === 1 && Math.random() < 0.55) { percNote = "F#4"; percVel = 0.58; }
          } else if (drumArchetype === "demoscene_speed") {
            if (inBar === 0 || inBar === 3 || inBar === 6) { percNote = "C-2"; percVel = 0.95; }
            else if (inBar === 2 || inBar === 4) { percNote = "D-3"; percVel = 0.9; }
            else { percNote = inBar === 7 ? "A#4" : "F#4"; percVel = 0.68; }
          } else if (drumArchetype === "electro_shaker") {
            if (inBar === 0) { percNote = "C-2"; percVel = 0.96; }
            else if (inBar === 4) { percNote = "F-3"; percVel = 0.92; }
            else if (inBar === 2 || inBar === 6) { percNote = "A#4"; percVel = 0.76; }
            else { percNote = "F#4"; percVel = randFloat(0.48, 0.72); }
          } else {
            if (inBar === 0) { percNote = "C-2"; percVel = 0.96; }
            else if (inBar === 2 || inBar === 5) { percNote = "G-2"; percVel = 0.88; }
            else if (inBar === 4) { percNote = "D-3"; percVel = 0.92; }
            else if (Math.random() < effPercDensity) { percNote = "F#4"; percVel = 0.64; }
          }

          steps[3].push({
            note: percNote,
            inst: "perc_sid_noise",
            arp: "none",
            vel: percVel
          });
        }
      }

      return steps;
    }

    randomizeSequence(options = {}) {
      const curPat = this.patterns[this.activePatternIndex];
      const secType = curPat?.sectionType || "CHORUS_A";
      const targetChannels = options.channels || [0, 1, 2, 3];
      const resolvedStyle = (options.style && options.style !== "random")
        ? options.style
        : (this.lastSongMeta.style || "camping_gas");
      const resolvedRoot = (options.root && options.root !== "random")
        ? this.resolveKeySelection(options.root)
        : (this.lastSongMeta.root || "C-");
      const resolvedScale = (options.scale && options.scale !== "random")
        ? this.resolveScaleSelection(options.scale, resolvedStyle)
        : (this.lastSongMeta.scale || "harmonic_minor");
      const resolvedTemplate = (options.template && options.template !== "random")
        ? options.template
        : (this.lastSongMeta.template || "full_harmony");

      if (options.randomizeSynths) {
        this.randomizeWavetableSynths(resolvedStyle, this.bpm);
      }

      const freshSteps = this.buildSectionPatternSteps(secType, {
        root: resolvedRoot,
        scale: resolvedScale,
        style: resolvedStyle,
        template: resolvedTemplate,
        bpm: this.bpm,
        density: options.density ?? 0.68
      });

      for (const ch of targetChannels) {
        this.pattern[ch] = freshSteps[ch];
        const firstActive = freshSteps[ch].find((c) => c.note && c.note !== "---" && c.note !== "===");
        if (firstActive?.inst) {
          this.channelState[ch].instId = firstActive.inst;
        }
      }
    }

    applyTemplateVoiceMask(voicesArr, template = "full_harmony", sectionType = "VERSE") {
      const v = [...voicesArr];
      if (template === "melody_only") {
        v[0] = true;
        v[1] = true;
        v[2] = sectionType !== "INTRO";
        v[3] = false;
      } else if (template === "rhythm_only") {
        v[0] = false;
        v[1] = sectionType.startsWith("CHORUS") || sectionType === "SOLO" || sectionType === "BUILD";
        v[2] = true;
        v[3] = true;
      } else if (template === "lead_and_perc") {
        v[0] = true;
        v[1] = false;
        v[2] = sectionType.startsWith("CHORUS") || sectionType === "SOLO";
        v[3] = true;
      } else if (template === "arp_bass_drive") {
        v[0] = false;
        v[1] = true;
        v[2] = true;
        v[3] = sectionType !== "BREAK";
      }
      return v;
    }

    generateFullVariedSong(options = {}) {
      let targetMin = options.targetMinutes;
      if (targetMin === "random" || !targetMin) {
        targetMin = randFloat(2.15, 5.85, 2);
      } else {
        targetMin = Math.max(1.2, Math.min(7.0, Number(targetMin)));
      }

      const allStyles = [
        "camping_gas", "hubbard", "lukhash", "galway", "huelsbeck",
        "darksynth", "acid_303", "arcade_coinop", "vapor_chill",
        "ambient", "chipbreak", "chaos"
      ];

      const chosenStyle = (options.style && options.style !== "random")
        ? options.style
        : pickRandom(allStyles);

      const chosenRoot = (!options.root || options.root === "random")
        ? (options.randomizeMusicality !== false ? pickRandom(NOTE_NAMES) : (this.lastSongMeta.root || "C-"))
        : this.resolveKeySelection(options.root);

      const chosenScale = (!options.scale || options.scale === "random")
        ? (options.randomizeMusicality !== false ? this.resolveScaleSelection("random", chosenStyle) : (this.lastSongMeta.scale || "harmonic_minor"))
        : this.resolveScaleSelection(options.scale, chosenStyle);

      const allTemplates = ["full_harmony", "melody_only", "rhythm_only", "lead_and_perc", "arp_bass_drive"];
      const chosenTemplate = (!options.template || options.template === "random")
        ? (options.template === "random" ? pickRandom(allTemplates) : "full_harmony")
        : options.template;

      const timingMaster = options.timingMaster || options.bpm || "random";
      this.bpm = this.resolveBpmFromTimingMaster(timingMaster, chosenStyle);

      if (options.randomizeSynths !== false) {
        this.randomizeWavetableSynths(chosenStyle, this.bpm);
      } else {
        this.applyTimingConfluenceToAllSynths(this.bpm);
      }

      const density = Number(options.density ?? randFloat(0.58, 0.84));

      const sectionSpecs = [
        { id: "P00", name: "P00 · INTRO (Pilot Flame)",         sectionType: "INTRO" },
        { id: "P01", name: "P01 · VERSE A (Butane Groove)",     sectionType: "VERSE" },
        { id: "P02", name: "P02 · VERSE B (Counter-Motif)",     sectionType: "VERSE" },
        { id: "P03", name: "P03 · VERSE C (Synth Mutation)",    sectionType: "VERSE" },
        { id: "P04", name: "P04 · PRE-CHORUS (Pressure Build)", sectionType: "BUILD" },
        { id: "P05", name: "P05 · CHORUS A (Full Burner)",      sectionType: "CHORUS" },
        { id: "P06", name: "P06 · CHORUS B (50Hz Overdrive)",   sectionType: "CHORUS" },
        { id: "P07", name: "P07 · BREAKDOWN (Campfire Ember)",  sectionType: "BREAK" },
        { id: "P08", name: "P08 · SOLO CLIMAX (CyberChip)",     sectionType: "SOLO" },
        { id: "P09", name: "P09 · OUTRO (Valve Shutdown)",      sectionType: "OUTRO" }
      ];

      this.patterns = sectionSpecs.map((spec) => ({
        id: spec.id,
        name: spec.name,
        sectionType: spec.sectionType,
        steps: this.buildSectionPatternSteps(spec.sectionType, {
          root: chosenRoot,
          scale: chosenScale,
          style: chosenStyle,
          template: chosenTemplate,
          bpm: this.bpm,
          density,
          primaryLeadInst: this.channelState[0].instId,
          primaryArpInst: this.channelState[1].instId,
          primaryBassInst: this.channelState[2].instId
        })
      }));

      const refSteps = this.patterns[0].steps;
      for (let ch = 0; ch < 3; ch++) {
        const activeCell = refSteps[ch].find((c) => c.note && c.note !== "---" && c.note !== "===");
        if (activeCell?.inst) {
          this.channelState[ch].instId = activeCell.inst;
        }
      }
      this.selectedInstrumentId = chosenTemplate === "rhythm_only"
        ? this.channelState[2].instId
        : this.channelState[0].instId;

      const targetSec = targetMin * 60;
      const patSec = this.patternDurationSec();
      const totalBlocks = Math.max(18, Math.min(125, Math.round(targetSec / patSec)));

      const architectures = [
        {
          name: "Demoscene Ignition Odyssey",
          modShiftA: pickRandom([3, 5, -2]),
          modShiftFinale: pickRandom([2, 3, 5]),
          core: [
            { p: 0, lbl: "INTRO 1 (Full Ignition)",  sec: "INTRO",    tr: 0, v: [true, true, true, true] },
            { p: 0, lbl: "INTRO 2 (Arp+Bass Groove)",sec: "INTRO",    tr: 0, v: [false, true, true, true] },
            { p: 1, lbl: "VERSE 1A",                 sec: "VERSE_A",  tr: 0, v: [true, true, true, true] },
            { p: 2, lbl: "VERSE 1B",                 sec: "VERSE_B",  tr: 0, v: [true, true, true, true] },
            { p: 4, lbl: "PRE-CHORUS BUILD",         sec: "BUILD",    tr: 0, v: [true, true, true, true] },
            { p: 5, lbl: "CHORUS 1A (Full Flame)",   sec: "CHORUS_A", tr: 0, v: [true, true, true, true] },
            { p: 6, lbl: "CHORUS 1B (50Hz Hook)",    sec: "CHORUS_B", tr: 0, v: [true, true, true, true] },
            { p: 3, lbl: "VERSE 2A (Synth Mutate)",  sec: "VERSE_A",  tr: 0, v: [true, true, true, true] },
            { p: 2, lbl: "VERSE 2B (Key Lift)",      sec: "VERSE_B",  tr: 5, v: [true, true, true, true] },
            { p: 4, lbl: "PRE-CHORUS 2",             sec: "BUILD",    tr: 0, v: [true, true, true, true] },
            { p: 5, lbl: "CHORUS 2A",                sec: "CHORUS_A", tr: 0, v: [true, true, true, true] },
            { p: 6, lbl: "CHORUS 2B",                sec: "CHORUS_B", tr: 0, v: [true, true, true, true] },
            { p: 7, lbl: "BREAKDOWN 1 (Ember)",      sec: "BREAK",    tr: 0, v: [true, true, false, false] },
            { p: 7, lbl: "BREAKDOWN 2 (+Sub)",       sec: "BREAK",    tr: 3, v: [true, true, true, false] },
            { p: 4, lbl: "RE-IGNITION BUILD",        sec: "BUILD",    tr: 0, v: [true, true, true, true] },
            { p: 8, lbl: "SOLO CLIMAX 1",            sec: "SOLO",     tr: 0, v: [true, true, true, true] },
            { p: 8, lbl: "SOLO CLIMAX 2 (Modulated)",sec: "SOLO",     tr: 5, v: [true, true, true, true] },
            { p: 5, lbl: "FINAL CHORUS A (+Mod)",    sec: "CHORUS_A", tr: 2, v: [true, true, true, true] },
            { p: 6, lbl: "FINAL CHORUS B (+Mod)",    sec: "CHORUS_B", tr: 2, v: [true, true, true, true] }
          ]
        },
        {
          name: "CyberChip Dual-Drop Roller",
          modShiftA: pickRandom([-3, 2, 5]),
          modShiftFinale: pickRandom([2, 4, -2]),
          core: [
            { p: 5, lbl: "OPENING DROP (Chorus A)",  sec: "CHORUS_A", tr: 0, v: [true, true, true, true] },
            { p: 0, lbl: "INTRO GROOVE",             sec: "INTRO",    tr: 0, v: [true, true, true, true] },
            { p: 1, lbl: "VERSE 1 (Main Motif)",     sec: "VERSE_A",  tr: 0, v: [true, true, true, true] },
            { p: 2, lbl: "VERSE 2 (Counter)",        sec: "VERSE_B",  tr: 0, v: [true, true, true, true] },
            { p: 4, lbl: "IGNITION BUILD",           sec: "BUILD",    tr: 0, v: [true, true, true, true] },
            { p: 6, lbl: "CHORUS HOOK B",            sec: "CHORUS_B", tr: 0, v: [true, true, true, true] },
            { p: 8, lbl: "MINI-SOLO SHRED",          sec: "SOLO",     tr: 0, v: [true, true, true, true] },
            { p: 3, lbl: "VERSE 3 (Mutated)",        sec: "VERSE_A",  tr: 3, v: [true, true, true, true] },
            { p: 7, lbl: "BRIDGE BREAKDOWN",         sec: "BREAK",    tr: 0, v: [true, true, true, false] },
            { p: 4, lbl: "OVERPRESSURE BUILD",       sec: "BUILD",    tr: 2, v: [true, true, true, true] },
            { p: 8, lbl: "CYBERCHIP SOLO MAX",       sec: "SOLO",     tr: 2, v: [true, true, true, true] },
            { p: 5, lbl: "GRAND FINALE A",           sec: "CHORUS_A", tr: 2, v: [true, true, true, true] },
            { p: 6, lbl: "GRAND FINALE B",           sec: "CHORUS_B", tr: 4, v: [true, true, true, true] }
          ]
        }
      ];

      const arch = pickRandom(architectures);
      this.lastSongMeta = {
        root: chosenRoot,
        scale: chosenScale,
        style: chosenStyle,
        bpm: this.bpm,
        timingMaster: String(timingMaster),
        template: chosenTemplate,
        architecture: arch.name
      };

      const outroBlocks = [
        { patternIndex: 9, label: "OUTRO 1 (Full Deconstruct)", sectionType: "OUTRO", transpose: arch.modShiftFinale, voices: this.applyTemplateVoiceMask([true, true, true, true], chosenTemplate, "OUTRO") },
        { patternIndex: 9, label: "OUTRO 2 (Home Key Drain)",   sectionType: "OUTRO", transpose: 0, voices: this.applyTemplateVoiceMask([false, true, true, true], chosenTemplate, "OUTRO") },
        { patternIndex: 9, label: "OUTRO 3 (Pilot Ember)",      sectionType: "OUTRO", transpose: 0, voices: this.applyTemplateVoiceMask([false, true, true, false], chosenTemplate, "OUTRO") }
      ];

      this.arrangement = [];
      const bodyTarget = Math.max(8, totalBlocks - outroBlocks.length);
      for (let i = 0; i < bodyTarget; i++) {
        const src = arch.core[i % arch.core.length];
        const cycle = Math.floor(i / arch.core.length);
        const cycleShift = cycle === 0 ? 0 : cycle % 2 === 1 ? arch.modShiftA : arch.modShiftFinale;
        this.arrangement.push({
          patternIndex: src.p,
          label: cycle > 0 ? `${src.lbl} [Act ${cycle + 1}]` : src.lbl,
          sectionType: src.sec,
          transpose: Math.max(-7, Math.min(7, src.tr + cycleShift)),
          voices: this.applyTemplateVoiceMask(src.v, chosenTemplate, src.sec)
        });
      }
      for (const ob of outroBlocks) {
        this.arrangement.push(JSON.parse(JSON.stringify(ob)));
      }

      this.activeArrangeIndex = 0;
      this.activePatternIndex = this.arrangement[0].patternIndex;
      this.currentStep = 0;

      return this.lastSongMeta;
    }

    // =========================================================================
    // JSON PROJECT EXPORT & IMPORT (Supports Full Song, Single Pattern & Preset Bank)
    // =========================================================================
    exportProjectJSON(songTitle) {
      const meta = this.lastSongMeta || { root: "C-", scale: "harmonic_minor", style: "camping_gas" };
      const defaultTitle = `${meta.root} ${meta.scale} · ${this.bpm} BPM (${formatDuration(this.totalSongDurationSec())})`;
      return {
        sidName: "FLAMABLE AI CAMPING GAS SID",
        engineVersion: "2.2.0",
        authors: "River Lyle Reuveni (https://imortalimp.nl) & Arena.ai Agent (https://arena.ai)",
        license: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
        exportedAt: new Date().toISOString(),
        title: songTitle || defaultTitle,
        bpm: this.bpm,
        stepCount: this.stepCount,
        playMode: this.playMode,
        activeArrangeIndex: this.activeArrangeIndex,
        activePatternIndex: this.activePatternIndex,
        selectedInstrumentId: this.selectedInstrumentId,
        songMeta: JSON.parse(JSON.stringify(meta)),
        channelState: JSON.parse(JSON.stringify(this.channelState)),
        wavetableInstruments: JSON.parse(JSON.stringify(this.data.wavetableInstruments)),
        quickTunesPresets: JSON.parse(JSON.stringify(this.data.presets)),
        patterns: JSON.parse(JSON.stringify(this.patterns)),
        arrangement: JSON.parse(JSON.stringify(this.arrangement)),
        pattern: JSON.parse(JSON.stringify(this.pattern))
      };
    }

    // =========================================================================
    // QUICK TUNES + WAVETABLE INSTRUMENT PANEL CONFLUENCE ENGINE (v2.3)
    // =========================================================================
    buildSignatureQuickTuneForInstrument(inst, instIdx = 0) {
      const roots = ["C-", "A-", "E-", "D-", "G-", "F#", "C#", "F-", "G#", "D#", "A#", "C-"];
      const scales = [
        "harmonic_minor", "natural_minor", "dorian", "phrygian",
        "pentatonic_minor", "synthwave_minor", "harmonic_minor", "dorian",
        "natural_minor", "pentatonic_minor", "synthwave_minor", "phrygian"
      ];
      const bpms = [134, 138, 128, 142, 116, 126, 136, 124, 118, 130, 132, 140];
      const rootName = roots[instIdx % roots.length];
      const rootSemi = NOTE_TO_SEMI[rootName] ?? 0;
      const scaleKey = scales[instIdx % scales.length];
      const bpm = bpms[instIdx % bpms.length];
      const scaleIntervals = (this.data.scales[scaleKey] || this.data.scales.harmonic_minor).intervals;

      const degToNote = (deg, oct) => {
        const len = scaleIntervals.length;
        const norm = ((deg % len) + len) % len;
        const octShift = Math.floor(deg / len);
        return midiToNote((oct + 1 + octShift) * 12 + rootSemi + scaleIntervals[norm]);
      };

      const steps = [[], [], [], []];
      const isPerc = inst.id === "perc_sid_noise";
      const isBassStyle = inst.id.includes("sub") || inst.id === "sin_pure";
      const leadOct = isBassStyle ? 3 : 4;
      const defaultArp = (inst.arp && inst.arp !== "none") ? inst.arp : (inst.id.includes("arp") ? "hubbard" : "none");
      const contour = [0, 2, 4, 7, 6, 4, 2, 5, 0, 3, 4, 8, 7, 5, 3, 2];

      for (let s = 0; s < this.stepCount; s++) {
        const bar = Math.floor(s / 8) % 4;
        const inBar = s % 8;
        const chordDeg = [0, 5, 3, 4][bar];

        // Voice 1: Showcases the selected Wavetable Instrument
        const v1Inst = isPerc ? "sq_pwm_hubbard" : inst.id;
        if (s % 2 === 0 || [3, 6, 7].includes(inBar)) {
          const deg = chordDeg + contour[(s + instIdx) % contour.length];
          const stepArp = (inBar === 0 || inBar === 4) && defaultArp !== "none"
            ? defaultArp
            : (inBar === 6 ? "oct" : defaultArp);
          steps[0].push({
            note: degToNote(deg, leadOct),
            inst: v1Inst,
            arp: stepArp,
            vel: inBar === 0 ? 0.95 : 0.86
          });
        } else {
          steps[0].push({ note: "---", inst: v1Inst, arp: defaultArp, vel: 0.8 });
        }

        // Voice 2: 50Hz C64 Chord Arpeggio Companion
        const v2Inst = inst.id === "sq_arp_chord" ? inst.id : "sq_arp_chord";
        if (s % 2 === 0) {
          const arpMode = ["hubbard", "min", "lukhash", "oct"][(bar + instIdx) % 4];
          steps[1].push({
            note: degToNote(chordDeg + (s % 4 === 2 ? 2 : 0), 3),
            inst: v2Inst,
            arp: arpMode,
            vel: 0.76
          });
        } else {
          steps[1].push({ note: "---", inst: v2Inst, arp: "hubbard", vel: 0.72 });
        }

        // Voice 3: Driving Octave Sub-Bass
        const v3Inst = isBassStyle ? inst.id : "sq_sub_bass";
        if (s % 2 === 0) {
          const bOct = (s % 4 === 2) ? 3 : 2;
          steps[2].push({
            note: degToNote(chordDeg, bOct),
            inst: v3Inst,
            arp: "none",
            vel: inBar === 0 ? 0.94 : 0.84
          });
        } else {
          steps[2].push({ note: "---", inst: v3Inst, arp: "none", vel: 0.8 });
        }

        // Voice 4: 6581 SID Drum Matrix
        let pNote = "---";
        let pVel = 0.84;
        if (isPerc) {
          const breakPattern = ["C-2", "F#4", "G-2", "F#4", "D-3", "C-2", "A#4", "F-3"];
          pNote = breakPattern[inBar];
          pVel = inBar % 2 === 0 ? 0.96 : 0.78;
        } else {
          if (inBar === 0 || inBar === 5) { pNote = "C-2"; pVel = 0.95; }
          else if (inBar === 2 || inBar === 6) { pNote = "D-3"; pVel = 0.9; }
          else if (s % 2 === 1) { pNote = inBar === 7 ? "A#4" : "F#4"; pVel = 0.68; }
        }
        steps[3].push({ note: pNote, inst: "perc_sid_noise", arp: "none", vel: pVel });
      }

      return { bpm, root: rootName, scale: scaleKey, steps };
    }

    initQuickTunesAndConfluence() {
      const factoryList = this.factoryInstruments || this.baseConfig.wavetableInstruments || [];
      const findFactoryInst = (id) =>
        JSON.parse(JSON.stringify(factoryList.find((x) => x.id === id) || factoryList[0]));

      // 1. Enrich the 3 classic presets with explicit instrument snapshots & leadInstId
      const basePresets = JSON.parse(JSON.stringify((this.baseConfig.presets || []).filter((x) => !String(x.id || "").startsWith("qt_inst_")))).map((p, idx) => {
        const inferredLead = p.leadInstId || p.pattern?.[0]?.find((c) => c && c.inst)?.inst || "sq_pwm_hubbard";
        return {
          ...p,
          id: p.id || `classic_${idx}`,
          title: `🎵 ${p.title.replace(/^🎵\s*/, "")}`,
          leadInstId: inferredLead,
          instrumentSnapshot: p.instrumentSnapshot || findFactoryInst(inferredLead),
          isBuiltIn: true,
          category: "classic"
        };
      });

      // 2. Build 12 Instrument-Linked Quick Tunes (1 for every Wavetable Instrument in Panel 2)
      const instQuickTunes = factoryList.map((inst, idx) => {
        const sig = this.buildSignatureQuickTuneForInstrument(inst, idx);
        const shortName = inst.name.replace(/^\d+\s*·\s*/, "");
        return {
          id: `qt_inst_${inst.id}`,
          title: `🎛️ [${String(idx + 1).padStart(2, "0")} · ${shortName}] Quick Tune`,
          bpm: sig.bpm,
          root: sig.root,
          scale: sig.scale,
          leadInstId: inst.id,
          instrumentSnapshot: JSON.parse(JSON.stringify(inst)),
          isBuiltIn: true,
          isInstrumentQuickTune: true,
          category: "instrument",
          pattern: sig.steps
        };
      });

      // 3. Load any User-Saved Quick Tunes & custom Wavetable Instruments from localStorage
      let savedUserTunes = [];
      try {
        const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY_QUICK_TUNES) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) savedUserTunes = parsed;
        }
      } catch (_e) {}

      this.customQuickTunes = savedUserTunes;

      // Ensure any custom instruments inside savedUserTunes exist in wavetableInstruments
      savedUserTunes.forEach((ut) => {
        if (ut.instrumentSnapshot && ut.instrumentSnapshot.id) {
          const exists = this.data.wavetableInstruments.some((i) => i.id === ut.instrumentSnapshot.id);
          if (!exists) {
            this.data.wavetableInstruments.push(JSON.parse(JSON.stringify(ut.instrumentSnapshot)));
          }
        }
      });

      this.data.presets = [...savedUserTunes, ...basePresets, ...instQuickTunes];
      this.activeQuickTuneIndex = 0;
    }

    persistCustomQuickTunes() {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_QUICK_TUNES, JSON.stringify(this.customQuickTunes));
        }
      } catch (_e) {}
    }

    getQuickTuneIndexForInstrument(instId) {
      // Prefer user-saved Quick Tune for this instrument, then dedicated instrument Quick Tune, then any matching preset
      const userIdx = this.data.presets.findIndex((p) => p.isUserSaved && p.leadInstId === instId);
      if (userIdx !== -1) return userIdx;
      const instIdx = this.data.presets.findIndex((p) => p.isInstrumentQuickTune && p.leadInstId === instId);
      if (instIdx !== -1) return instIdx;
      const anyIdx = this.data.presets.findIndex((p) => p.leadInstId === instId);
      return anyIdx !== -1 ? anyIdx : 0;
    }

    loadQuickTuneByIndex(idx) {
      const safeIdx = Math.max(0, Math.min(this.data.presets.length - 1, Number(idx) || 0));
      const p = this.data.presets[safeIdx];
      if (!p) return null;

      this.activeQuickTuneIndex = safeIdx;

      // 1. Restore or register the Quick Tune's Wavetable Instrument so Panel 2 is in 100% confluence
      const leadId = p.leadInstId || p.instrumentSnapshot?.id || p.pattern?.[0]?.find((c) => c && c.inst)?.inst || "sq_pwm_hubbard";
      if (p.instrumentSnapshot) {
        const existing = this.data.wavetableInstruments.find((i) => i.id === p.instrumentSnapshot.id);
        if (existing) {
          Object.assign(existing, JSON.parse(JSON.stringify(p.instrumentSnapshot)));
        } else {
          this.data.wavetableInstruments.push(JSON.parse(JSON.stringify(p.instrumentSnapshot)));
        }
      }

      // 2. Select this instrument in Panel 2 (WAVETABLE SYNTH SELECTOR)
      this.selectedInstrumentId = leadId;
      this.selectedChannel = leadId === "perc_sid_noise" ? 3 : 0;

      // 3. Apply BPM, Root, Scale & Pattern Steps
      this.bpm = Math.max(60, Math.min(220, Number(p.bpm || 132)));
      if (p.root) {
        this.lastSongMeta.root = p.root.length === 1 ? p.root + "-" : p.root;
      }
      if (p.scale) {
        this.lastSongMeta.scale = p.scale;
      }

      const clonedSteps = JSON.parse(JSON.stringify(p.pattern));
      if (!this.patterns || !this.patterns.length) {
        this.patterns = [{ id: "P00", name: `P00 · ${p.title}`, sectionType: "CHORUS", steps: clonedSteps }];
        this.activePatternIndex = 0;
      } else {
        const curPat = this.patterns[this.activePatternIndex] || this.patterns[0];
        curPat.steps = clonedSteps;
        curPat.name = `${curPat.id} · ${p.title.replace(/^[🎵🎛️⭐]\s*/, "")}`;
      }

      // Also sync active Song Arranger block so both Pattern Mode & Song Mode play this Quick Tune
      if (this.arrangement && this.arrangement[this.activeArrangeIndex]) {
        this.arrangement[this.activeArrangeIndex].patternIndex = this.activePatternIndex;
        this.arrangement[this.activeArrangeIndex].label = p.title.replace(/^[🎵🎛️⭐]\s*/, "").slice(0, 26);
      }

      // 4. Sync all 4 channel voice instruments & ensure lead voice is audible
      for (let ch = 0; ch < 4; ch++) {
        const firstWithInst = clonedSteps[ch]?.find((c) => c && c.inst && c.note !== "---");
        if (firstWithInst?.inst) {
          this.channelState[ch].instId = firstWithInst.inst;
        }
      }
      if (leadId === "perc_sid_noise") {
        this.channelState[3].instId = "perc_sid_noise";
        this.channelState[3].muted = false;
      } else {
        this.channelState[0].instId = leadId;
        this.channelState[0].muted = false;
      }

      this.currentStep = 0;
      return p;
    }

    applyInstrumentToActiveQuickTune(instId, targetChannel = null, options = {}) {
      const inst = this.getInstrument(instId);
      if (!inst) return null;
      this.selectedInstrumentId = inst.id;

      const applyAllPatterns = options.applyAllPatterns !== false;
      const targetAllMelodic = options.allMelodic === true || (targetChannel === null && this.activeVoiceTargetMode === "all_melodic" && inst.id !== "perc_sid_noise");

      let channelsToUpdate = [];
      if (targetAllMelodic) {
        channelsToUpdate = [0, 1, 2];
      } else {
        let ch = targetChannel;
        if (ch === null || ch === undefined) {
          if (inst.id === "perc_sid_noise") {
            ch = 3;
          } else if (this.selectedChannel === 3) {
            ch = 0;
          } else {
            ch = this.selectedChannel;
          }
        }
        this.selectedChannel = ch;
        channelsToUpdate = [ch];
      }

      // Mark synthArmed on the targeted channel(s)
      for (let c = 0; c < 4; c++) {
        if (channelsToUpdate.includes(c)) {
          this.channelState[c].instId = inst.id;
          this.channelState[c].synthArmed = true;
          this.channelState[c].muted = false;
        } else if (!targetAllMelodic && options.exclusiveArm !== false) {
          this.channelState[c].synthArmed = false;
        }
      }

      // Ensure Song Arranger blocks never mute the voice(s) we just assigned the synth to
      if (Array.isArray(this.arrangement)) {
        this.arrangement.forEach((blk) => {
          if (!Array.isArray(blk.voices)) blk.voices = [true, true, true, true];
          channelsToUpdate.forEach((c) => {
            blk.voices[c] = true;
          });
        });
      }

      const defaultArp = (inst.arp && inst.arp !== "none") ? inst.arp : null;
      const patternsList = applyAllPatterns && Array.isArray(this.patterns) && this.patterns.length > 0
        ? this.patterns
        : [{ steps: this.pattern }];

      patternsList.forEach((patObj) => {
        const pSteps = patObj.steps;
        if (!pSteps) return;
        channelsToUpdate.forEach((c) => {
          if (!Array.isArray(pSteps[c])) return;
          let activeNotesCount = 0;
          for (let s = 0; s < this.stepCount; s++) {
            const cell = pSteps[c][s];
            if (cell) {
              cell.inst = inst.id;
              if (defaultArp !== null && cell.note !== "---" && cell.note !== "===") {
                cell.arp = defaultArp;
              }
              if (cell.note && cell.note !== "---" && cell.note !== "===") {
                activeNotesCount++;
                // If assigning a melodic synth onto V4 (or perc onto V1-V3), normalize octave so it always sounds musical
                const m = noteToMidi(cell.note);
                if (m !== null) {
                  if (inst.id !== "perc_sid_noise" && c === 2 && !inst.id.includes("sub") && m < 45) {
                    cell.note = midiToNote(m + 12);
                  } else if (inst.id.includes("sub") && c !== 2 && m >= 60) {
                    cell.note = midiToNote(m - 12);
                  }
                }
              }
            }
          }
          if (activeNotesCount === 0) {
            const sig = this.buildSignatureQuickTuneForInstrument(inst, c);
            pSteps[c] = JSON.parse(JSON.stringify(sig.steps[c === 3 ? 3 : (c === 2 ? 2 : (c === 1 ? 1 : 0))]));
            pSteps[c].forEach((cell) => { cell.inst = inst.id; });
          }
        });
      });

      // Also keep the active Quick Tune preset in sync
      const curQt = this.data.presets[this.activeQuickTuneIndex];
      if (curQt && Array.isArray(curQt.pattern) && this.pattern) {
        channelsToUpdate.forEach((c) => {
          if (this.pattern[c]) {
            curQt.pattern[c] = JSON.parse(JSON.stringify(this.pattern[c]));
          }
        });
        if (curQt.isUserSaved) this.persistCustomQuickTunes();
      }

      return {
        channel: channelsToUpdate[0],
        channels: channelsToUpdate,
        instrument: inst
      };
    }

    saveSelectedInstrumentAsQuickTune(customTitle = "") {
      const curInst = this.getInstrument(this.selectedInstrumentId);
      const sqPct = Math.round((curInst.squareMix ?? 0.5) * 100);
      const triPct = Math.round((curInst.triangleMix ?? 0) * 100);
      const sinPct = Math.round((curInst.sineMix ?? 0) * 100);
      const cutHz = Math.round(curInst.cutoff ?? 3500);
      const cleanInstName = curInst.name.replace(/^\d+\s*·\s*/, "").replace(/^⭐\s*/, "").trim();

      // Create or update a custom Wavetable Instrument entry in Panel 2 so both panels share the saved entry
      const customId = "user_inst_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 5);
      const userLabel = (customTitle || "").trim();
      const newInstName = userLabel
        ? `⭐ ${userLabel} (${curInst.family.toUpperCase()})`
        : `⭐ ${cleanInstName} [${sqPct}/${triPct}/${sinPct} · ${cutHz}Hz]`;

      const savedInstSnapshot = {
        ...JSON.parse(JSON.stringify(curInst)),
        id: customId,
        name: newInstName,
        isCustom: true
      };

      this.data.wavetableInstruments.push(savedInstSnapshot);
      this.selectedInstrumentId = savedInstSnapshot.id;

      // Apply the newly saved instrument to the active voice in the current pattern
      this.applyInstrumentToActiveQuickTune(savedInstSnapshot.id, savedInstSnapshot.id === "perc_sid_noise" ? 3 : 0);

      // If current pattern has very few notes on Voice 1, generate a full signature Quick Tune pattern for this instrument
      let leadNotes = 0;
      for (let s = 0; s < this.stepCount; s++) {
        const n = this.pattern?.[0]?.[s]?.note;
        if (n && n !== "---" && n !== "===") leadNotes++;
      }
      let patternToSave = JSON.parse(JSON.stringify(this.pattern));
      if (leadNotes < 3) {
        const sig = this.buildSignatureQuickTuneForInstrument(savedInstSnapshot, this.customQuickTunes.length);
        patternToSave = sig.steps;
        this.pattern = JSON.parse(JSON.stringify(patternToSave));
      }

      const presetTitle = userLabel
        ? `⭐ ${userLabel} — ${cleanInstName}`
        : `⭐ ${cleanInstName} [Sq${sqPct}/Tri${triPct}/Sin${sinPct} · ${cutHz}Hz]`;

      const newPreset = {
        id: "qt_saved_" + Date.now().toString(36),
        title: presetTitle,
        bpm: this.bpm || 132,
        root: this.lastSongMeta.root || "C-",
        scale: this.lastSongMeta.scale || "harmonic_minor",
        leadInstId: savedInstSnapshot.id,
        instrumentSnapshot: JSON.parse(JSON.stringify(savedInstSnapshot)),
        isUserSaved: true,
        category: "saved",
        pattern: patternToSave
      };

      this.customQuickTunes.unshift(newPreset);
      this.data.presets.unshift(newPreset);
      this.activeQuickTuneIndex = 0;
      this.persistCustomQuickTunes();

      return {
        presetIndex: 0,
        preset: newPreset,
        instrument: savedInstSnapshot
      };
    }

    deleteSavedQuickTune(idx) {
      const p = this.data.presets[idx];
      if (!p || !p.isUserSaved) return false;
      this.data.presets.splice(idx, 1);
      const cIdx = this.customQuickTunes.findIndex((x) => x.id === p.id);
      if (cIdx !== -1) this.customQuickTunes.splice(cIdx, 1);
      if (p.leadInstId && p.leadInstId.startsWith("user_inst_") && this.data.wavetableInstruments.length > 1) {
        const iIdx = this.data.wavetableInstruments.findIndex((i) => i.id === p.leadInstId);
        if (iIdx !== -1) this.data.wavetableInstruments.splice(iIdx, 1);
      }
      this.activeQuickTuneIndex = Math.max(0, Math.min(this.data.presets.length - 1, idx));
      this.selectedInstrumentId = this.data.presets[this.activeQuickTuneIndex]?.leadInstId || this.data.wavetableInstruments[0].id;
      this.persistCustomQuickTunes();
      return true;
    }

    importProjectJSON(obj) {
      if (!obj || typeof obj !== "object") {
        throw new Error("Invalid JSON object.");
      }

      // 1. Restore custom wavetable instruments if present
      if (Array.isArray(obj.wavetableInstruments) && obj.wavetableInstruments.length >= 4) {
        this.data.wavetableInstruments = JSON.parse(JSON.stringify(obj.wavetableInstruments));
      }

      // 2. Restore channel states if present
      if (Array.isArray(obj.channelState) && obj.channelState.length === 4) {
        this.channelState = JSON.parse(JSON.stringify(obj.channelState));
      }

      // 3. Restore BPM & Song Metadata
      if (obj.bpm || obj.defaultBpm) {
        this.bpm = Math.max(60, Math.min(220, Number(obj.bpm || obj.defaultBpm || 132)));
      }
      if (obj.songMeta && typeof obj.songMeta === "object") {
        this.lastSongMeta = { ...this.lastSongMeta, ...obj.songMeta };
      }

      // 4. Restore Patterns & Arrangement from any supported JSON schema:
      //    Schema A: Full v2.x project with `patterns[]`
      //    Schema B: v1.x project with single `pattern`
      //    Schema C: Companion bank JSON (`flamable-ai-camping-gas-sid.json`) with `presets[]`
      if (Array.isArray(obj.patterns) && obj.patterns.length > 0) {
        this.patterns = JSON.parse(JSON.stringify(obj.patterns));
        this.stepCount = this.patterns[0].steps?.[0]?.length || 32;
      } else if (Array.isArray(obj.pattern) && obj.pattern.length === 4) {
        this.stepCount = obj.pattern[0]?.length || 32;
        this.patterns = [
          {
            id: "P00",
            name: `P00 · ${obj.title || "Imported Pattern"}`,
            sectionType: "CHORUS",
            steps: JSON.parse(JSON.stringify(obj.pattern))
          }
        ];
      } else if (Array.isArray(obj.presets) && obj.presets.length > 0) {
        this.patterns = obj.presets.map((pr, idx) => ({
          id: `P${String(idx).padStart(2, "0")}`,
          name: `P${String(idx).padStart(2, "0")} · ${pr.title || pr.id || "Preset"}`,
          sectionType: "CHORUS",
          steps: JSON.parse(JSON.stringify(pr.pattern))
        }));
        this.stepCount = this.patterns[0].steps?.[0]?.length || 32;
        this.bpm = Number(obj.presets[0].bpm || this.bpm);
      } else {
        throw new Error("JSON file does not contain patterns, pattern, or presets.");
      }

      if (Array.isArray(obj.arrangement) && obj.arrangement.length > 0) {
        this.arrangement = JSON.parse(JSON.stringify(obj.arrangement)).map((blk) => ({
          patternIndex: Math.max(0, Math.min(this.patterns.length - 1, Number(blk.patternIndex || 0))),
          label: blk.label || "BLOCK",
          sectionType: blk.sectionType || "VERSE_A",
          transpose: Number(blk.transpose || 0),
          voices: Array.isArray(blk.voices) && blk.voices.length === 4 ? blk.voices : [true, true, true, true]
        }));
      } else {
        // Build an arrangement automatically from available patterns
        this.arrangement = this.patterns.map((p, idx) => ({
          patternIndex: idx,
          label: p.name,
          sectionType: p.sectionType || "CHORUS_A",
          transpose: 0,
          voices: [true, true, true, true]
        }));
      }

      this.activeArrangeIndex = Math.max(0, Math.min(this.arrangement.length - 1, Number(obj.activeArrangeIndex || 0)));
      this.activePatternIndex = Math.max(0, Math.min(this.patterns.length - 1, Number(obj.activePatternIndex ?? this.arrangement[this.activeArrangeIndex].patternIndex ?? 0)));
      this.currentStep = 0;

      if (Array.isArray(obj.quickTunesPresets) && obj.quickTunesPresets.length > 0) {
        this.data.presets = JSON.parse(JSON.stringify(obj.quickTunesPresets));
      }

      // Validate selectedInstrumentId
      const validInst = this.data.wavetableInstruments.some((i) => i.id === obj.selectedInstrumentId);
      this.selectedInstrumentId = validInst ? obj.selectedInstrumentId : this.channelState[0].instId || this.data.wavetableInstruments[0].id;

      return {
        title: obj.title || "Imported Song",
        patternCount: this.patterns.length,
        blockCount: this.arrangement.length,
        bpm: this.bpm
      };
    }

    // =========================================================================
    // MULTI-SLOT BROWSER SAVE STATES MANAGER (Click-to-Load State Restore)
    // =========================================================================
    initBrowserSaveSlots() {
      let loaded = null;
      try {
        const raw = window.localStorage ? window.localStorage.getItem(STORAGE_KEY_SLOTS) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed;
          }
        }
      } catch (_e) {}

      if (!loaded) {
        try {
          if (window.name && window.name.startsWith("FACG_SLOTS:")) {
            const parsed = JSON.parse(window.name.slice("FACG_SLOTS:".length));
            if (Array.isArray(parsed) && parsed.length > 0) {
              loaded = parsed;
            }
          }
        } catch (_e2) {}
      }

      if (loaded) {
        this.memorySaveSlots = loaded;
        return;
      }

      // Seed 3 diverse, ready-to-click Browser Save States on first boot
      // while preserving our current boot song in Slot #1
      const currentSnapshot = this.exportProjectJSON("🔥 Butane Hubbard 50Hz Odyssey (Boot Song)");
      const slot1 = this.createSlotEntry("🔥 Butane Hubbard 50Hz Odyssey", currentSnapshot);

      const secondSnap = JSON.parse(JSON.stringify(currentSnapshot));
      this.generateFullVariedSong({
        targetMinutes: 2.6,
        root: "A-",
        scale: "dorian",
        style: "lukhash",
        randomizeMusicality: false,
        randomizeSynths: true
      });
      const slot2 = this.createSlotEntry("⚡ #lukhash CyberChip Nightburner (A Dorian)", this.exportProjectJSON("⚡ #lukhash CyberChip Nightburner"));

      this.generateFullVariedSong({
        targetMinutes: 3.8,
        root: "E-",
        scale: "phrygian",
        style: "chaos",
        randomizeMusicality: false,
        randomizeSynths: true
      });
      const slot3 = this.createSlotEntry("💥 Overpressure Demoscene Epic (E Phrygian)", this.exportProjectJSON("💥 Overpressure Demoscene Epic"));

      // Restore initial boot song as the active state
      this.importProjectJSON(secondSnap);

      this.memorySaveSlots = [slot1, slot2, slot3];
      this.persistBrowserSaveSlots();
    }

    createSlotEntry(customTitle, projData) {
      const proj = projData || this.exportProjectJSON(customTitle);
      const durSec = Math.max(1, (proj.arrangement?.length || 1)) * (proj.stepCount || 32) * (60 / (proj.bpm || 132) / 4);
      const meta = proj.songMeta || {};
      const now = new Date();
      const timeTag = now.toTimeString().slice(0, 8);
      return {
        id: "slot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        title: customTitle || proj.title || `Saved State (${timeTag})`,
        savedAt: timeTag,
        bpm: proj.bpm || 132,
        durationStr: formatDuration(durSec),
        root: meta.root || "C-",
        scale: meta.scale || "harmonic_minor",
        style: meta.style || "camping_gas",
        patternCount: proj.patterns?.length || 1,
        blockCount: proj.arrangement?.length || 1,
        leadInst: proj.channelState?.[0]?.instId || "sq_pwm_hubbard",
        project: proj
      };
    }

    persistBrowserSaveSlots() {
      const serialized = JSON.stringify(this.memorySaveSlots);
      try {
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_SLOTS, serialized);
        }
      } catch (_e) {}
      try {
        window.name = "FACG_SLOTS:" + serialized;
      } catch (_e2) {}
    }

    getSavedStates() {
      return this.memorySaveSlots;
    }

    saveCurrentStateToBrowserList(customTitle) {
      const entry = this.createSlotEntry(customTitle);
      this.memorySaveSlots.unshift(entry);
      // Keep up to 20 slots in browser storage
      if (this.memorySaveSlots.length > 20) {
        this.memorySaveSlots.length = 20;
      }
      this.persistBrowserSaveSlots();
      return entry;
    }

    loadSavedStateById(slotId) {
      const slot = this.memorySaveSlots.find((s) => s.id === slotId);
      if (!slot || !slot.project) {
        throw new Error("Saved state slot not found.");
      }
      this.importProjectJSON(slot.project);
      return slot;
    }

    deleteSavedStateById(slotId) {
      const idx = this.memorySaveSlots.findIndex((s) => s.id === slotId);
      if (idx !== -1) {
        this.memorySaveSlots.splice(idx, 1);
        this.persistBrowserSaveSlots();
        return true;
      }
      return false;
    }

    // =========================================================================
    // PURE-DSP DIRECT PCM 44.1 kHz STEREO .WAV RENDERER (Zero WebAudio Limits!)
    // Works reliably for both 2-6 minute full songs and single pattern loops.
    // =========================================================================
    async renderToWavBlob(mode = "song", projectOverride = null) {
      const proj = projectOverride || this;
      const sampleRate = 44100;
      const bpm = Number(proj.bpm || 132);
      const stepCount = Number(proj.stepCount || 32);
      const stepDur = 60 / bpm / 4;
      const patterns = proj.patterns || this.patterns;
      const arrangement = proj.arrangement || this.arrangement;
      const channelState = proj.channelState || this.channelState;
      const instruments = proj.wavetableInstruments || this.data.wavetableInstruments;

      const blocksToRender = mode === "song" && arrangement.length > 0
        ? arrangement
        : [
            { patternIndex: proj.activePatternIndex || 0, transpose: 0, voices: [true, true, true, true] },
            { patternIndex: proj.activePatternIndex || 0, transpose: 0, voices: [true, true, true, true] }
          ];

      const totalSteps = blocksToRender.length * stepCount;
      const tailSec = 0.45;
      const totalDuration = totalSteps * stepDur + tailSec;
      const totalFrames = Math.ceil(totalDuration * sampleRate);

      const leftBuf = new Float32Array(totalFrames);
      const rightBuf = new Float32Array(totalFrames);

      // 1. Pre-compute 256-sample wavetables for all instruments once
      const waveMap = new Map();
      for (const inst of instruments) {
        waveMap.set(inst.id, buildWavetableData(inst).samples);
      }

      // 2. Pre-compute 2 seconds of 23-bit LFSR SID noise
      const noiseLen = sampleRate * 2;
      const noiseSamples = new Float32Array(noiseLen);
      let lfsr = 0x7ffff8;
      for (let i = 0; i < noiseLen; i++) {
        if (i % 4 === 0) {
          const bit = ((lfsr >> 22) ^ (lfsr >> 17)) & 1;
          lfsr = ((lfsr << 1) | bit) & 0x7fffff;
        }
        noiseSamples[i] = ((lfsr & 0xff) / 127.5) - 1.0;
      }

      const anySolo = channelState.some((c) => c.solo);
      const isChAudible = (ch, mask) => {
        if (Array.isArray(mask) && mask[ch] === false) return false;
        if (anySolo) return !!channelState[ch]?.solo;
        return !channelState[ch]?.muted;
      };

      // Stereo panning per SID channel for wide stereo image
      const chPan = [-0.28, 0.32, 0.0, 0.08];

      // 3. Render every note across all blocks directly into leftBuf & rightBuf
      for (let bIdx = 0; bIdx < blocksToRender.length; bIdx++) {
        const blk = blocksToRender[bIdx];
        const pat = patterns[blk.patternIndex] || patterns[0];
        if (!pat || !pat.steps) continue;
        const patSteps = pat.steps;
        const transpose = Number(blk.transpose || 0);
        const voiceMask = blk.voices || [true, true, true, true];

        // Yield to UI event loop every 12 blocks so the browser never freezes on 5-minute songs
        if (bIdx > 0 && bIdx % 12 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }

        for (let s = 0; s < stepCount; s++) {
          const globalStep = bIdx * stepCount + s;
          const startTime = globalStep * stepDur;
          const startFrame = Math.floor(startTime * sampleRate);

          for (let ch = 0; ch < 4; ch++) {
            if (!isChAudible(ch, voiceMask)) continue;
            const cell = patSteps[ch]?.[s];
            if (!cell || !cell.note || cell.note === "---" || cell.note === "===") continue;

            let midi = noteToMidi(cell.note);
            if (midi === null) continue;
            if (ch < 3 && transpose !== 0) {
              midi = Math.max(24, Math.min(96, midi + transpose));
            }

            let holdSteps = 1;
            for (let look = 1; look < 8; look++) {
              const nextCell = patSteps[ch]?.[(s + look) % stepCount];
              if (nextCell && nextCell.note === "---") holdSteps++;
              else break;
            }

            const isVoiceLocked = !!(this.setSynthOnVoiceArmed && channelState[ch]?.synthArmed);
            const instId = isVoiceLocked
              ? (channelState[ch]?.instId || cell.inst || "sq_pwm_hubbard")
              : (cell.inst || channelState[ch]?.instId || "sq_pwm_hubbard");
            const inst = instruments.find((i) => i.id === instId) || instruments[0];
            const chVol = Number(channelState[ch]?.volume ?? 0.85);
            const vel = Number(cell.vel ?? 0.85);
            const amp = Math.max(0.02, Math.min(1.0, vel * chVol * 0.36));

            const pan = chPan[ch] || 0;
            const gainL = Math.cos(((pan + 1) * Math.PI) / 4);
            const gainR = Math.sin(((pan + 1) * Math.PI) / 4);

            if (inst.id === "perc_sid_noise" || ch === 3) {
              // Synthesize SID Percussion directly into buffer
              renderPercNoteToPcm(
                leftBuf, rightBuf, noiseSamples, sampleRate,
                startFrame, midi, amp, gainL, gainR
              );
            } else {
              const wtSamples = waveMap.get(inst.id) || waveMap.values().next().value;
              const arpKey = cell.arp && cell.arp !== "none" ? cell.arp : (inst.arp || "none");
              const arpOffsets = this.data.arpModes[arpKey]?.offsets || [0];
              const noteDurSec = stepDur * holdSteps * 0.92;

              renderMelodicNoteToPcm(
                leftBuf, rightBuf, wtSamples, sampleRate,
                startFrame, midi, arpOffsets, inst, amp, noteDurSec, gainL, gainR
              );
            }
          }
        }
      }

      // 4. Master soft-clipping limiter & 16-bit WAV encoding
      return encodeStereoPcmToWavBlob(leftBuf, rightBuf, sampleRate);
    }

    // =========================================================================
    // STANDARD MIDI FILE (.MID) EXPORTER (Format 1, 4 Tracks + Tempo Track)
    // =========================================================================
    exportToMidiBlob(mode = "song", projectOverride = null) {
      const proj = projectOverride || this;
      const bpm = Number(proj.bpm || 132);
      const stepCount = Number(proj.stepCount || 32);
      const patterns = proj.patterns || this.patterns;
      const arrangement = proj.arrangement || this.arrangement;

      const ppq = 120;
      const stepTicks = 30; // 16th note = 30 ticks at 120 PPQ
      const blocksToExport = mode === "song" && arrangement.length > 0
        ? arrangement
        : [{ patternIndex: proj.activePatternIndex || 0, transpose: 0, voices: [true, true, true, true] }];

      const writeVarLen = (val) => {
        let v = Math.max(0, Math.round(val));
        const bytes = [v & 0x7f];
        while ((v >>= 7) > 0) {
          bytes.unshift((v & 0x7f) | 0x80);
        }
        return bytes;
      };

      const usPerBeat = Math.round(60000000 / bpm);
      const tracks = [
        // Track 0: Tempo & Title Meta Track
        [
          0x00, 0xff, 0x51, 0x03,
          (usPerBeat >> 16) & 0xff,
          (usPerBeat >> 8) & 0xff,
          usPerBeat & 0xff,
          0x00, 0xff, 0x2f, 0x00
        ]
      ];

      // Map tracker drum notes to General MIDI Channel 10 Drum Kit notes
      const mapDrumMidi = (m) => {
        if (m <= 38) return 36; // Bass Drum 1 (C-2)
        if (m <= 45) return 45; // Low Tom (G-2)
        if (m <= 51) return 38; // Acoustic Snare (D-3)
        if (m <= 58) return 39; // Hand Clap / Rim (F-3)
        if (m <= 67) return 42; // Closed Hi-Hat (F#4)
        if (m <= 71) return 46; // Open Hi-Hat (A#4)
        return 49;              // Crash Cymbal 1 (C-5)
      };

      for (let ch = 0; ch < 4; ch++) {
        const events = [];
        let lastTick = 0;
        const midiCh = ch === 3 ? 9 : ch;

        // Send GM Program Change only on melodic channels 0..2 (Square Lead 80, Saw Lead 81, Synth Bass 38)
        if (ch < 3) {
          const gmProg = ch === 0 ? 80 : ch === 1 ? 81 : 38;
          events.push(0x00, 0xc0 | midiCh, gmProg);
        }

        for (let bIdx = 0; bIdx < blocksToExport.length; bIdx++) {
          const blk = blocksToExport[bIdx];
          if (blk.voices && blk.voices[ch] === false) continue;
          const pat = patterns[blk.patternIndex] || patterns[0];
          if (!pat || !pat.steps) continue;
          const patSteps = pat.steps;
          const transpose = Number(blk.transpose || 0);

          for (let s = 0; s < stepCount; s++) {
            const cell = patSteps[ch]?.[s];
            if (!cell || !cell.note || cell.note === "---" || cell.note === "===") continue;
            let midi = noteToMidi(cell.note);
            if (midi === null) continue;

            if (ch < 3 && transpose !== 0) {
              midi = Math.max(24, Math.min(96, midi + transpose));
            } else if (ch === 3) {
              midi = mapDrumMidi(midi);
            }

            let holdSteps = 1;
            for (let look = 1; look < 8 && s + look < stepCount; look++) {
              if (patSteps[ch]?.[s + look]?.note === "---") holdSteps++;
              else break;
            }

            const globalStep = bIdx * stepCount + s;
            const startTick = globalStep * stepTicks;
            const totalStepTicks = holdSteps * stepTicks;
            const vel = Math.max(1, Math.min(127, Math.round((cell.vel || 0.85) * 115)));

            const arpKey = ch < 3 && cell.arp && cell.arp !== "none" ? cell.arp : "none";
            const arpOffsets = this.data.arpModes[arpKey]?.offsets || [0];

            if (arpOffsets.length > 1 && ch < 3) {
              // Expand 50Hz C64 arpeggio into rapid 10-tick MIDI sub-notes
              const subTickLen = 10;
              const numSubs = Math.max(1, Math.floor(totalStepTicks / subTickLen));
              for (let sub = 0; sub < numSubs; sub++) {
                const subStart = startTick + sub * subTickLen;
                const subEnd = subStart + subTickLen - 1;
                const arpMidi = Math.max(24, Math.min(96, midi + arpOffsets[sub % arpOffsets.length]));
                events.push(...writeVarLen(subStart - lastTick), 0x90 | midiCh, arpMidi, vel);
                events.push(...writeVarLen(subEnd - subStart), 0x80 | midiCh, arpMidi, 0x00);
                lastTick = subEnd;
              }
            } else {
              const endTick = startTick + Math.max(4, totalStepTicks - 2);
              events.push(...writeVarLen(startTick - lastTick), 0x90 | midiCh, midi, vel);
              events.push(...writeVarLen(endTick - startTick), 0x80 | midiCh, midi, 0x00);
              lastTick = endTick;
            }
          }
        }

        // End of Track meta event
        events.push(0x00, 0xff, 0x2f, 0x00);
        tracks.push(events);
      }

      const chunks = [
        0x4d, 0x54, 0x68, 0x64,
        0x00, 0x00, 0x00, 0x06,
        0x00, 0x01,
        0x00, tracks.length,
        (ppq >> 8) & 0xff, ppq & 0xff
      ];

      for (const trk of tracks) {
        const len = trk.length;
        chunks.push(
          0x4d, 0x54, 0x72, 0x6b,
          (len >> 24) & 0xff,
          (len >> 16) & 0xff,
          (len >> 8) & 0xff,
          len & 0xff,
          ...trk
        );
      }

      return new Blob([new Uint8Array(chunks)], { type: "audio/midi" });
    }
  }

  /**
   * Direct-DSP Melodic Note Renderer (Wavetable + Sub-Osc + 50Hz Arp + 1-Pole 6581 Filter + ADSR)
   */
  function renderMelodicNoteToPcm(
    leftBuf, rightBuf, wtSamples, sampleRate,
    startFrame, baseMidi, arpOffsets, inst, amp, noteDurSec, gainL, gainR
  ) {
    const atk = Math.max(0.002, Number(inst.attack || 0.006));
    const dec = Math.max(0.02, Number(inst.decay || 0.16));
    const sus = Math.max(0.05, Math.min(1.0, Number(inst.sustain || 0.6)));
    const rel = Math.max(0.02, Number(inst.release || 0.12));

    const totalSec = noteDurSec + rel;
    const totalNoteFrames = Math.ceil(totalSec * sampleRate);
    const atkFrames = Math.max(1, Math.floor(atk * sampleRate));
    const decFrames = Math.max(1, Math.floor(dec * sampleRate));
    const relStartFrame = Math.max(atkFrames + 1, Math.floor(noteDurSec * sampleRate));
    const relFrames = Math.max(1, Math.floor(rel * sampleRate));

    const wtLen = wtSamples.length;
    const arpTickFrames = Math.max(1, Math.floor(0.022 * sampleRate));
    const hasArp = arpOffsets && arpOffsets.length > 1;
    const vibDepth = Number(inst.vibratoDepth || 0);
    const subMix = (Number(inst.sineMix || 0) * 0.24) + (Number(inst.triangleMix || 0) * 0.16);

    // 1-pole resonant-approximated lowpass filter coefficient
    const baseCutoff = Math.max(180, Math.min(12000, Number(inst.cutoff || 3800)));
    const alphaStart = Math.min(0.92, (2 * Math.PI * Math.min(14000, baseCutoff * 1.3)) / sampleRate);
    const alphaEnd = Math.min(0.92, (2 * Math.PI * Math.max(160, baseCutoff * 0.6)) / sampleRate);

    let phase = 0;
    let subPhase = 0;
    let lpState = 0;
    let curFreq = midiToFreq(baseMidi);

    const maxFrame = Math.min(leftBuf.length, startFrame + totalNoteFrames);
    for (let f = startFrame; f < maxFrame; f++) {
      const n = f - startFrame;

      // Update pitch for 50Hz C64 arpeggio or vibrato
      if (hasArp) {
        if (n % arpTickFrames === 0) {
          const tickIdx = Math.floor(n / arpTickFrames);
          const semi = arpOffsets[tickIdx % arpOffsets.length];
          curFreq = midiToFreq(baseMidi + semi);
        }
      } else if (vibDepth > 0.02 && (n & 63) === 0) {
        const tSec = n / sampleRate;
        curFreq = midiToFreq(baseMidi) * (1 + Math.sin(2 * Math.PI * 6.0 * tSec) * 0.012 * vibDepth);
      }

      // Compute ADSR envelope gain
      let env = 0;
      if (n < atkFrames) {
        env = (n / atkFrames) * amp;
      } else if (n < relStartFrame) {
        const decProg = Math.min(1, (n - atkFrames) / decFrames);
        env = amp * (1 - decProg * (1 - sus));
      } else {
        const relProg = (n - relStartFrame) / relFrames;
        if (relProg >= 1) break;
        env = amp * sus * (1 - relProg) * (1 - relProg);
      }

      // Advance wavetable phase
      const wtIdx = Math.floor(phase * wtLen) & (wtLen - 1);
      const rawOsc = wtSamples[wtIdx];
      const subOsc = Math.sin(2 * Math.PI * subPhase) * subMix;

      phase += curFreq / sampleRate;
      if (phase >= 1) phase -= Math.floor(phase);
      subPhase += (curFreq * 0.5) / sampleRate;
      if (subPhase >= 1) subPhase -= Math.floor(subPhase);

      // Filter envelope interpolation
      const filtProg = Math.min(1, n / (decFrames * 1.5));
      const alpha = alphaStart + filtProg * (alphaEnd - alphaStart);
      lpState = lpState + alpha * (rawOsc + subOsc - lpState);

      const sample = (inst.filterType === "highpass" ? (rawOsc - lpState) : lpState) * env;
      leftBuf[f] += sample * gainL;
      rightBuf[f] += sample * gainR;
    }
  }

  /**
   * Direct-DSP SID Percussion Renderer (Kick / Tom / Snare / Hi-Hat / Crash)
   */
  function renderPercNoteToPcm(
    leftBuf, rightBuf, noiseSamples, sampleRate,
    startFrame, midiNote, amp, gainL, gainR
  ) {
    const noiseLen = noiseSamples.length;
    if (midiNote <= 44) {
      // Kick / Tom
      const durFrames = Math.floor(0.16 * sampleRate);
      const startFreq = midiNote <= 36 ? 155 : 210;
      const endFreq = midiNote <= 36 ? 32 : 52;
      let phase = 0;
      const endF = Math.min(leftBuf.length, startFrame + durFrames);
      for (let f = startFrame; f < endF; f++) {
        const prog = (f - startFrame) / durFrames;
        const freq = startFreq * Math.pow(endFreq / startFreq, prog);
        const env = amp * 1.35 * Math.pow(1 - prog, 2.2);
        const tri = phase < 0.5 ? (4 * phase - 1) : (3 - 4 * phase);
        phase += freq / sampleRate;
        if (phase >= 1) phase -= 1;
        const s = tri * env;
        leftBuf[f] += s * gainL;
        rightBuf[f] += s * gainR;
      }
    } else if (midiNote <= 56) {
      // Snare / Rim
      const durFrames = Math.floor(0.15 * sampleRate);
      let phase = 0;
      let bpState = 0;
      const endF = Math.min(leftBuf.length, startFrame + durFrames);
      for (let f = startFrame; f < endF; f++) {
        const n = f - startFrame;
        const prog = n / durFrames;
        const envNoise = amp * 1.05 * Math.pow(1 - prog, 1.8);
        const envBody = prog < 0.5 ? amp * 0.85 * (1 - prog * 2) : 0;
        const freq = 220 * Math.pow(90 / 220, Math.min(1, prog * 2));
        const body = Math.sin(2 * Math.PI * phase) * envBody;
        phase += freq / sampleRate;
        const rawN = noiseSamples[(f * 3) % noiseLen];
        bpState = bpState + 0.28 * (rawN - bpState);
        const s = body + bpState * envNoise;
        leftBuf[f] += s * gainL;
        rightBuf[f] += s * gainR;
      }
    } else {
      // Closed Hat / Open Hat / Crash Cymbal
      const hatDur = midiNote >= 72 ? 0.30 : midiNote >= 68 ? 0.17 : 0.052;
      const durFrames = Math.floor(hatDur * sampleRate);
      let prevN = 0;
      const endF = Math.min(leftBuf.length, startFrame + durFrames);
      for (let f = startFrame; f < endF; f++) {
        const prog = (f - startFrame) / durFrames;
        const env = amp * 0.75 * Math.pow(1 - prog, 2.0);
        const curN = noiseSamples[(f * 7) % noiseLen];
        const hp = curN - prevN;
        prevN = curN * 0.82;
        const s = hp * env * 0.65;
        leftBuf[f] += s * gainL;
        rightBuf[f] += s * gainR;
      }
    }
  }

  function encodeStereoPcmToWavBlob(ch0, ch1, sampleRate) {
    const numChannels = 2;
    const numFrames = ch0.length;
    const dataLength = numFrames * numChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      // Soft tanh master limiter so chords never clip harshly
      const l = Math.tanh(ch0[i] * 0.95);
      const r = Math.tanh(ch1[i] * 0.95);
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
      view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 4;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  window.FACG_SID = {
    FlamableCampingGasSID,
    buildWavetableData,
    noteToMidi,
    midiToNote,
    formatDuration,
    NOTE_NAMES
  };
})();
