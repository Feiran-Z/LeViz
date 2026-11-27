let context: AudioContext | null = null;

/**
 * A short two-tone chime for the end of a teach segment. No audio asset; the
 * context is created lazily on a user gesture (Start or the sound toggle).
 */
export function playChime(): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    context ??= new AudioCtor();
    const audio = context;
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();

    const start = audio.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + index * 0.18;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.4);
    });
  } catch {
    // Audio is optional; unsupported or blocked browsers stay silent.
  }
}
