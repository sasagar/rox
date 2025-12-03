/**
 * Notification Sound Utility
 *
 * Generates and plays notification sounds using Web Audio API
 */

import type { NotificationSound } from "../types/uiSettings";

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
