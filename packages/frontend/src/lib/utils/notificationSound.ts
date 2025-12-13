/**
 * Notification Sound Utility
 *
 * Generates and plays notification sounds using Web Audio API
 */

import type {
  NotificationSound,
  NotificationSoundType,
  NotificationSoundsByType,
} from "../types/uiSettings";

let audioContext: AudioContext | null = null;

/**
 * Get or create AudioContext (lazy initialization)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a simple tone
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Envelope: fade in and out
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + duration * 0.5);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

/**
 * Play the default notification sound (two-tone chime)
 */
function playDefaultSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.3; // Scale down for comfortable listening

  // Two ascending tones
  playTone(ctx, 880, 0.1, vol, "sine"); // A5
  setTimeout(() => {
    playTone(ctx, 1047, 0.15, vol, "sine"); // C6
  }, 100);
}

/**
 * Play a soft notification sound (gentle ping)
 */
function playSoftSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.2;

  // Single soft tone with harmonics
  playTone(ctx, 523, 0.2, vol, "sine"); // C5
}

/**
 * Play a bell notification sound
 */
function playBellSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.25;

  // Bell-like sound with multiple frequencies
  const frequencies = [523, 659, 784]; // C5, E5, G5 (C major chord)
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      playTone(ctx, freq, 0.3, vol * (1 - i * 0.2), "triangle");
    }, i * 30);
  });
}

/**
 * Play a pop notification sound (short descending tone)
 */
function playPopSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.25;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  // Descending pitch from 1500Hz to 800Hz
  oscillator.frequency.setValueAtTime(1500, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);

  gainNode.gain.setValueAtTime(vol, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.08);
}

/**
 * Play a chirp notification sound (bird-like chirp)
 */
function playChirpSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.2;

  const notes = [
    { freq: 2000, delay: 0 },
    { freq: 2400, delay: 50 },
    { freq: 2000, delay: 100 },
  ];

  notes.forEach(({ freq, delay }) => {
    setTimeout(() => {
      playTone(ctx, freq, 0.05, vol, "sine");
    }, delay);
  });
}

/**
 * Play a synth notification sound (electronic/modern)
 */
function playSynthSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.15;

  // Layer sine and sawtooth for richer sound
  const oscillator1 = ctx.createOscillator();
  const oscillator2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator1.type = "sine";
  oscillator2.type = "sawtooth";
  oscillator1.frequency.setValueAtTime(440, ctx.currentTime); // A4
  oscillator2.frequency.setValueAtTime(440, ctx.currentTime);

  // Envelope
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(vol * 0.6, ctx.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

  oscillator1.start(ctx.currentTime);
  oscillator2.start(ctx.currentTime);
  oscillator1.stop(ctx.currentTime + 0.2);
  oscillator2.stop(ctx.currentTime + 0.2);
}

/**
 * Play a wood notification sound (xylophone-like)
 */
function playWoodSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.3;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5

  // Quick attack, fast decay for wood-like sound
  gainNode.gain.setValueAtTime(vol, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.15);
}

/**
 * Play a drop notification sound (water drop effect)
 */
function playDropSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.25;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  // Rapid descending pitch for water drop effect
  oscillator.frequency.setValueAtTime(2000, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.12);

  gainNode.gain.setValueAtTime(vol, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.12);
}

/**
 * Play notification sound based on type and volume
 *
 * @param soundType - Type of notification sound
 * @param volumePercent - Volume percentage (0-100)
 */
export function playNotificationSound(
  soundType: NotificationSound,
  volumePercent: number = 50,
): void {
  if (soundType === "none" || volumePercent === 0) {
    return;
  }

  // Check if we can play audio
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  const volume = volumePercent / 100;

  try {
    switch (soundType) {
      case "default":
        playDefaultSound(volume);
        break;
      case "soft":
        playSoftSound(volume);
        break;
      case "bell":
        playBellSound(volume);
        break;
      case "pop":
        playPopSound(volume);
        break;
      case "chirp":
        playChirpSound(volume);
        break;
      case "synth":
        playSynthSound(volume);
        break;
      case "wood":
        playWoodSound(volume);
        break;
      case "drop":
        playDropSound(volume);
        break;
    }
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
}

/**
 * Test notification sound (for settings preview)
 */
export function testNotificationSound(
  soundType: NotificationSound,
  volumePercent: number = 50,
): void {
  // Resume audio context if suspended (required for user gesture)
  if (audioContext?.state === "suspended") {
    audioContext.resume();
  }
  playNotificationSound(soundType, volumePercent);
}

/**
 * Play a success/post sound (ascending chime)
 */
function playPostSuccessSound(volume: number): void {
  const ctx = getAudioContext();
  const vol = volume * 0.25;

  // Three ascending tones for success feel
  const notes = [
    { freq: 523, delay: 0 }, // C5
    { freq: 659, delay: 80 }, // E5
    { freq: 784, delay: 160 }, // G5
  ];

  notes.forEach(({ freq, delay }) => {
    setTimeout(() => {
      playTone(ctx, freq, 0.12, vol, "sine");
    }, delay);
  });
}

/**
 * Play sound when a note is successfully posted
 *
 * @param soundType - Sound type from user settings
 * @param volumePercent - Volume percentage (0-100)
 */
export function playPostSound(soundType: NotificationSound, volumePercent: number = 50): void {
  if (soundType === "none" || volumePercent === 0) {
    return;
  }

  // Check if we can play audio
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  const volume = volumePercent / 100;

  try {
    playPostSuccessSound(volume);
  } catch (error) {
    console.error("Failed to play post sound:", error);
  }
}

/**
 * Play notification sound for a specific notification type
 *
 * Uses per-type settings if available, otherwise falls back to default settings.
 *
 * @param notificationType - The type of notification (follow, mention, reply, etc.)
 * @param soundsByType - Per-type sound settings (optional)
 * @param defaultSound - Default sound type to use if no per-type setting
 * @param defaultVolume - Default volume to use if no per-type setting
 */
export function playNotificationSoundForType(
  notificationType: NotificationSoundType,
  soundsByType: NotificationSoundsByType | undefined,
  defaultSound: NotificationSound,
  defaultVolume: number,
): void {
  // Check for per-type settings first
  const typeSettings = soundsByType?.[notificationType];

  if (typeSettings) {
    // Use per-type settings
    playNotificationSound(typeSettings.sound, typeSettings.volume);
  } else {
    // Fall back to default settings
    playNotificationSound(defaultSound, defaultVolume);
  }
}
