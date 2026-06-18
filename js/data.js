/*
 * MIDI Pedal Control — verified data layer
 * ---------------------------------------------------------------------------
 * Every CC number, range and behaviour below is sourced from official
 * documentation (or the open dataset that transcribes it). See SOURCES at the
 * bottom of this file, and the `sources` array on each pedal.
 *
 * This is a REFERENCE app: it shows you the settings to dial in by hand on the
 * pedals and the Quad Cortex. It does not send MIDI (yet). The control values
 * shown (CC numbers + ranges) are exactly what you would send if/when live
 * MIDI is added later.
 *
 * NOTE ON CHANNELS: Chase Bliss pedals ship on MIDI channel 2 by default.
 * Because three of your pedals are Chase Bliss, they would all respond on
 * channel 2 at once unless re-channeled. The app assigns each pedal its own
 * channel; the "Quad Cortex" tab explains the one-time procedure to set them.
 */

// Default channel assignment (1-16). Order is arbitrary — they just need to be
// distinct. The user can change these in the UI (persisted to localStorage).
const DEFAULT_CHANNELS = {
  chroma: 1,
  habit: 2,        // Chase Bliss factory default channel — left here so Habit needs no re-channel
  reverseModeC: 3,
  tonalRecall: 4,
};

/* Control "types"
 *   knob     : continuous 0-127 (maps to the physical knob sweep)
 *   toggle   : 3-position toggle switch (values per `options`)
 *   select   : discrete options spanning CC ranges (per `options`)
 *   switch   : on/off (dip switch or footswitch latch)
 *   momentary: a command (tap tempo, clear, etc.)
 */

