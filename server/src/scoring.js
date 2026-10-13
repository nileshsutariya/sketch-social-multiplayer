export const guessScore = (remaining, duration) =>
  100 + Math.round(400 * Math.max(0, Math.min(1, remaining / duration)));
