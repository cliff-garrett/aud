/** Native Web Audio stereo binaural synthesizer. No third-party dependencies. */
export class AudioEngine {
  constructor(onState = () => {}) {
    this.onState = onState;
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.voices = new Set();
    this.continuous = null;
    this.running = false;
    this.nextTime = 0;
    this.step = 0;
    this.settings = {
      carrier: 200, beat: 6, volume: 25, waveform: 'sine',
      mode: 'pattern', period: 1.5, pulseMs: 220,
      pitchVariation: 15, attackMs: 20, releaseMs: 65,
      binaural: true
    };
  }

  async start() {
    if (this.running) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Web Audio API is not supported in this browser.');
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    await this.ctx.resume();
    this.running = true;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.outputGain(), now, 0.025);
    this.resetVoices(now + 0.05);
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
    this.onState(true);
  }

  /** Reconfigure without rebuilding the AudioContext. */
  update(patch) {
    const prior = this.settings;
    this.settings = { ...prior, ...patch };
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;
    if (patch.volume !== undefined) {
      this.master.gain.setTargetAtTime(this.outputGain(), now, 0.04);
    }
    // Continuous audio can smoothly retune without a restart.
    if (this.continuous) {
      const s = this.settings;
      if (patch.carrier !== undefined || patch.beat !== undefined || patch.binaural !== undefined) {
        this.continuous.left.frequency.setTargetAtTime(s.carrier, now, 0.035);
        this.continuous.right.frequency.setTargetAtTime(s.carrier + (s.binaural ? s.beat : 0), now, 0.035);
      }
    }
    // Tone color or rhythm change affects topology: fade older voices, create fresh ones.
    const structural = ['mode', 'waveform', 'period', 'pulseMs', 'pitchVariation', 'attackMs', 'releaseMs'];
    if (structural.some(k => patch[k] !== undefined)) {
      this.resetVoices(now + 0.045);
      this.schedule();
    }
    // Scheduled pulse voices use the latest carrier/offset automatically on the next pulse.
  }

  outputGain() {
    // Hard cap per-channel output, independent of OS/device volume.
    return 0.12 * Math.max(0, Math.min(100, this.settings.volume)) / 100;
  }

  makeStereoVoice(leftHz, rightHz, start, duration = null, pitchType = this.settings.waveform) {
    const ctx = this.ctx;
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    left.type = right.type = pitchType;
    left.frequency.setValueAtTime(leftHz, start);
    right.frequency.setValueAtTime(rightHz, start);
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    leftGain.gain.setValueAtTime(0, start);
    rightGain.gain.setValueAtTime(0, start);
    const merger = ctx.createChannelMerger(2);
    left.connect(leftGain);
    right.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(this.master);
    const voice = { left, right, leftGain, rightGain, merger, start, stopped: false };
    this.voices.add(voice);
    left.onended = () => {
      this.voices.delete(voice);
      try { left.disconnect(); right.disconnect(); leftGain.disconnect(); rightGain.disconnect(); merger.disconnect(); } catch (_) {}
    };
    left.start(start);
    right.start(start);
    if (duration !== null) this.envelope(voice, start, duration);
    return voice;
  }

  envelope(voice, start, duration) {
    const s = this.settings;
    const attack = Math.min(s.attackMs / 1000, duration * 0.30);
    const release = Math.min(s.releaseMs / 1000, duration * 0.40);
    const end = start + duration;
    for (const gain of [voice.leftGain.gain, voice.rightGain.gain]) {
      gain.setValueAtTime(0, start);
      gain.linearRampToValueAtTime(0.75, start + Math.max(0.005, attack));
      gain.setValueAtTime(0.75, Math.max(start + attack, end - release));
      gain.linearRampToValueAtTime(0, end);
    }
    voice.left.stop(end + 0.01);
    voice.right.stop(end + 0.01);
    voice.stopped = true;
  }

  retireVoice(voice, when) {
    // Cancelling a scheduled pulse may leave an existing stop() time in place;
    // an earlier stop is allowed by Web Audio. The gain ramp avoids clicks.
    for (const gain of [voice.leftGain.gain, voice.rightGain.gain]) {
      gain.cancelScheduledValues(when);
      gain.setValueAtTime(0.75, when);
      gain.linearRampToValueAtTime(0, when + 0.018);
    }
    try { voice.left.stop(when + 0.025); voice.right.stop(when + 0.025); } catch (_) {}
  }

  resetVoices(when) {
    // Retire all previously queued patterns before scheduling the replacement.
    for (const voice of [...this.voices]) {
      if (voice.start >= when) {
        // A future voice can safely be stopped shortly after its start time.
        this.retireVoice(voice, voice.start);
      } else {
        this.retireVoice(voice, when);
      }
    }
    this.continuous = null;
    this.step = 0;
    this.nextTime = when;
    if (this.settings.mode === 'continuous') {
      const s = this.settings;
      const voice = this.makeStereoVoice(s.carrier, s.carrier + (s.binaural ? s.beat : 0), when);
      for (const gain of [voice.leftGain.gain, voice.rightGain.gain]) {
        gain.linearRampToValueAtTime(0.75, when + 0.06);
      }
      this.continuous = voice;
    }
  }

  schedule() {
    if (!this.running || this.settings.mode === 'continuous') return;
    const now = this.ctx.currentTime;
    // Do not accumulate an enormous backlog after a sleeping/background tab wakes.
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.03;
    while (this.nextTime < now + 0.16) {
      const s = this.settings;
      const count = s.mode === 'pulse' ? 1 : s.mode === 'alternate' ? 2 : 3;
      const spacing = s.period / count;
      const index = this.step % count;
      const offsets = s.mode === 'alternate' ? [0, s.pitchVariation] : [0, s.pitchVariation, -s.pitchVariation];
      const offset = s.mode === 'pulse' ? 0 : offsets[index];
      const leftHz = s.carrier + offset;
      const rightHz = leftHz + (s.binaural ? s.beat : 0);
      const duration = s.mode === 'overlap'
        ? Math.max(s.pulseMs / 1000, spacing * 1.4)
        : Math.min(s.pulseMs / 1000, spacing * 0.9);
      this.makeStereoVoice(leftHz, rightHz, this.nextTime, Math.max(0.05, duration));
      this.nextTime += spacing;
      this.step++;
    }
  }

  async stop() {
    if (!this.ctx || !this.running) return;
    this.running = false;
    window.clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.012);
    for (const voice of [...this.voices]) {
      this.retireVoice(voice, Math.max(now + 0.04, voice.start));
    }
    this.continuous = null;
    this.onState(false);
    // Context stays allocated for fast resume; explicit dispose() releases it.
  }

  async dispose() {
    await this.stop();
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.voices.clear();
  }
}
