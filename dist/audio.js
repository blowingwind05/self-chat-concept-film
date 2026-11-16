/* Original, locally synthesized sound design. No audio files or network requests. */
(() => {
  "use strict";

  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const SCENE_TIMES = [10, 35, 55, 73, 87, 115, 136, 147, 161, 171, 181, 200, 222, 234, 248, 268, 280, 292, 312];
  const MESSAGE_TIMES = [88, 90, 92, 94, 96, 98, 100, 102, 104];
  const CHORD_TIMES = [0.4, 36, 74.2, 116.2, 148.2, 182.2, 223.2, 269.2, 313.2];
  const TONES = [523.251, 587.33, 659.255, 783.991, 880];

  const cues = [
    ...SCENE_TIMES.map((time, index) => ({ time, type: "paper", index })),
    ...MESSAGE_TIMES.map((time, index) => ({ time, type: "message", index })),
    ...CHORD_TIMES.map((time, index) => ({ time, type: "chord", index })),
    { time: 139.4, type: "message", index: 2 },
    { time: 145, type: "message", index: 4 },
    { time: 158, type: "resolve", index: 0 },
    { time: 322.3, type: "resolve", index: 1 },
  ].sort((a, b) => a.time - b.time);

  function nextCue(time) {
    let low = 0;
    let high = cues.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (cues[middle].time <= time + 0.018) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  class InboxFilmSound {
    constructor({ duration = 325 } = {}) {
      this.duration = Number.isFinite(duration) && duration > 0 ? duration : 325;
      this.supported = Boolean(AudioEngine);
      this.muted = false;
      this._context = null;
      this._master = null;
      this._limiter = null;
      this._noise = null;
      this._voices = new Set();
      this._playing = false;
      this._timeline = 0;
      this._cursor = 0;
      this._destroyed = false;
      this._unlocking = null;
    }

    async unlock() {
      if (!this.supported || this._destroyed) return false;
      if (this._unlocking) return this._unlocking;
      this._unlocking = this._unlock();
      try {
        return await this._unlocking;
      } finally {
        this._unlocking = null;
      }
    }

    async _unlock() {
      try {
        // Creation and resume happen only in this explicit, gesture-driven method.
        if (!this._context) {
          const context = new AudioEngine({ latencyHint: "interactive" });
          this._context = context;
          const master = context.createGain();
          master.gain.value = 0.5;
          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -22;
          limiter.knee.value = 14;
          limiter.ratio.value = 5;
          limiter.attack.value = 0.004;
          limiter.release.value = 0.22;
          master.connect(limiter);
          limiter.connect(context.destination);
          this._master = master;
          this._limiter = limiter;
          this._noise = this._makeNoise();
        }
        if (this._context.state === "suspended") await this._context.resume();
        const ready = this._context.state === "running";
        if (ready && this._playing && !this.muted && !this._voices.size) this._startBed();
        return ready;
      } catch (_) {
        // Silent playback remains usable if the browser cannot grant audio.
        return false;
      }
    }

    setMuted(value) {
      const next = Boolean(value);
      if (next === this.muted) return;
      this.muted = next;
      this._stopVoices();
      this._cursor = nextCue(this._timeline);
      if (this._audible()) this._startBed();
    }

    play(time = this._timeline) {
      if (this._destroyed) return;
      this._timeline = this._safeTime(time);
      this._cursor = nextCue(this._timeline);
      this._playing = this._timeline < this.duration;
      this._stopVoices();
      if (this._audible()) this._startBed();
    }

    pause() {
      this._playing = false;
      this._stopVoices();
    }

    seek(time) {
      if (this._destroyed) return;
      this._timeline = this._safeTime(time);
      this._cursor = nextCue(this._timeline);
      if (this._timeline >= this.duration) this._playing = false;
      this._stopVoices();
      if (this._audible()) this._startBed();
    }

    update(time) {
      if (this._destroyed) return;
      const next = this._safeTime(time);
      const delta = next - this._timeline;
      if (next >= this.duration) {
        this._timeline = next;
        this.pause();
        return;
      }
      if (!this._playing) {
        this._timeline = next;
        this._cursor = nextCue(next);
        return;
      }
      // A scrub, backward seek, or a stalled/hidden tab never replays a cue backlog.
      if (delta < -0.05 || delta > 0.8) {
        this.seek(next);
        return;
      }
      this._timeline = next;
      while (this._cursor < cues.length && cues[this._cursor].time <= next) {
        const cue = cues[this._cursor++];
        if (!this._audible() || next - cue.time > 0.2) continue;
        if (cue.type === "paper") this._paper(cue.index);
        else if (cue.type === "message") this._message(cue.index);
        else if (cue.type === "resolve") this._chord(cue.index + 1, true);
        else this._chord(cue.index, false);
      }
    }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      this._playing = false;
      this._stopVoices();
      this._master?.disconnect();
      this._limiter?.disconnect();
      if (this._context && this._context.state !== "closed") {
        this._context.close().catch(() => {});
      }
      this._noise = null;
      this._master = null;
      this._limiter = null;
      this._context = null;
    }

    _safeTime(value) {
      return Math.max(0, Math.min(this.duration, Number.isFinite(value) ? value : 0));
    }

    _audible() {
      return !this._destroyed && this._playing && !this.muted
        && this._context?.state === "running" && Boolean(this._master);
    }

    _makeNoise() {
      const context = this._context;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.65), context.sampleRate);
      const channel = buffer.getChannelData(0);
      let seed = 170116;
      let previous = 0;
      for (let i = 0; i < channel.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const white = (seed / 4294967296) * 2 - 1;
        // The reusable noise is softened before the additional per-voice filtering.
        previous = previous * 0.72 + white * 0.28;
        channel[i] = previous;
      }
      return buffer;
    }

    _track(source, gain, nodes, endAt) {
      const voice = { source, gain, nodes, finished: false };
      const finish = () => {
        if (voice.finished) return;
        voice.finished = true;
        this._voices.delete(voice);
        source.onended = null;
        for (const node of nodes) {
          try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
        }
      };
      voice.finish = finish;
      this._voices.add(voice);
      source.onended = finish;
      source.start(this._context.currentTime);
      if (Number.isFinite(endAt)) source.stop(endAt);
    }

    _stopVoices() {
      const now = this._context?.currentTime ?? 0;
      for (const voice of [...this._voices]) {
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(0, now);
          voice.source.stop(now);
        } catch (_) { /* A voice can naturally end in the same frame. */ }
        voice.finish();
      }
    }

    _startBed() {
      if (!this._audible()) return;
      const context = this._context;
      const now = context.currentTime;
      // A very quiet tonic/fifth remains below the point where it competes with text.
      [65.406, 98, 130.812].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const lowpass = context.createBiquadFilter();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.detune.setValueAtTime(index === 1 ? 2 : -1, now);
        lowpass.type = "lowpass";
        lowpass.frequency.value = 340;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(index === 2 ? 0.006 : 0.009, now + 2.8);
        oscillator.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(this._master);
        this._track(oscillator, gain, [oscillator, lowpass, gain]);
      });
    }

    _message(index) {
      const context = this._context;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = "sine";
      const frequency = TONES[index % TONES.length];
      oscillator.frequency.setValueAtTime(frequency * 1.035, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.065);
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.042, now + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this._master);
      this._track(oscillator, gain, [oscillator, filter, gain], now + 0.26);
    }

    _paper(index) {
      const context = this._context;
      const now = context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      source.buffer = this._noise;
      source.playbackRate.value = index % 2 ? 0.92 : 1.03;
      filter.type = "bandpass";
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(430, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.17);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.48);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.17);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._master);
      this._track(source, gain, [source, filter, gain], now + 0.6);
    }

    _chord(index, resolve) {
      const context = this._context;
      const now = context.currentTime;
      const harmonies = [
        [261.626, 391.995, 587.33],
        [220, 329.628, 523.251],
        [261.626, 349.228, 523.251],
      ];
      const notes = resolve ? [261.626, 391.995, 523.251] : harmonies[index % harmonies.length];
      notes.forEach((frequency, noteIndex) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + noteIndex * 0.07;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(resolve ? 0.022 : 0.014, start + 0.055);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (resolve ? 3.6 : 2.8));
        oscillator.connect(gain);
        gain.connect(this._master);
        this._track(oscillator, gain, [oscillator, gain], start + 3.8);
      });
    }
  }

  window.InboxFilmSound = InboxFilmSound;
})();
