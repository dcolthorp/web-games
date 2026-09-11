// The tool bar under the game. Tools are earned by beating rooms and can be
// picked up in any room, though each one only does something where it's needed.

export type ToolId = "glue";

export interface Tool {
  id: ToolId;
  name: string;
  // The tool is yours once this room number is unlocked, so glue (3) arrives
  // the moment you beat Workbench.
  unlockedAtRoom: number;
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
];

let selected: ToolId | null = null;

export function selectedTool(): ToolId | null {
  return selected;
}

export function toggleTool(id: ToolId): void {
  selected = selected === id ? null : id;
}
