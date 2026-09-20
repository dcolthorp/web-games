// What a builder calls the tribe they have just wandered off and founded.

const ENDINGS = ["land", "ia", "ton", "burg", "gard", "holm", "vale", "stead"];

export function tribeNameFor(name: string, roll: number): string {
  if (roll < 0.2) return `New ${name}`;
  if (roll < 0.35) return `Free ${name}`;
  const ending = ENDINGS[Math.floor(roll * ENDINGS.length)] ?? "land";
  return `${name}${ending}`;
}