const PEDALS = [
  /* ---------------------------------------------------------------- CHROMA */
  {
    id: 'chroma',
    name: 'Chroma Console',
    brand: 'Hologram Electronics',
    type: 'Multi-effect',
    accent: '#e8643c',
    midiInput: 'MIDI In / Out / Thru (5-pin DIN) and USB-C. MIDI channel, MIDI routing and clock source are all set in the Global Settings menu.',
    clock: {
      supported: true,
      detail:
        'Receives external MIDI clock and syncs its time-based and modulation effects ' +
        '(e.g. delays/reverbs in Diffusion and the Movement modulations) to it. Tap tempo ' +
        'and clock can also speed up/down Gesture recordings.',
      enableNote:
        'No CC needed — in Global Settings set MIDI CLOCK SOURCE (Auto / USB MIDI / DIN MIDI / Internal). ' +
        'Default Auto listens on both USB and DIN. Tap Tempo is CC 93 if you prefer tap.',
    },
    channelDefaultNote: 'Set the MIDI channel in Global Settings (turn the TILT knob; range 1–16).',
    sources: ['hologram-manual'],
    // Source: official Hologram Chroma Console manual — "MIDI IMPLEMENTATION CHART" (transcribed verbatim).
    controls: [
      { section: 'Primary', name: 'Tilt', cc: 64, type: 'knob' },
      { section: 'Primary', name: 'Rate', cc: 66, type: 'knob' },
      { section: 'Primary', name: 'Time', cc: 68, type: 'knob' },
      { section: 'Primary', name: 'Mix', cc: 70, type: 'knob' },
      { section: 'Primary', name: 'Amount (Character)', cc: 65, type: 'knob' },
      { section: 'Primary', name: 'Amount (Movement)', cc: 67, type: 'knob' },
      { section: 'Primary', name: 'Amount (Diffusion)', cc: 69, type: 'knob' },
      { section: 'Primary', name: 'Amount (Texture)', cc: 71, type: 'knob' },
      {
        section: 'Module effect select', name: 'Character module', cc: 16, type: 'select',
        options: [
          { label: 'Drive', min: 0, max: 21 }, { label: 'Sweeten', min: 22, max: 43 },
          { label: 'Fuzz', min: 44, max: 65 }, { label: 'Howl', min: 66, max: 87 },
          { label: 'Swell', min: 88, max: 109 }, { label: 'Off', min: 110, max: 127 },
        ],
      },
      {
        section: 'Module effect select', name: 'Movement module', cc: 17, type: 'select',
        options: [
          { label: 'Doubler', min: 0, max: 21 }, { label: 'Vibrato', min: 22, max: 43 },
          { label: 'Phaser', min: 44, max: 65 }, { label: 'Tremolo', min: 66, max: 87 },
          { label: 'Pitch', min: 88, max: 109 }, { label: 'Off', min: 110, max: 127 },
        ],
      },
      {
        section: 'Module effect select', name: 'Diffusion module', cc: 18, type: 'select',
        options: [
          { label: 'Cascade', min: 0, max: 21 }, { label: 'Reels', min: 22, max: 43 },
          { label: 'Space', min: 44, max: 65 }, { label: 'Collage', min: 66, max: 87 },
          { label: 'Reverse', min: 88, max: 109 }, { label: 'Off', min: 110, max: 127 },
        ],
      },
      {
        section: 'Module effect select', name: 'Texture module', cc: 19, type: 'select',
        options: [
          { label: 'Filter', min: 0, max: 21 }, { label: 'Squash', min: 22, max: 43 },
          { label: 'Cassette', min: 44, max: 65 }, { label: 'Broken', min: 66, max: 87 },
          { label: 'Interference', min: 88, max: 109 }, { label: 'Off', min: 110, max: 127 },
        ],
      },
      { section: 'Secondary', name: 'Sensitivity', cc: 72, type: 'knob' },
      { section: 'Secondary', name: 'Drift (Movement)', cc: 74, type: 'knob' },
      { section: 'Secondary', name: 'Drift (Diffusion)', cc: 76, type: 'knob' },
      { section: 'Secondary', name: 'Output level', cc: 78, type: 'knob' },
      { section: 'Secondary', name: 'Effect vol (Character)', cc: 73, type: 'knob' },
      { section: 'Secondary', name: 'Effect vol (Movement)', cc: 75, type: 'knob' },
      { section: 'Secondary', name: 'Effect vol (Diffusion)', cc: 77, type: 'knob' },
      { section: 'Secondary', name: 'Effect vol (Texture)', cc: 79, type: 'knob' },
      {
        section: 'Bypass', name: 'Standard bypass', cc: 91, type: 'select',
        options: [{ label: 'Bypass', min: 0, max: 63 }, { label: 'Engage', min: 64, max: 127 }],
      },
      {
        section: 'Bypass', name: 'Dual bypass controls', cc: 92, type: 'select',
        options: [
          { label: 'Total bypass', min: 0, max: 31 },
          { label: 'Dual bypass', min: 32, max: 63 },
          { label: 'Total engage', min: 64, max: 127 },
        ],
      },
      {
        section: 'Bypass', name: 'Module bypass — Character', cc: 103, type: 'select',
        options: [{ label: 'Bypass', min: 0, max: 63 }, { label: 'Engage', min: 64, max: 127 }],
      },
      {
        section: 'Bypass', name: 'Module bypass — Movement', cc: 104, type: 'select',
        options: [{ label: 'Bypass', min: 0, max: 63 }, { label: 'Engage', min: 64, max: 127 }],
      },
      {
        section: 'Bypass', name: 'Module bypass — Diffusion', cc: 105, type: 'select',
        options: [{ label: 'Bypass', min: 0, max: 63 }, { label: 'Engage', min: 64, max: 127 }],
      },
      {
        section: 'Bypass', name: 'Module bypass — Texture', cc: 106, type: 'select',
        options: [{ label: 'Bypass', min: 0, max: 63 }, { label: 'Engage', min: 64, max: 127 }],
      },
      {
        section: 'Other functions', name: 'Gesture play / rec', cc: 80, type: 'select',
        options: [{ label: 'Play', min: 0, max: 63 }, { label: 'Record', min: 64, max: 127 }],
      },
      { section: 'Other functions', name: 'Gesture stop / erase', cc: 81, type: 'momentary', usage: '0–127' },
      {
        section: 'Other functions', name: 'Capture', cc: 82, type: 'select',
        options: [{ label: 'Stop / clear', min: 0, max: 43 }, { label: 'Play', min: 44, max: 87 }, { label: 'Record', min: 88, max: 127 }],
      },
      {
        section: 'Other functions', name: 'Capture routing', cc: 83, type: 'select',
        options: [{ label: 'Post-FX', min: 0, max: 63 }, { label: 'Pre-FX', min: 64, max: 127 }],
      },
      { section: 'Other functions', name: 'Tap tempo', cc: 93, type: 'momentary', usage: '0–127' },
      {
        section: 'Other functions', name: 'Filter mode', cc: 84, type: 'select',
        options: [{ label: 'LPF', min: 0, max: 43 }, { label: 'Tilt', min: 44, max: 87 }, { label: 'HPF', min: 88, max: 127 }],
      },
      {
        section: 'Other functions', name: 'Calibration level', cc: 94, type: 'select',
        options: [
          { label: 'Low', min: 0, max: 31 }, { label: 'Medium', min: 32, max: 63 },
          { label: 'High', min: 64, max: 95 }, { label: 'Very high', min: 96, max: 127 },
        ],
      },
      {
        section: 'Other functions', name: 'Calibration menu (enter)', cc: 95, type: 'select',
        options: [{ label: 'Exit', min: 0, max: 63 }, { label: 'Enter', min: 64, max: 127 }],
      },
    ],
    extras: {
      presets: 'Up to 80 user presets (4 banks × 20). Saved/recalled on the pedal via the Copy/Save and Preset Browser menus.',
      globalSettings: 'Global Settings (press A+B+C+D): TILT knob = MIDI channel (1–16) · RATE knob = MIDI routing (Interface / Interface w/o internal clock / Thru / Thru w/o internal clock) · TIME knob = MIDI clock source (Auto / USB MIDI / DIN MIDI / Internal) · AMOUNT (Diffusion) = bypass mode.',
      modules: 'Four rearrangeable effect modules — Character, Movement, Diffusion, Texture — each with 5 effect types. The active effect in each module is MIDI-selectable (CC 16/17/18/19, see "Module effect select"), or chosen with the front-panel buttons. Note: the Chroma cannot recall presets over MIDI (no Program Change support).',
    },
  },

  /* ----------------------------------------------------------------- HABIT */
  {
    id: 'habit',
    name: 'Habit',
    brand: 'Chase Bliss',
    type: 'Echo collector / looper',
    accent: '#4a90d9',
    midiInput:
      'MIDI over 1/4" TRS — Chase Bliss pedals require a Chase Bliss MIDI Box (5-pin DIN → 1/4" TRS) to connect a standard MIDI source.',
    clock: {
      supported: true,
      detail: 'Follows external MIDI clock for time-based parameters.',
      enableNote: 'CC 51 controls clock follow: 0 = ignore clock, 1–127 = listen.',
    },
    sources: ['cb-habit-midi', 'cb-channel'],
    channelDefaultNote: 'Chase Bliss factory default is MIDI channel 2.',
    controls: [
      { section: 'Knobs', name: 'Volume', cc: 14, type: 'knob' },
      { section: 'Knobs', name: 'Repeats', cc: 15, type: 'knob' },
      { section: 'Knobs', name: 'Size', cc: 16, type: 'knob' },
      { section: 'Knobs', name: 'Mod', cc: 17, type: 'knob' },
      { section: 'Knobs', name: 'Spread', cc: 18, type: 'knob' },
      { section: 'Knobs', name: 'Scan', cc: 19, type: 'knob' },
      { section: 'Knobs', name: 'Ramp', cc: 20, type: 'knob' },
      {
        section: 'Toggles', name: 'Mod number', cc: 21, type: 'toggle',
        options: [{ label: 'Position 1', min: 1, max: 1 }, { label: 'Position 2', min: 2, max: 2 }, { label: 'Position 3', min: 3, max: 3 }],
      },
      {
        section: 'Toggles', name: 'Mod bank', cc: 22, type: 'toggle',
        options: [{ label: 'Position 1', min: 1, max: 1 }, { label: 'Position 2', min: 2, max: 2 }, { label: 'Position 3', min: 3, max: 3 }],
      },
      {
        section: 'Toggles', name: 'Mode', cc: 23, type: 'toggle',
        options: [{ label: 'Position 1', min: 1, max: 1 }, { label: 'Position 2', min: 2, max: 2 }, { label: 'Position 3', min: 3, max: 3 }],
      },
      { section: 'Switches', name: 'Loop (R hold)', cc: 24, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Switches', name: 'Scan (L hold)', cc: 25, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Switches', name: 'Clear (both hold)', cc: 26, type: 'momentary', usage: '0–127: clear' },
      { section: 'Switches', name: 'Tap tempo', cc: 93, type: 'momentary', usage: '0–127: send tap' },
      { section: 'Switches', name: 'Bypass / engage', cc: 102, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Other', name: 'MIDI clock ignore', cc: 51, type: 'switch', usage: '0: ignore · 1–127: listen' },
      { section: 'Other', name: 'EOM (Expression over MIDI)', cc: 100, type: 'knob' },
    ],
    extras: {
      presets: 'Up to 122 presets via Program Change. Recall: send PC #. Save: hold both footswitches + send PC #. PC 0 = "Live" mode. Slots 1 & 2 = the on-pedal toggle (1 = right, 2 = left).',
      clockPpqn: 'Responds to MIDI Clock (24 messages per quarter note).',
    },
  },

  /* --------------------------------------------------------- REVERSE MODE C */
  {
    id: 'reverseModeC',
    name: 'Reverse Mode C',
    brand: 'Chase Bliss',
    type: 'Multidirectional delay',
    accent: '#9b59b6',
    midiInput:
      'MIDI over 1/4" TRS — requires a Chase Bliss MIDI Box (5-pin DIN → 1/4" TRS) to connect a standard MIDI source.',
    clock: {
      supported: true,
      detail: 'Syncs delay time to external MIDI clock.',
      enableNote: 'CC 51 controls clock follow: 0 = ignore, 1–127 = follow.',
    },
    sources: ['cb-rmc-midi', 'cb-channel'],
    channelDefaultNote: 'Chase Bliss factory default is MIDI channel 2.',
    controls: [
      { section: 'Knobs', name: 'Time', cc: 14, type: 'knob' },
      { section: 'Knobs', name: 'Mix', cc: 15, type: 'knob' },
      { section: 'Knobs', name: 'Feedback', cc: 16, type: 'knob' },
      { section: 'Knobs', name: 'Offset', cc: 17, type: 'knob' },
      { section: 'Knobs', name: 'Balance', cc: 18, type: 'knob' },
      { section: 'Knobs', name: 'Filter', cc: 19, type: 'knob' },
      { section: 'Knobs', name: 'Ramp speed', cc: 20, type: 'knob' },
      {
        section: 'Toggles', name: 'Mod sync', cc: 21, type: 'select',
        options: [{ label: 'Sync', min: 0, max: 1 }, { label: 'Off', min: 2, max: 2 }, { label: 'Free', min: 3, max: 127 }],
      },
      {
        section: 'Toggles', name: 'Mod type', cc: 22, type: 'select',
        options: [{ label: 'Vibrato', min: 0, max: 1 }, { label: 'Tremolo', min: 2, max: 2 }, { label: 'Freq shift up', min: 3, max: 127 }],
      },
      {
        section: 'Toggles', name: 'Sequence mode', cc: 23, type: 'select',
        options: [{ label: 'Run', min: 0, max: 1 }, { label: 'Off', min: 2, max: 2 }, { label: 'Env', min: 3, max: 127 }],
      },
      {
        section: 'Hidden options', name: 'Sequencer subdivision', cc: 24, type: 'select',
        options: [
          { label: 'x16', min: 0, max: 15 }, { label: 'x8', min: 16, max: 31 },
          { label: 'x4', min: 32, max: 47 }, { label: 'x2', min: 48, max: 63 },
          { label: 'x1', min: 64, max: 79 }, { label: 'x1/2', min: 80, max: 95 },
          { label: 'x1/4', min: 96, max: 111 }, { label: 'x1/8', min: 112, max: 127 },
        ],
      },
      {
        section: 'Hidden options', name: 'Ramping waveform', cc: 25, type: 'select',
        options: [
          { label: 'Triangle', min: 0, max: 14 }, { label: 'Square', min: 15, max: 54 },
          { label: 'Sine', min: 55, max: 80 }, { label: 'Random', min: 81, max: 126 },
          { label: 'Smooth random', min: 127, max: 127 },
        ],
      },
      { section: 'Hidden options', name: 'Mod depth', cc: 27, type: 'knob' },
      { section: 'Hidden options', name: 'Mod rate', cc: 28, type: 'knob' },
      {
        section: 'Hidden options', name: 'Octave type', cc: 31, type: 'select',
        options: [{ label: 'Oct down', min: 0, max: 1 }, { label: 'Both oct', min: 2, max: 2 }, { label: 'Oct up', min: 3, max: 127 }],
      },
      {
        section: 'Hidden options', name: 'Sequence spacing', cc: 33, type: 'select',
        options: [{ label: 'Rest', min: 0, max: 1 }, { label: 'Skip', min: 2, max: 127 }],
      },
      { section: 'Footswitches', name: 'Bypass', cc: 102, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Footswitches', name: 'Tap', cc: 103, type: 'momentary', usage: 'any value (also CC 93)' },
      { section: 'Footswitches', name: 'Alt menu (hold both)', cc: 104, type: 'switch', usage: '0: exit · 1–127: enter' },
      { section: 'Footswitches', name: 'Freeze (hold left)', cc: 105, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Footswitches', name: 'Half speed (hold right)', cc: 106, type: 'switch', usage: '0: normal · 1–127: half speed' },
      { section: 'Dip switches (left bank)', name: 'Time', cc: 61, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Offset', cc: 62, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Balance', cc: 63, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Filter', cc: 64, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Feed', cc: 65, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Bounce', cc: 66, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (left bank)', name: 'Sweep', cc: 67, type: 'switch', usage: '0: B · 1–127: T' },
      { section: 'Dip switches (left bank)', name: 'Polarity', cc: 68, type: 'switch', usage: '0: F · 1–127: R' },
      { section: 'Dip switches (right bank)', name: 'Swap', cc: 71, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Miso', cc: 72, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Spread', cc: 73, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Trails', cc: 74, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Latch', cc: 75, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Feed type', cc: 76, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Fade type', cc: 77, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Dip switches (right bank)', name: 'Mod type', cc: 78, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Other', name: 'MIDI clock ignore', cc: 51, type: 'switch', usage: '0: ignore clock · 1–127: follow clock' },
      { section: 'Other', name: 'Ramp / Bounce (on/off)', cc: 52, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Other', name: 'Factory reset', cc: 56, type: 'momentary', usage: '0–127' },
      { section: 'Other', name: 'Dry kill', cc: 57, type: 'switch', usage: '0: off · 1–127: on' },
      { section: 'Other', name: 'EOM (Expression over MIDI)', cc: 100, type: 'knob' },
      { section: 'Other', name: 'Preset save', cc: 111, type: 'knob', usage: '0–122: preset slot' },
    ],
    extras: {
      presets: 'Up to 122 presets via Program Change. Recall: send PC #. Save: hold both footswitches + send PC #. PC 0 = "Live" mode. Slots 1 & 2 = the on-pedal toggle (1 = right, 2 = left).',
      clockPpqn: 'Syncs to MIDI Clock (24 messages per quarter note).',
      dipNote: 'Dip-switch CC numbers read left-to-right looking down at the top of the pedal: left bank = 61–68, right bank = 71–78.',
    },
  },

  /* ----------------------------------------------------------- TONAL RECALL */
  {
    id: 'tonalRecall',
    name: 'Tonal Recall',
    brand: 'Chase Bliss',
    type: 'Analog delay',
    accent: '#27ae60',
    midiInput:
      'MIDI over 1/4" TRS into the TAP/MIDI jack — requires a Chase Bliss "Modified Empress" MIDIBox (Ring Active). With a standard Empress MIDIBox you must use a TRS cable that swaps tip and ring.',
    clock: {
      supported: true,
      detail: 'Syncs delay time to external MIDI clock, with selectable note division (set on the pedal’s tap-selection toggle or via CC 21).',
      enableNote: 'CC 51 controls clock follow: 0 = ignore, 127 = listen (default 127). Set subdivision with CC 21.',
    },
    sources: ['cb-tr-midi', 'cb-channel'],
    channelDefaultNote: 'Chase Bliss factory default is MIDI channel 2.',
    controls: [
      { section: 'Knobs', name: 'Tone', cc: 14, type: 'knob' },
      { section: 'Knobs', name: 'Mix', cc: 15, type: 'knob' },
      { section: 'Knobs', name: 'Rate', cc: 16, type: 'knob' },
      { section: 'Knobs', name: 'Time', cc: 17, type: 'knob' },
      { section: 'Knobs', name: 'Regen', cc: 18, type: 'knob' },
      { section: 'Knobs', name: 'Depth', cc: 19, type: 'knob' },
      { section: 'Knobs', name: 'Ramp', cc: 20, type: 'knob' },
      {
        section: 'Clock', name: 'MIDI note divisions', cc: 21, type: 'select',
        options: [
          { label: 'Quarter notes', min: 0, max: 0 },
          { label: 'Dotted eighth notes', min: 1, max: 1 },
          { label: 'Eighth-note triplets', min: 2, max: 2 },
          { label: 'Eighth notes', min: 3, max: 3 },
          { label: 'Eighth-note sextolets', min: 4, max: 4 },
          { label: 'Sixteenth notes', min: 5, max: 5 },
        ],
      },
      { section: 'Clock', name: 'MIDI clock ignore', cc: 51, type: 'switch', usage: '0: ignore · 127: listen (default 127)' },
      { section: 'Other', name: 'Tap switch', cc: 93, type: 'momentary', usage: '0–127: tap tempo' },
      { section: 'Other', name: 'Expression', cc: 100, type: 'knob' },
      { section: 'Other', name: 'Bypass', cc: 102, type: 'switch', usage: '0: bypass · 127: engage (resets ramping)' },
    ],
    extras: {
      presets: 'Up to 122 presets via Program Change. Recall: send PC #. Save: hold TAP + BYPASS + send PC #. PC 0 = "Live" mode. Slots 1 & 2 = the on-pedal toggle (1 = right, 2 = left).',
      clockPpqn: 'Responds to MIDI Clock (24 messages per quarter note).',
    },
  },
];

/* ---------------------------------------------------------- QUAD CORTEX --- */
// Source: Neural DSP official Quad Cortex User Manual (MIDI section).
const QC = {
  name: 'Quad Cortex',
  midiOut: 'TRS MIDI (1/4") and/or USB MIDI.',
  deviceSettings: [
    { name: 'MIDI Channel', detail: 'Input channel the QC responds to (or OMNI for all). For SENDING to your pedals you set the channel per command in a preset’s MIDI Out block.' },
    { name: 'MIDI Thru', detail: 'Passes incoming MIDI to MIDI Out. WARNING: when enabled, Preset MIDI Out messages are disabled — leave OFF if the QC is the one sending to the pedals.' },
    { name: 'MIDI Over USB', detail: 'Enable to send/receive MIDI over USB. Required if you want to send MIDI Clock over USB.' },
    { name: 'MIDI Clock Out', detail: 'Toggle clock output over USB and/or TRS MIDI. This is what syncs your delays/mod to the QC tempo.' },
  ],
  presetMidiOut:
    'Each preset has a Preset MIDI Out list of up to 12 messages (Type CC/PC, Channel 1–16, CC#, Value) sent over MIDI DIN + USB when the preset loads. That’s how you control the pedals: build the list per preset. You can enter it on the QC, or faster in Cortex Control on a computer (keyboard/mouse). There is no way to auto-import the list — but the Cheat sheet / a Recipe gives you the exact rows to type. Note the 12-message-per-preset limit; for more, use scene/footswitch MIDI or split across presets.',
  presetMidiOutLimit: 12,
  sources: ['qc-manual'],
};

/* ------------------------------------------------ MIDI CLOCK SYNC STEPS --- */
const CLOCK_SYNC = {
  intro:
    'The Quad Cortex is the clock master. Turn on its MIDI Clock Out, then tell each pedal to follow clock. ' +
    'Set the QC project/preset tempo and every synced effect locks to it.',
  qcSteps: [
    'On the QC, open Settings → MIDI.',
    'Enable MIDI Clock Out for the transport you’re using (TRS MIDI and/or USB). For USB clock, enable “MIDI Over USB” first.',
    'Make sure MIDI Thru is OFF if the QC is also sending CC/PC to the pedals from presets (Thru disables Preset MIDI Out).',
    'Set the tempo on the QC — that BPM is broadcast as MIDI clock.',
  ],
  pedalSteps: [
    { pedal: 'Chroma Console', step: 'Global Settings (press A+B+C+D) → TIME knob sets MIDI Clock Source: leave on Auto (listens on USB + DIN) or pick USB MIDI / DIN MIDI. Its time-based and modulation effects then lock to incoming clock. No CC needed.' },
    { pedal: 'Habit', step: 'Send CC 51 value 1–127 to enable “listen” to clock (CC 51 value 0 ignores clock).' },
    { pedal: 'Reverse Mode C', step: 'Send CC 51 value 1–127 to follow clock (value 0 ignores). Optionally set sequencer subdivision with CC 24.' },
    { pedal: 'Tonal Recall', step: 'CC 51 value 127 = listen (default). Choose note division with CC 21 (0 whole … 5 sixteenth).' },
  ],
  wiringNote:
    'Connectivity reality check: the Chroma Console takes 5-pin DIN (or USB) directly, while the three Chase Bliss pedals need a Chase Bliss MIDI Box each (DIN → 1/4" TRS). Plan a MIDI distribution (e.g. QC MIDI Out → DIN → MIDI thru/splitter → Chroma + each Chase Bliss MIDI Box). Verify TRS-MIDI cable type for your QC output against the manual.',
};

/* ----------------------------------------------------------- SOURCES ----- */
const SOURCES = {
  'hologram-manual': {
    label: 'Hologram Chroma Console — Official User Manual, "MIDI Implementation Chart" (verbatim)',
    url: 'https://www.hologramelectronics.com/pages/chroma-console-manual',
  },
  'cb-habit-midi': {
    label: 'Chase Bliss Habit — Official MIDI Manual (via pencilresearch/midi open dataset)',
    url: 'https://midi.guide/d/chase-bliss/habit/',
  },
  'cb-rmc-midi': {
    label: 'Chase Bliss Reverse Mode C — Official MIDI Manual (via pencilresearch/midi open dataset)',
    url: 'https://www.chasebliss.com/manuals',
  },
  'cb-tr-midi': {
    label: 'Chase Bliss Tonal Recall — Official MIDI Manual (via pencilresearch/midi open dataset)',
    url: 'https://www.chasebliss.com/manuals',
  },
  'cb-channel': {
    label: 'Chase Bliss — Setting MIDI channel (hold both switches on power-up, then send a Program Change)',
    url: 'https://www.chasebliss.com/support',
  },
  'qc-manual': {
    label: 'Neural DSP — Quad Cortex User Manual (MIDI section)',
    url: 'https://neuraldsp.com/manual/quad-cortex',
  },
};
