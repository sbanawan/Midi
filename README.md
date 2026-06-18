# MIDI Pedal Control

A responsive, **reference-only** web app for driving four MIDI pedals from a
Neural DSP **Quad Cortex**:

- **Hologram Chroma Console** (multi-effect)
- **Chase Bliss Habit** (echo collector)
- **Chase Bliss Reverse Mode C** (multidirectional delay)
- **Chase Bliss Tonal Recall** (analog delay)

It shows the exact settings to dial in: every controllable parameter, its MIDI
CC number and value range, the channel to send on, and how to set up **MIDI
clock sync** from the QC. It does **not** send MIDI (yet) — it's a reference you
can open on your phone while you patch things up.

## Run it

It's a static site — no build step.

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a browser. Hostable as-is on GitHub Pages.

## Screens

- **Pedals** — one card per pedal. Tap to see all controls grouped by section
  (knobs, toggles, switches, dip switches, etc.). Each control shows
  `Ch N · CC X` plus an interactive slider / option picker so you can read off
  the value to send. Each pedal's MIDI channel is configurable (saved in your
  browser) with duplicate-channel warnings.
- **Cheat sheet** — one live reference page: tick controls across any of the
  pedals and it compiles every `Ch · CC = value` to send from the QC, with a
  Copy‑all button. Selections persist on the device.
- **Recipes** — save your favourite settings for "various effects". A recipe
  captures knob/switch values across any of the pedals (plus an optional tempo
  and notes); the read-only view lists exactly what to dial in per pedal and the
  `Ch N · CC X = value` to send from the QC. Stored in your browser
  (localStorage).
- **Quad Cortex** — the channel map, how to add MIDI Out messages to a preset,
  and the QC's MIDI device settings.
- **Clock sync** — step-by-step MIDI clock setup with the QC as master, plus
  what each pedal needs to follow clock.
- **MIDI out** — optional live sending via the Web MIDI API (Chrome/Edge on
  desktop/Android; not Safari/iOS). Connect, pick an output port (defaults to
  the Quad Cortex), and either turn on **Live send** (each control change is
  pushed immediately as a CC) or hit **Send all**. Routing is the user's
  choice; the page documents the QC‑over‑USB setup.
- **Sources** — links to the official documentation every value came from.

## Channels

Each pedal is on its own MIDI channel (default Chroma 1, Habit 2, Reverse Mode C
3, Tonal Recall 4 — change freely). **Note:** Chase Bliss pedals ship on channel
2, so the three of them must be re-channeled. The procedure: hold both
footswitches while powering up the pedal, then send a Program Change on the
desired channel — the pedal adopts it permanently. The Chroma Console's channel
is set in its Global Settings menu (TILT knob, 1–16).

## Data accuracy

All CC numbers and ranges are transcribed from official documentation:

- Chase Bliss **Habit**, **Reverse Mode C**, **Tonal Recall** — the
  manufacturer's official **MIDI Manual** PDFs.
- Hologram **Chroma Console** — the official user manual's **MIDI
  Implementation Chart** (verbatim).
- **Quad Cortex** — the Neural DSP user manual (MIDI section).

The pedal MIDI data lives in `js/data.js` and is structured so live Web MIDI
sending can be layered on later without touching the content.

## Project layout

```
index.html      # shell + tab nav
css/styles.css  # responsive, mobile-first styling
js/data.js      # verified MIDI data (pedals, QC, clock sync, sources)
js/app.js       # rendering + routing + channel persistence
```
