// The tool bar under the game. Tools are earned by beating rooms, or found
// inside them, and can be picked up in any room, though each one only does
// something where it's needed.

export type ToolId = "glue" | "saw";

export interface Tool {
  id: ToolId;
  name: string;
  // The tool is yours once this room number is unlocked, so glue (3) arrives
  // the moment you beat Workbench. Tools without one have to be found.
  unlockedAtRoom?: number;
  icon: string;
}

export const TOOLBAR_SLOTS = 4;

export const TOOLS: Tool[] = [
  {
    id: "glue",
    name: "Glue",
    unlockedAtRoom: 3,
    icon: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M13 9 L16 1 L19 9 Z" fill="#f08a24" />
      <rect x="9" y="9" width="14" height="21" rx="3" fill="#f4f4f0" />
      <rect x="9" y="15" width="14" height="8" fill="#3a7bd5" />
      <circle cx="20" cy="4" r="1.6" fill="#f4f4f0" />
    </svg>`,
  },
  {
    // Taken out of the mirror in The Room With Nothing, after the hole.
    id: "saw",
    name: "Saw",
    icon: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M2 17 L20 12 L20 23 L18 25 L16 23 L14 25 L12 23 L10 25 L8 23 L6 25 L4 23 L2 23 Z" fill="#c9d1d6" />
      <rect x="19" y="9" width="11" height="16" rx="4" fill="#b5552b" />
      <rect x="22" y="13" width="5" height="8" rx="2" fill="#3a2a22" />
    </svg>`,
  },
];

const foundThisVisit = new Set<ToolId>();
let onFound = (): void => {};

const foundKey = (id: ToolId): string => `zero-logic-escape-rooms-found-${id}`;

export function hasFound(id: ToolId): boolean {
  if (foundThisVisit.has(id)) return true;
  try {
    return localStorage.getItem(foundKey(id)) === "true";
  } catch {
    return false;
  }
}

export function findTool(id: ToolId): void {
  foundThisVisit.add(id);
  try {
    localStorage.setItem(foundKey(id), "true");
  } catch {
    // Only kept until the page reloads.
  }
  onFound();
}

export function whenToolFound(callback: () => void): void {
  onFound = callback;
}

export function ownsTool(tool: Tool, unlockedRooms: number): boolean {
  return tool.unlockedAtRoom === undefined ? hasFound(tool.id) : unlockedRooms >= tool.unlockedAtRoom;
}

let selected: ToolId | null = null;

export function selectedTool(): ToolId | null {
  return selected;
}

export function toggleTool(id: ToolId): void {
  selected = selected === id ? null : id;
}
