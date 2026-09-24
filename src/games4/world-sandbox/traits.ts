// What a person can be born with, or be given. Kept on its own so the roster
// can read it without dragging in everything that draws.

export interface Trait {
  id: string;
  name: string;
  about: string;
}

export const TRAITS: Trait[] = [
  { id: "brave", name: "Brave", about: "charges at enemies from further away" },
  { id: "strong", name: "Strong", about: "hits harder and takes more hits" },
  { id: "fast", name: "Fast", about: "moves twice as fast" },
  { id: "peaceful", name: "Peaceful", about: "never starts a fight" },
  { id: "explorer", name: "Explorer", about: "wanders far from home" },
  { id: "builder", name: "Builder", about: "builds new villages, and sometimes whole new tribes" },
  { id: "healer", name: "Healer", about: "heals hurt people from their tribe" },
  { id: "miner", name: "Miner", about: "finds the nearest cave and won't come out until every ore is mined" },
];

export const traitName = (id: string): string => TRAITS.find((t) => t.id === id)?.name ?? id;
