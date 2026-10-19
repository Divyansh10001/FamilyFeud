/**
 * Family Feud Sound System
 * Controls both native HTML <audio> tags and synthesized Web Audio fallback
 */
class SoundEngine {
  constructor() {
    this.muted = false;
    this.audioCtx = null;
    this.initAudioContext();
    this.setupUserUnlock();
  }

  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !this.audioCtx) {
      try {
        this.audioCtx = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }
  }

  setupUserUnlock() {
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // Play ding sound (Reveal answer)
  playDing() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-ding');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthDing());
    } else {
      this.synthDing();
    }
  }

  // Play strike sound (Buzzer strike)
  playStrike() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-strike');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthStrike());
    } else {
      this.synthStrike();
    }
  }

  // Play player buzz sound (Face-off buzz)
  playBuzz() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-buzz');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthBuzz());
    } else {
      this.synthBuzz();
    }
  }

  // Play victory / round win sound
  playWin() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-win');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthWin());
    } else {
      this.synthWin();
    }
  }

  // Play timer tick sound
  playTick() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-tick');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthTick());
    } else {
      this.synthTick();
    }
  }

  // Play grand prize celebration sound
  playGrandPrize() {
    if (this.muted) return;
    const audioEl = document.getElementById('sound-grandprize');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => this.synthGrandPrize());
    } else {
      this.synthGrandPrize();
    }
  }

  // Play Steal Alert cue
  playStealAlert() {
    if (this.muted) return;
    this.playStrike();
    setTimeout(() => this.synthStealAlert(), 400);
  }

  // Web Audio Synthesizer Fallbacks
  synthDing() {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.5, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio synth error:', e);
    }
  }

  synthStrike() {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(130, now);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(145, now);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.setValueAtTime(0.5, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio synth error:', e);
    }
  }

  synthBuzz() {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio synth error:', e);
    }
  }

  synthWin() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const now = this.audioCtx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0.3, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.5);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.5);
      });
    } catch (e) {
      console.warn('Audio synth error:', e);
    }
  }

  synthTick() {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  synthGrandPrize() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const now = this.audioCtx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.25);
        gain.gain.setValueAtTime(0.3, now + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.7);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.25);
        osc.stop(now + i * 0.25 + 0.7);
      });
    } catch (e) {}
  }

  synthStealAlert() {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }
}

// Global instance
window.soundEngine = new SoundEngine();
