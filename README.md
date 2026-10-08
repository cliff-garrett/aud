# Audio Lab v0.1

Native Web Audio binaural and rhythmic pulse prototype. No dependencies, no accounts, and no external audio assets.

## Run

From the `audio-lab` directory, start a local static web server:

```bash
python -m http.server 8000
```

Open **http://localhost:8000** in a modern browser. (ES modules are more reliable via HTTP than via `file://`.) Click **Start audio**; browsers require user interaction before playing sound. Use stereo headphones at low volume.

## Controls

- Carrier: 100–600 Hz.
- Left-right offset: 0.5–30 Hz; theta preset 6 Hz. Toggle offset off for matched-ear tones.
- Waveforms: sine, triangle, square.
- Playback: continuous, single gated pulse, alternating two pitches, separated three-note pattern, overlapping three-note pattern.
- Pattern period, pulse duration, pitch variation, envelope attack/release, master volume.

`js/audio-engine.js` contains the synthesizer and lookahead scheduler; `js/app.js` contains the UI bindings.

## Limitations of first prototype

- Audio starts only after pressing Start.
- Frequency changes take effect immediately for continuous mode or on the next scheduled pulse for patterned modes.
- This prototype does not yet include timers, preset persistence, background noise, calibrated SPL output, or recording/export.
- Browser background throttling can disrupt the rhythm after switching away from the page; the lookahead scheduler mitigates normal foreground timer jitter.
- Overlap mode intentionally lengthens pulses to at least 140% of pulse spacing. Pattern mode limits pulse duration to keep pauses audible.
- Stereo channels require headphones for binaural listening.

Not a medical device. Avoid listening if it worsens tinnitus or causes discomfort. No specific frequency is known to reliably induce a theta brain state or treat ADHD/sleep conditions.
"# aud" 
