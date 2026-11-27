let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    context ??= new AudioCtor();
    return context;
  } catch {
    return null;
  }
}

/** Call from a user gesture (Start or enabling sound) to unlock audio. */
export function primeChime(): void {
  const audio = audioContext();
  if (audio && audio.state === 'suspended') void audio.resume();
}

/**
 * A short two-tone chime for the end of a teach segment. No audio asset; the
 * context is primed by a user gesture before the chime is needed.
 */
export function playChime(): void {
  const audio = audioContext();
  if (!audio) return;
  try {
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
