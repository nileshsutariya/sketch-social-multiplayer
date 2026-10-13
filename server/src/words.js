export const words = [
  "airplane",
  "butterfly",
  "mountain",
  "bicycle",
  "elephant",
  "rainbow",
  "snowman",
  "guitar",
  "castle",
  "sunflower",
  "dinosaur",
  "umbrella",
  "robot",
  "pirate",
  "volcano",
  "penguin",
  "rocket",
  "watermelon",
  "lighthouse",
  "octopus",
];
export const normalize = (value) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");
export function closeGuess(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return a.length >= 3 && rows[a.length][b.length] === 1;
}
