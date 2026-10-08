import { AudioEngine } from './audio-engine.js';
const $ = id => document.getElementById(id);
const engine = new AudioEngine(playing => {
  $('start').disabled = playing;
  $('stop').disabled = !playing;
  $('status').textContent = playing ? 'Playing · headphones recommended' : 'Stopped';
  $('status').classList.toggle('playing', playing);
});

const fields = {
  carrier: ['carrier', v => Number(v)], beat: ['beat', Number],
  volume: ['volume', Number], period: ['period', Number],
  pulseMs: ['pulseMs', Number], pitchVariation: ['pitchVariation', Number],
  attackMs: ['attackMs', Number], releaseMs: ['releaseMs', Number],
  waveform: ['waveform', String], mode: ['mode', String],
  binaural: ['binaural', v => v]
};

function refresh() {
  const s = engine.settings;
  const labels = {
    carrier: `${s.carrier.toFixed(0)} Hz`, beat: `${s.beat.toFixed(1)} Hz`,
    volume: `${s.volume}%`, period: `${s.period.toFixed(1)} s`,
    pulseMs: `${s.pulseMs} ms`, pitchVariation: `${s.pitchVariation} Hz`,
    attackMs: `${s.attackMs} ms`, releaseMs: `${s.releaseMs} ms`
  };
  for (const [key, label] of Object.entries(labels)) $(`${key}Value`).textContent = label;
  $('leftFreq').textContent = `${s.carrier.toFixed(1)} Hz`;
  $('rightFreq').textContent = `${(s.carrier + (s.binaural ? s.beat : 0)).toFixed(1)} Hz`;
  $('modeDescription').textContent = ({
    continuous: 'Unbroken stereo tones, with no audible pulse gating.',
    pulse: 'Same-pitch pulse followed by silence.',
    alternate: 'Two alternating pitches, each followed by silence.',
    pattern: 'Three pitches in a repeating, separated rhythmic pattern.',
    overlap: 'Three pitched pulses overlap, producing a layered rhythm.'
  })[s.mode];
  $('rhythmControls').hidden = s.mode === 'continuous';
  $('pitchVariationRow').hidden = s.mode === 'continuous' || s.mode === 'pulse';
  $('binauralLabel').textContent = s.binaural ? 'On · separate left/right tones' : 'Off · identical left/right tones';
}

for (const [key, [id, convert]] of Object.entries(fields)) {
  const el = $(id);
  const event = el.type === 'range' ? 'input' : 'change';
  el.addEventListener(event, () => {
    const value = el.type === 'checkbox' ? el.checked : convert(el.value);
    engine.update({ [key]: value });
    refresh();
  });
}

$('start').addEventListener('click', async () => {
  try {
    $('error').hidden = true;
    await engine.start();
  } catch (e) {
    $('error').textContent = `Unable to start audio: ${e.message}`;
    $('error').hidden = false;
  }
});
$('stop').addEventListener('click', () => engine.stop());
$('theta').addEventListener('click', () => applyBeat(6));
$('offbeat').addEventListener('click', () => { $('binaural').checked = false; engine.update({binaural: false}); refresh(); });
function applyBeat(value) { $('beat').value = String(value); engine.update({beat:value}); refresh(); }
window.addEventListener('pagehide', () => engine.dispose());
refresh();
