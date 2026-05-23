export {};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Kind = "platform" | "wall" | "spike" | "goal" | "toast" | "orb";

interface Entity extends Rect {
  id: string;
  kind: Kind;
  color?: string;
  visible: boolean;
  label?: string;
  // When true, the entity stays solid for physics but does not render.
  hidden?: boolean;
}

interface SliderSetting {
  type: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
}
interface CheckboxSetting {
  type: "checkbox";
  id: string;
  label: string;
  value: boolean;
}
interface ColorSetting {
  type: "color";
  id: string;
  label: string;
  value: string;
}
interface SelectSetting {
  type: "select";
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
}
interface PaletteSetting {
  type: "palette";
  id: string;
  label: string;
  options: { key: string; color: string; label: string }[];
  // Currently-preferred color key (background matches it and matching walls blend in).
  // Empty string means no preference (default background, all walls visible).
  value: string;
}
type Setting = SliderSetting | CheckboxSetting | ColorSetting | SelectSetting | PaletteSetting;

interface Level {
  name: string;
  hint: string;
  spawn: { x: number; y: number };
  settings: Setting[];
  build: (values: Record<string, number | string | boolean>) => Entity[];
  worldW?: number;
  worldH?: number;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const settingsBody = document.getElementById("settings-body") as HTMLDivElement;
const settingsHint = document.getElementById("settings-hint") as HTMLParagraphElement;
const levelLabel = document.getElementById("level-label") as HTMLParagraphElement;
const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement;
const canvasWrap = canvas.parentElement!;

const toast = document.createElement("div");
toast.className = "toast";
canvasWrap.appendChild(toast);

const W = canvas.width;
const H = canvas.height;

// ----- Levels -----

const levels: Level[] = [
  {
    name: "Tutorial: The Slider",
    hint: "Raise the platform until you can hop up to the flag.",
    spawn: { x: 60, y: 420 },
    settings: [
      {
        type: "range",
        id: "platform-height",
        label: "Platform Height",
        min: 0,
        max: 260,
        step: 1,
        value: 0,
        unit: "px",
      },
    ],
    build: (v) => {
      const height = v["platform-height"] as number;
      return [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        {
          id: "lift",
          kind: "platform",
          x: 360,
          y: 466 - height,
          w: 180,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        { id: "shelf", kind: "platform", x: 580, y: 200, w: 140, h: 14, visible: true },
        { id: "goal", kind: "goal", x: 640, y: 150, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Uncheck the Wall",
    hint: "There's a wall in your way. Take a look at the checkboxes.",
    spawn: { x: 60, y: 420 },
    settings: [
      { id: "blocker", label: "Show Blocker", type: "checkbox", value: true },
      { id: "ceiling", label: "Show Ceiling Bar", type: "checkbox", value: true },
      {
        id: "step-height",
        type: "range",
        label: "Step Height",
        min: 0,
        max: 280,
        step: 1,
        value: 0,
      },
    ],
    build: (v) => {
      const height = v["step-height"] as number;
      return [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        {
          id: "blocker",
          kind: "wall",
          x: 240,
          y: 380,
          w: 24,
          h: 100,
          visible: v["blocker"] as boolean,
        },
        {
          id: "ceiling",
          kind: "wall",
          x: 360,
          y: 260,
          w: 200,
          h: 18,
          visible: v["ceiling"] as boolean,
        },
        {
          id: "step",
          kind: "platform",
          x: 380,
          y: 466 - height,
          w: 140,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        { id: "shelf", kind: "platform", x: 580, y: 180, w: 140, h: 14, visible: true },
        { id: "goal", kind: "goal", x: 640, y: 130, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Build the Staircase",
    hint: "Three sliders, three platforms. Make a staircase.",
    spawn: { x: 40, y: 420 },
    settings: [
      { type: "range", id: "p1", label: "Platform 1 Height", min: 0, max: 360, step: 1, value: 0 },
      { type: "range", id: "p2", label: "Platform 2 Height", min: 0, max: 360, step: 1, value: 0 },
      { type: "range", id: "p3", label: "Platform 3 Height", min: 0, max: 360, step: 1, value: 0 },
      { type: "checkbox", id: "spikes", label: "Enable Spikes", value: true },
    ],
    build: (v) => {
      const entities: Entity[] = [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        {
          id: "p1",
          kind: "platform",
          x: 150,
          y: 466 - (v["p1"] as number),
          w: 110,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        {
          id: "p2",
          kind: "platform",
          x: 320,
          y: 466 - (v["p2"] as number),
          w: 110,
          h: 14,
          visible: true,
          color: "#a78bfa",
        },
        {
          id: "p3",
          kind: "platform",
          x: 490,
          y: 466 - (v["p3"] as number),
          w: 110,
          h: 14,
          visible: true,
          color: "#f472b6",
        },
        { id: "shelf", kind: "platform", x: 600, y: 100, w: 120, h: 14, visible: true },
        { id: "goal", kind: "goal", x: 640, y: 50, w: 40, h: 50, visible: true },
      ];
      if (v["spikes"] as boolean) {
        entities.push({ id: "spikes", kind: "spike", x: 264, y: 462, w: 48, h: 18, visible: true });
        entities.push({ id: "spikes2", kind: "spike", x: 434, y: 462, w: 48, h: 18, visible: true });
      }
      return entities;
    },
  },
  {
    name: "Physics Preferences",
    hint: "Gravity and jump are settings too. Tune them.",
    spawn: { x: 40, y: 420 },
    settings: [
      { type: "range", id: "gravity", label: "Gravity", min: 400, max: 2400, step: 10, value: 1600 },
      { type: "range", id: "jump", label: "Jump Strength", min: 200, max: 1000, step: 5, value: 680 },
      { type: "range", id: "gap-x", label: "Gap Platform X", min: 200, max: 520, step: 1, value: 200 },
      { type: "checkbox", id: "ceiling", label: "Show Ceiling", value: true },
      {
        type: "select",
        id: "theme",
        label: "Theme",
        options: [
          { value: "night", label: "Night" },
          { value: "dawn", label: "Dawn" },
          { value: "vapor", label: "Vapor" },
        ],
        value: "night",
      },
    ],
    build: (v) => {
      const entities: Entity[] = [
        { id: "ground-left", kind: "platform", x: 0, y: 480, w: 200, h: 40, visible: true },
        { id: "ground-right", kind: "platform", x: 560, y: 480, w: 200, h: 40, visible: true },
        {
          id: "gap-platform",
          kind: "platform",
          x: v["gap-x"] as number,
          y: 360,
          w: 120,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        { id: "goal", kind: "goal", x: 660, y: 430, w: 36, h: 50, visible: true },
        { id: "pit-spike", kind: "spike", x: 200, y: 500, w: 360, h: 20, visible: true },
      ];
      if (v["ceiling"] as boolean) {
        entities.push({ id: "ceiling", kind: "wall", x: 0, y: 0, w: W, h: 30, visible: true });
      }
      return entities;
    },
  },
  {
    name: "Brightness",
    hint: "Dark platforms only appear when brightness is at least halfway up. Light platforms only appear when it's at least halfway down.",
    spawn: { x: 40, y: 420 },
    settings: [
      {
        type: "range",
        id: "brightness",
        label: "Brightness",
        min: 0,
        max: 100,
        step: 1,
        value: 100,
        unit: "%",
      },
    ],
    build: (v) => {
      const brightness = v["brightness"] as number;
      const darkVisible = brightness >= 50;
      const lightVisible = brightness <= 50;
      return [
        { id: "ground-left", kind: "platform", x: 0, y: 480, w: 220, h: 40, visible: true },
        { id: "ledge", kind: "platform", x: 340, y: 320, w: 120, h: 14, visible: true, color: "#5a7ab8" },
        { id: "ground-right", kind: "platform", x: 600, y: 480, w: 160, h: 40, visible: true },
        { id: "pit-spike", kind: "spike", x: 220, y: 502, w: 380, h: 18, visible: true },
        // Dark platforms (visible at high brightness — they're dark, so you need light to see them)
        {
          id: "dark-1",
          kind: "platform",
          x: 170,
          y: 400,
          w: 100,
          h: 14,
          visible: darkVisible,
          color: "#1a2240",
        },
        {
          id: "dark-2",
          kind: "platform",
          x: 270,
          y: 360,
          w: 100,
          h: 14,
          visible: darkVisible,
          color: "#1a2240",
        },
        // Light platforms (visible at low brightness — they glow in the dark)
        {
          id: "light-1",
          kind: "platform",
          x: 470,
          y: 260,
          w: 100,
          h: 14,
          visible: lightVisible,
          color: "#f6f1c4",
        },
        {
          id: "light-2",
          kind: "platform",
          x: 600,
          y: 200,
          w: 120,
          h: 14,
          visible: lightVisible,
          color: "#f6f1c4",
        },
        { id: "goal", kind: "goal", x: 660, y: 150, w: 36, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Font Size",
    hint: "Shrink yourself to squeeze under the overhang.",
    spawn: { x: 40, y: 420 },
    settings: [
      {
        type: "range",
        id: "player-scale",
        label: "Font Size",
        min: 50,
        max: 150,
        step: 5,
        value: 100,
        unit: "%",
      },
      {
        type: "range",
        id: "overhang-y",
        label: "Overhang Y",
        min: 380,
        max: 470,
        step: 1,
        value: 460,
      },
    ],
    build: (v) => {
      const overhangY = v["overhang-y"] as number;
      return [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        // Low overhang the default-sized player cannot fit under.
        {
          id: "overhang",
          kind: "wall",
          x: 200,
          y: 0,
          w: 360,
          h: overhangY,
          visible: true,
          color: "#7c5a9a",
        },
        // High shelf with the flag, reached after passing under.
        { id: "step", kind: "platform", x: 565, y: 380, w: 80, h: 14, visible: true, color: "#6dd3ff" },
        { id: "shelf", kind: "platform", x: 580, y: 250, w: 140, h: 14, visible: true },
        { id: "goal", kind: "goal", x: 640, y: 200, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Notifications",
    hint: "Enable notifications. The toast is your bridge.",
    spawn: { x: 40, y: 420 },
    settings: [
      { type: "checkbox", id: "notify", label: "Enable Notifications", value: false },
      {
        type: "range",
        id: "notify-x",
        label: "Notification X",
        min: 180,
        max: 540,
        step: 1,
        value: 180,
      },
      {
        type: "range",
        id: "notify-y",
        label: "Notification Y",
        min: 180,
        max: 440,
        step: 1,
        value: 380,
      },
      { type: "checkbox", id: "do-not-disturb", label: "Do Not Disturb", value: false },
    ],
    build: (v) => {
      const notifyOn = (v["notify"] as boolean) && !(v["do-not-disturb"] as boolean);
      return [
        { id: "ground-left", kind: "platform", x: 0, y: 480, w: 180, h: 40, visible: true },
        { id: "ground-right", kind: "platform", x: 560, y: 480, w: 200, h: 40, visible: true },
        { id: "pit-spike", kind: "spike", x: 180, y: 502, w: 380, h: 18, visible: true },
        { id: "shelf", kind: "platform", x: 600, y: 240, w: 140, h: 14, visible: true },
        {
          id: "toast",
          kind: "toast",
          x: v["notify-x"] as number,
          y: v["notify-y"] as number,
          w: 180,
          h: 36,
          visible: notifyOn,
          label: "New reminder",
        },
        { id: "goal", kind: "goal", x: 660, y: 190, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Preference Colors",
    hint: "Click a color to make it your preference. The background turns that color — and walls of that color blend in and stop existing.",
    spawn: { x: 30, y: 420 },
    settings: [
      {
        type: "palette",
        id: "preference",
        label: "Preference Color",
        options: [
          { key: "red", color: "#ff6b7a", label: "Red" },
          { key: "yellow", color: "#f6d365", label: "Yellow" },
          { key: "green", color: "#7ee8a3", label: "Green" },
          { key: "blue", color: "#6dd3ff", label: "Blue" },
        ],
        value: "",
      },
    ],
    build: (v) => {
      const pref = v["preference"] as string;
      const colors: Record<string, string> = {
        red: "#ff6b7a",
        yellow: "#f6d365",
        green: "#7ee8a3",
        blue: "#6dd3ff",
      };
      const wall = (id: string, x: number, c: string, y = 250, h = 230): Entity => ({
        id,
        kind: "wall",
        x,
        y,
        w: 26,
        h,
        visible: pref !== c,
        color: colors[c],
      });
      return [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        wall("w-red", 150, "red"),
        wall("w-yellow", 290, "yellow"),
        wall("w-green", 430, "green"),
        wall("w-blue", 570, "blue"),
        { id: "goal", kind: "goal", x: 660, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Custom Orbs",
    hint: "Enable Custom Orbs. Tap jump while you're inside an orb mid-air to jump again.",
    spawn: { x: 30, y: 420 },
    settings: [
      { type: "checkbox", id: "orbs", label: "Enable Custom Orbs", value: false },
    ],
    build: (v) => {
      const orbsOn = v["orbs"] as boolean;
      return [
        { id: "ground-left", kind: "platform", x: 0, y: 480, w: 160, h: 40, visible: true },
        { id: "ground-right", kind: "platform", x: 600, y: 480, w: 160, h: 40, visible: true },
        { id: "pit-spike", kind: "spike", x: 160, y: 502, w: 440, h: 18, visible: true },
        { id: "orb-1", kind: "orb", x: 250, y: 350, w: 40, h: 40, visible: orbsOn },
        { id: "orb-2", kind: "orb", x: 420, y: 280, w: 40, h: 40, visible: orbsOn },
        { id: "goal", kind: "goal", x: 680, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Zoom",
    hint: "It's all in here. Zoom out to see the level — then zoom back in to play.",
    spawn: { x: 40, y: 420 },
    worldW: 2500,
    worldH: 520,
    settings: [
      { type: "range", id: "zoom", label: "Zoom", min: 30, max: 100, step: 1, value: 100, unit: "%" },
      { type: "range", id: "graphics", label: "Graphics", min: 1, max: 9999999999, step: 1, value: 1 },
      { type: "range", id: "lift-height", label: "Bridge Height", min: 0, max: 240, step: 1, value: 0 },
      { type: "checkbox", id: "blocker", label: "Show Blocker", value: true },
      { type: "checkbox", id: "orbs", label: "Enable Custom Orbs", value: false },
      { type: "range", id: "brightness", label: "Brightness", min: 0, max: 100, step: 1, value: 100, unit: "%" },
      { type: "checkbox", id: "notify", label: "Enable Notifications", value: false },
      { type: "range", id: "notify-x", label: "Notification X", min: 1770, max: 1950, step: 1, value: 1850 },
      {
        type: "palette",
        id: "preference",
        label: "Preference Color",
        options: [
          { key: "red", color: "#ff6b7a", label: "Red" },
          { key: "yellow", color: "#f6d365", label: "Yellow" },
          { key: "blue", color: "#6dd3ff", label: "Blue" },
        ],
        value: "",
      },
    ],
    build: (v) => {
      const liftH = v["lift-height"] as number;
      const blocker = v["blocker"] as boolean;
      const orbsOn = v["orbs"] as boolean;
      const brightness = v["brightness"] as number;
      const darkVisible = brightness >= 50;
      const lightVisible = brightness <= 50;
      const notifyOn = v["notify"] as boolean;
      const pref = v["preference"] as string;
      const PLAT = "#a78bfa";
      const wallColors: Record<string, string> = {
        red: "#ff6b7a",
        yellow: "#f6d365",
        blue: "#6dd3ff",
      };
      return [
        // Section 1: opening ground.
        { id: "g-1", kind: "platform", x: 0, y: 480, w: 320, h: 40, visible: true },
        // Section 2: slider lifts a platform; checkbox deletes a blocker wall.
        { id: "lift", kind: "platform", x: 160, y: 466 - liftH, w: 150, h: 14, visible: true, color: PLAT },
        {
          id: "blocker-wall",
          kind: "wall",
          x: 360,
          y: 200,
          w: 28,
          h: 280,
          visible: blocker,
          color: "#7c5a9a",
        },
        { id: "shelf-1", kind: "platform", x: 410, y: 280, w: 160, h: 14, visible: true, color: PLAT },
        // Section 3: spike pit crossed by orbs.
        { id: "g-2", kind: "platform", x: 570, y: 480, w: 230, h: 40, visible: true },
        { id: "pit-spike-1", kind: "spike", x: 800, y: 502, w: 330, h: 18, visible: true },
        { id: "g-3", kind: "platform", x: 1130, y: 480, w: 150, h: 40, visible: true },
        { id: "orb-a", kind: "orb", x: 870, y: 290, w: 40, h: 40, visible: orbsOn },
        { id: "orb-b", kind: "orb", x: 970, y: 180, w: 40, h: 40, visible: orbsOn },
        // Section 4: brightness bridges over a spike pit. Dark bridge then light bridge,
        // with an overlap region so you can swap mid-cross.
        { id: "pit-spike-bright", kind: "spike", x: 1280, y: 502, w: 360, h: 18, visible: true },
        {
          id: "dark-bridge",
          kind: "platform",
          x: 1280,
          y: 480,
          w: 200,
          h: 14,
          visible: darkVisible,
          color: "#1a2240",
        },
        {
          id: "light-bridge",
          kind: "platform",
          x: 1440,
          y: 480,
          w: 200,
          h: 14,
          visible: lightVisible,
          color: "#f6f1c4",
        },
        { id: "g-after-bright", kind: "platform", x: 1600, y: 480, w: 140, h: 40, visible: true },
        // Section 5: red wall + spike pit, bridged by the notification toast.
        {
          id: "p-wall-red",
          kind: "wall",
          x: 1740,
          y: 200,
          w: 26,
          h: 280,
          visible: pref !== "red",
          color: wallColors["red"],
        },
        { id: "pit-spike-2", kind: "spike", x: 1770, y: 502, w: 270, h: 18, visible: true },
        {
          id: "toast",
          kind: "toast",
          x: v["notify-x"] as number,
          y: 400,
          w: 200,
          h: 36,
          visible: notifyOn,
          label: "Bridge incoming",
        },
        // Section 6: long final ground with two more preference walls.
        { id: "g-final", kind: "platform", x: 2040, y: 480, w: 400, h: 40, visible: true },
        {
          id: "p-wall-yellow",
          kind: "wall",
          x: 2210,
          y: 200,
          w: 26,
          h: 280,
          visible: pref !== "yellow",
          color: wallColors["yellow"],
        },
        {
          id: "p-wall-blue",
          kind: "wall",
          x: 2340,
          y: 200,
          w: 26,
          h: 280,
          visible: pref !== "blue",
          color: wallColors["blue"],
        },
        { id: "goal", kind: "goal", x: 2390, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Enable Glitches",
    hint: "Walls block everything. Flip the switch and walk through them like they were never there.",
    spawn: { x: 30, y: 420 },
    settings: [
      { type: "checkbox", id: "glitches", label: "Enable Glitches", value: false },
    ],
    build: (_v) => {
      const wall = (id: string, x: number, w = 32, y = 0, h = 480): Entity => ({
        id,
        kind: "wall",
        x,
        y,
        w,
        h,
        visible: true,
        color: "#7c5a9a",
      });
      return [
        { id: "ground", kind: "platform", x: 0, y: 480, w: 720, h: 40, visible: true },
        // Three sealed chambers between you and the flag.
        wall("w-1", 170),
        wall("w-2", 340),
        wall("w-3", 510),
        // Ceiling so you can't jump over even with a perfect arc.
        { id: "ceiling", kind: "wall", x: 0, y: 0, w: 720, h: 20, visible: true, color: "#7c5a9a" },
        { id: "goal", kind: "goal", x: 640, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Volume",
    hint: "Audio volume blows wind from the left. Crank it up to glide across the pit.",
    spawn: { x: 30, y: 420 },
    settings: [
      { type: "range", id: "volume", label: "Volume", min: 0, max: 100, step: 1, value: 50, unit: "%" },
    ],
    build: (_v) => [
      { id: "g-left", kind: "platform", x: 0, y: 480, w: 180, h: 40, visible: true },
      { id: "g-right", kind: "platform", x: 540, y: 480, w: 180, h: 40, visible: true },
      { id: "pit", kind: "spike", x: 180, y: 502, w: 360, h: 18, visible: true },
      { id: "goal", kind: "goal", x: 660, y: 430, w: 40, h: 50, visible: true },
    ],
  },
  {
    name: "Time of Day",
    hint: "Day platforms only stand in the day. Night platforms only stand at night.",
    spawn: { x: 30, y: 420 },
    settings: [
      {
        type: "select",
        id: "time-of-day",
        label: "Time of Day",
        options: [
          { value: "day", label: "Day" },
          { value: "night", label: "Night" },
        ],
        value: "day",
      },
    ],
    build: (v) => {
      const isDay = v["time-of-day"] === "day";
      return [
        { id: "g-left", kind: "platform", x: 0, y: 480, w: 180, h: 40, visible: true },
        { id: "pit", kind: "spike", x: 180, y: 502, w: 380, h: 18, visible: true },
        {
          id: "day-bridge",
          kind: "platform",
          x: 180,
          y: 480,
          w: 220,
          h: 14,
          visible: isDay,
          color: "#f6d365",
        },
        {
          id: "night-bridge",
          kind: "platform",
          x: 360,
          y: 480,
          w: 220,
          h: 14,
          visible: !isDay,
          color: "#3b3b78",
        },
        { id: "g-right", kind: "platform", x: 560, y: 480, w: 160, h: 40, visible: true },
        { id: "goal", kind: "goal", x: 660, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Vibration",
    hint: "A loose platform is wedged up high. Enable vibration to shake it loose.",
    spawn: { x: 30, y: 420 },
    settings: [
      { type: "checkbox", id: "vibration", label: "Enable Vibration", value: false },
    ],
    build: (v) => {
      const vibe = v["vibration"] as boolean;
      return [
        { id: "g-left", kind: "platform", x: 0, y: 480, w: 200, h: 40, visible: true },
        { id: "pit", kind: "spike", x: 200, y: 502, w: 320, h: 18, visible: true },
        { id: "g-right", kind: "platform", x: 520, y: 480, w: 200, h: 40, visible: true },
        // Loose platform — wedged at the ceiling until vibration shakes it down.
        {
          id: "loose",
          kind: "platform",
          x: 240,
          y: vibe ? 380 : 30,
          w: 240,
          h: 16,
          visible: true,
          color: vibe ? "#7ee8a3" : "#6c7a99",
        },
        { id: "goal", kind: "goal", x: 660, y: 430, w: 40, h: 50, visible: true },
      ];
    },
  },
  {
    name: "Mouse Sensitivity",
    hint: "Way too fast at default. Lower sensitivity for a precise landing on the narrow ledge.",
    spawn: { x: 30, y: 420 },
    settings: [
      {
        type: "range",
        id: "sensitivity",
        label: "Mouse Sensitivity",
        min: 20,
        max: 300,
        step: 1,
        value: 200,
        unit: "%",
      },
    ],
    build: (_v) => [
      { id: "g-left", kind: "platform", x: 0, y: 480, w: 200, h: 40, visible: true },
      { id: "pit-1", kind: "spike", x: 200, y: 502, w: 200, h: 18, visible: true },
      // Tiny ledge — too easy to skid past at high sensitivity.
      { id: "ledge", kind: "platform", x: 400, y: 480, w: 36, h: 40, visible: true, color: "#6dd3ff" },
      { id: "pit-2", kind: "spike", x: 436, y: 502, w: 134, h: 18, visible: true },
      { id: "g-right", kind: "platform", x: 570, y: 480, w: 150, h: 40, visible: true },
      { id: "goal", kind: "goal", x: 660, y: 430, w: 40, h: 50, visible: true },
    ],
  },
  {
    name: "Tutorial Tips",
    hint: "There's a path of invisible platforms. Tips reveal them — but they're always solid.",
    spawn: { x: 30, y: 420 },
    settings: [
      { type: "checkbox", id: "tips", label: "Show Tutorial Tips", value: false },
    ],
    build: (v) => {
      const tips = v["tips"] as boolean;
      const hidden = (id: string, x: number, y: number, w: number, h: number): Entity => ({
        id,
        kind: "platform",
        x,
        y,
        w,
        h,
        // Always solid; only the render is gated by the Tips checkbox.
        visible: true,
        hidden: !tips,
        color: "#a78bfa",
      });
      return [
        { id: "g-left", kind: "platform", x: 0, y: 480, w: 160, h: 40, visible: true },
        { id: "pit", kind: "spike", x: 160, y: 502, w: 400, h: 18, visible: true },
        hidden("h-1", 200, 420, 80, 14),
        hidden("h-2", 320, 360, 80, 14),
        hidden("h-3", 440, 300, 80, 14),
        { id: "g-right", kind: "platform", x: 560, y: 480, w: 160, h: 40, visible: true },
        { id: "goal", kind: "goal", x: 660, y: 250, w: 40, h: 50, visible: true },
        { id: "shelf", kind: "platform", x: 560, y: 300, w: 160, h: 14, visible: true },
      ];
    },
  },
];

// ----- State -----

let currentLevelIndex = 0;
let entities: Entity[] = [];
const settingValues: Record<string, number | string | boolean> = {};

const BASE_PLAYER_W = 22;
const BASE_PLAYER_H = 28;

const player = {
  x: 0,
  y: 0,
  w: BASE_PLAYER_W,
  h: BASE_PLAYER_H,
  vx: 0,
  vy: 0,
  onGround: false,
};

function applyPlayerScale(scale: number): void {
  const newW = Math.round(BASE_PLAYER_W * scale);
  const newH = Math.round(BASE_PLAYER_H * scale);
  // Anchor to bottom-center so the player doesn't sink into a platform.
  const cx = player.x + player.w / 2;
  const bottom = player.y + player.h;
  player.w = newW;
  player.h = newH;
  player.x = cx - newW / 2;
  player.y = bottom - newH;
}

let gravity = 1600;
let jumpStrength = 680;
const moveSpeed = 240;
let prevJump = false;
let zoom = 1;
let cameraX = W / 2;
let cameraY = H / 2;
let worldW = W;
let worldH = H;

const keys: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

restartBtn.addEventListener("click", () => loadLevel(currentLevelIndex));

let theme = "night";

// ----- Level loading -----

function loadLevel(index: number): void {
  currentLevelIndex = index;
  const level = levels[index];
  if (!level) return;
  levelLabel.textContent = `Level ${index + 1} of ${levels.length} — ${level.name}`;
  settingsHint.textContent = level.hint;

  // Reset settings to defaults (clear leftovers from prior levels first)
  for (const key of Object.keys(settingValues)) delete settingValues[key];
  for (const s of level.settings) {
    settingValues[s.id] = s.value;
  }
  renderSettings(level);
  rebuildEntities();

  // Reset player size before placing.
  player.w = BASE_PLAYER_W;
  player.h = BASE_PLAYER_H;
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.vx = 0;
  player.vy = 0;
  gravity = 1600;
  jumpStrength = 680;
  worldW = level.worldW ?? W;
  worldH = level.worldH ?? H;
  zoom = 1;
  if (level.settings.some((s) => s.id === "zoom")) {
    zoom = (settingValues["zoom"] as number) / 100;
  }
  updateCamera();
  if (level.settings.some((s) => s.id === "gravity")) {
    gravity = settingValues["gravity"] as number;
  }
  if (level.settings.some((s) => s.id === "jump")) {
    jumpStrength = settingValues["jump"] as number;
  }
  if (level.settings.some((s) => s.id === "theme")) {
    theme = settingValues["theme"] as string;
  }
  if (level.settings.some((s) => s.id === "player-scale")) {
    applyPlayerScale((settingValues["player-scale"] as number) / 100);
  }
}

function rebuildEntities(): void {
  const level = levels[currentLevelIndex];
  if (!level) return;
  entities = level.build(settingValues);
}

function renderSettings(level: Level): void {
  settingsBody.innerHTML = "";
  for (const s of level.settings) {
    const wrap = document.createElement("div");
    wrap.className = `setting ${s.type}`;

    if (s.type === "range") {
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <span class="value" id="v-${s.id}">${formatValue(s)}</span>
        </div>
        <input type="range" id="s-${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}" />
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      const valueEl = wrap.querySelector(`#v-${s.id}`) as HTMLSpanElement;
      input.addEventListener("input", () => {
        const num = Number(input.value);
        settingValues[s.id] = num;
        valueEl.textContent = formatValueRaw(num, s.unit);
        if (s.id === "gravity") gravity = num;
        if (s.id === "jump") jumpStrength = num;
        if (s.id === "player-scale") applyPlayerScale(num / 100);
        if (s.id === "zoom") {
          zoom = num / 100;
          updateCamera();
        }
        rebuildEntities();
      });
    } else if (s.type === "checkbox") {
      wrap.innerHTML = `
        <label class="setting-row" for="s-${s.id}">
          <span>${s.label}</span>
          <input type="checkbox" id="s-${s.id}" ${s.value ? "checked" : ""} />
        </label>
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      input.addEventListener("change", () => {
        settingValues[s.id] = input.checked;
        rebuildEntities();
      });
    } else if (s.type === "color") {
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <input type="color" id="s-${s.id}" value="${s.value}" />
        </div>
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      input.addEventListener("input", () => {
        settingValues[s.id] = input.value;
        rebuildEntities();
      });
    } else if (s.type === "select") {
      const opts = s.options
        .map((o) => `<option value="${o.value}" ${o.value === s.value ? "selected" : ""}>${o.label}</option>`)
        .join("");
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <select id="s-${s.id}">${opts}</select>
        </div>
      `;
      const select = wrap.querySelector("select") as HTMLSelectElement;
      select.addEventListener("change", () => {
        settingValues[s.id] = select.value;
        if (s.id === "theme") theme = select.value;
        rebuildEntities();
      });
    } else if (s.type === "palette") {
      const swatchHtml = s.options
        .map(
          (o) =>
            `<button type="button" class="swatch" data-key="${o.key}" style="background:${o.color}" aria-label="Prefer ${o.label}"><span class="swatch-check">✓</span></button>`
        )
        .join("");
      wrap.innerHTML = `
        <div class="setting-row">
          <label>${s.label}</label>
        </div>
        <div class="palette-row">${swatchHtml}</div>
      `;
      const refresh = (): void => {
        const active = settingValues[s.id] as string;
        wrap.querySelectorAll<HTMLButtonElement>(".swatch").forEach((btn) => {
          const key = btn.dataset["key"] ?? "";
          btn.classList.toggle("is-active", active === key);
        });
      };
      refresh();
      wrap.querySelectorAll<HTMLButtonElement>(".swatch").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset["key"] ?? "";
          const current = settingValues[s.id] as string;
          settingValues[s.id] = current === key ? "" : key;
          refresh();
          rebuildEntities();
        });
      });
    }

    settingsBody.appendChild(wrap);
  }
}

function formatValue(s: SliderSetting): string {
  return formatValueRaw(s.value, s.unit);
}
function formatValueRaw(n: number, unit?: string): string {
  return `${Math.round(n)}${unit ? unit : ""}`;
}

// ----- Physics & collisions -----

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateCamera(): void {
  const visW = W / zoom;
  const visH = H / zoom;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h / 2;
  if (visW >= worldW) cameraX = worldW / 2;
  else cameraX = Math.max(visW / 2, Math.min(worldW - visW / 2, targetX));
  if (visH >= worldH) cameraY = worldH / 2;
  else cameraY = Math.max(visH / 2, Math.min(worldH - visH / 2, targetY));
}

function solidEntities(): Entity[] {
  const noClip = settingValues["glitches"] === true;
  return entities.filter((e) => {
    if (!e.visible) return false;
    if (e.kind === "platform" || e.kind === "toast") return true;
    if (e.kind === "wall") return !noClip;
    return false;
  });
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.lineTo(x + w - radius, y);
  c.quadraticCurveTo(x + w, y, x + w, y + radius);
  c.lineTo(x + w, y + h - radius);
  c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  c.lineTo(x + radius, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - radius);
  c.lineTo(x, y + radius);
  c.quadraticCurveTo(x, y, x + radius, y);
  c.closePath();
}

function step(dt: number): void {
  // Horizontal input
  const left = keys["arrowleft"] || keys["a"];
  const right = keys["arrowright"] || keys["d"];
  const jump = keys["arrowup"] || keys["w"] || keys[" "];

  const speedMul =
    typeof settingValues["sensitivity"] === "number"
      ? (settingValues["sensitivity"] as number) / 100
      : 1;
  let targetVX = 0;
  if (left) targetVX -= moveSpeed * speedMul;
  if (right) targetVX += moveSpeed * speedMul;
  player.vx = targetVX;
  // Wind from the "Volume" slider — only while airborne.
  if (typeof settingValues["volume"] === "number" && !player.onGround) {
    const wind = ((settingValues["volume"] as number) - 50) * 12;
    player.vx += wind;
  }

  const jumpHeld = Boolean(jump);
  const jumpEdge = jumpHeld && !prevJump;
  prevJump = jumpHeld;
  if (jump && player.onGround) {
    player.vy = -jumpStrength;
    player.onGround = false;
  } else if (jumpEdge && !player.onGround) {
    // Geometry-Dash-style orb: tap jump while overlapping an orb to jump again.
    for (const e of entities) {
      if (e.visible && e.kind === "orb" && rectsOverlap(player, e)) {
        player.vy = -jumpStrength;
        break;
      }
    }
  }

  player.vy += gravity * dt;
  if (player.vy > 1400) player.vy = 1400;

  // Horizontal move + collide
  player.x += player.vx * dt;
  for (const e of solidEntities()) {
    if (rectsOverlap(player, e)) {
      if (player.vx > 0) player.x = e.x - player.w;
      else if (player.vx < 0) player.x = e.x + e.w;
      player.vx = 0;
    }
  }

  // Vertical move + collide
  player.y += player.vy * dt;
  player.onGround = false;
  for (const e of solidEntities()) {
    if (rectsOverlap(player, e)) {
      if (player.vy > 0) {
        player.y = e.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) {
        player.y = e.y + e.h;
        player.vy = 0;
      }
    }
  }

  // Bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > worldW) player.x = worldW - player.w;
  updateCamera();
  if (player.y > worldH + 200) {
    loadLevel(currentLevelIndex);
    return;
  }

  // Hazards & goal
  for (const e of entities) {
    if (!e.visible) continue;
    if (e.kind === "spike" && rectsOverlap(player, e)) {
      flash("Ouch! Try again.");
      loadLevel(currentLevelIndex);
      return;
    }
    if (e.kind === "goal" && rectsOverlap(player, e)) {
      const next = currentLevelIndex + 1;
      if (next < levels.length) {
        flash("Level Complete! ✦");
        setTimeout(() => loadLevel(next), 600);
      } else {
        flash("You configured every level. ✦ The End ✦");
        setTimeout(() => loadLevel(0), 1800);
      }
      // freeze to avoid double-trigger
      currentLevelIndex = -1;
      return;
    }
  }
}

let toastTimeout: number | null = null;
function flash(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 1200);
}

// ----- Render -----

function themeColors(): { sky1: string; sky2: string } {
  const pref = settingValues["preference"];
  if (typeof pref === "string" && pref) {
    const map: Record<string, { sky1: string; sky2: string }> = {
      red: { sky1: "#ff6b7a", sky2: "#a83545" },
      yellow: { sky1: "#f6d365", sky2: "#b59336" },
      green: { sky1: "#7ee8a3", sky2: "#3a8a58" },
      blue: { sky1: "#6dd3ff", sky2: "#2a7aa5" },
    };
    const picked = map[pref];
    if (picked) return picked;
  }
  if (theme === "dawn") return { sky1: "#3a2a4a", sky2: "#1a1226" };
  if (theme === "vapor") return { sky1: "#2a1850", sky2: "#0a0820" };
  return { sky1: "#1a2547", sky2: "#0a1024" };
}

function render(): void {
  const { sky1, sky2 } = themeColors();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky1);
  grad.addColorStop(1, sky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // World transform: zoom + camera.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  // Out-of-world shading.
  if (worldW !== W || worldH !== H) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(-2000, -2000, 2000 + worldW + 2000, 2000);
    ctx.fillRect(-2000, worldH, 2000 + worldW + 2000, 2000);
    ctx.fillRect(-2000, 0, 2000, worldH);
    ctx.fillRect(worldW, 0, 2000, worldH);
    // World frame
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(0, 0, worldW, worldH);
  }

  // Grid overlay (subtle)
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1 / zoom;
  for (let x = 0; x <= worldW; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldH);
    ctx.stroke();
  }
  for (let y = 0; y <= worldH; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(worldW, y);
    ctx.stroke();
  }

  for (const e of entities) {
    if (!e.visible) continue;
    if (e.hidden) continue;
    if (e.kind === "platform") {
      ctx.fillStyle = e.color ?? "#5a7ab8";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(e.x, e.y, e.w, 2);
    } else if (e.kind === "wall") {
      const phantom = settingValues["glitches"] === true;
      if (phantom) {
        // Glitched: render with low opacity + horizontal RGB shift bands.
        const t = performance.now();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = e.color ?? "#7c5a9a";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255, 60, 200, 0.25)";
        ctx.fillRect(e.x - 2, e.y, e.w, e.h);
        ctx.fillStyle = "rgba(60, 255, 220, 0.25)";
        ctx.fillRect(e.x + 2, e.y, e.w, e.h);
        // Scanline noise.
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        for (let yy = e.y; yy < e.y + e.h; yy += 6) {
          const jitter = ((t / 30 + yy) % 12) - 6;
          ctx.fillRect(e.x + jitter, yy, e.w, 2);
        }
      } else {
        ctx.fillStyle = e.color ?? "#7c5a9a";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
      }
    } else if (e.kind === "spike") {
      ctx.fillStyle = "#ff6b7a";
      const spikeW = 12;
      for (let sx = e.x; sx + spikeW <= e.x + e.w; sx += spikeW) {
        ctx.beginPath();
        ctx.moveTo(sx, e.y + e.h);
        ctx.lineTo(sx + spikeW / 2, e.y);
        ctx.lineTo(sx + spikeW, e.y + e.h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (e.kind === "toast") {
      // Notification toast — rounded card with text, acts as a platform.
      const r = 8;
      ctx.fillStyle = e.color ?? "rgba(30, 38, 64, 0.96)";
      roundRect(ctx, e.x, e.y, e.w, e.h, r);
      ctx.fill();
      ctx.strokeStyle = "rgba(109, 211, 255, 0.55)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1, r);
      ctx.stroke();
      // Bell icon
      ctx.fillStyle = "#f6d365";
      ctx.beginPath();
      ctx.arc(e.x + 14, e.y + e.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      // Label
      if (e.label) {
        ctx.fillStyle = "#eef3ff";
        ctx.font = "600 11px 'Trebuchet MS', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(e.label, e.x + 26, e.y + e.h / 2);
      }
    } else if (e.kind === "orb") {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const r = Math.min(e.w, e.h) / 2;
      // Pulse
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
      ctx.fillStyle = `rgba(246, 211, 101, ${0.18 + 0.12 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6 + 2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Orb body
      const grad = ctx.createRadialGradient(cx - r / 3, cy - r / 3, 1, cx, cy, r);
      grad.addColorStop(0, "#fff5c4");
      grad.addColorStop(1, "#f6a93f");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // Ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === "goal") {
      // Flag pole
      ctx.fillStyle = "#dbe2ff";
      ctx.fillRect(e.x + e.w / 2 - 2, e.y, 4, e.h);
      // Flag
      ctx.fillStyle = "#f6d365";
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2 + 2, e.y + 4);
      ctx.lineTo(e.x + e.w + 14, e.y + 14);
      ctx.lineTo(e.x + e.w / 2 + 2, e.y + 24);
      ctx.closePath();
      ctx.fill();
      // Glow
      ctx.fillStyle = "rgba(246, 211, 101, 0.18)";
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Graphics meter — intensity ramps logarithmically with the slider value.
  const gfxRaw = typeof settingValues["graphics"] === "number" ? (settingValues["graphics"] as number) : 1;
  const gfxIntensity = Math.min(1, Math.log10(Math.max(1, gfxRaw)) / 10);
  if (gfxIntensity > 0.05) {
    const t = performance.now() / 1000;
    // Aura around the player.
    const auraR = 14 + 30 * gfxIntensity;
    const auraGrad = ctx.createRadialGradient(
      player.x + player.w / 2,
      player.y + player.h / 2,
      4,
      player.x + player.w / 2,
      player.y + player.h / 2,
      auraR
    );
    auraGrad.addColorStop(0, `rgba(109, 211, 255, ${0.4 * gfxIntensity})`);
    auraGrad.addColorStop(1, "rgba(109, 211, 255, 0)");
    ctx.fillStyle = auraGrad;
    ctx.fillRect(
      player.x + player.w / 2 - auraR,
      player.y + player.h / 2 - auraR,
      auraR * 2,
      auraR * 2
    );
    // Sparkles trailing the player.
    const sparkleCount = Math.floor(2 + 30 * gfxIntensity);
    ctx.fillStyle = `rgba(255, 245, 196, ${0.6 * gfxIntensity})`;
    for (let i = 0; i < sparkleCount; i++) {
      const a = (i / sparkleCount) * Math.PI * 2 + t * 2 + i;
      const r = 6 + 22 * gfxIntensity + 6 * Math.sin(t * 3 + i);
      const sx = player.x + player.w / 2 + Math.cos(a) * r;
      const sy = player.y + player.h / 2 + Math.sin(a) * r;
      ctx.fillRect(sx, sy, 2, 2);
    }
    // Bloom on the goal flag.
    for (const e of entities) {
      if (e.kind !== "goal" || !e.visible) continue;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const bloomR = 50 + 80 * gfxIntensity;
      const bg = ctx.createRadialGradient(cx, cy, 6, cx, cy, bloomR);
      bg.addColorStop(0, `rgba(246, 211, 101, ${0.4 * gfxIntensity})`);
      bg.addColorStop(1, "rgba(246, 211, 101, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(cx - bloomR, cy - bloomR, bloomR * 2, bloomR * 2);
    }
  }

  // Player — with glitch effect if no-clip is on.
  const noClip = settingValues["glitches"] === true;
  if (noClip) {
    // Magenta + cyan RGB-shifted ghosts behind the player.
    const shift = 3 + Math.sin(performance.now() / 60) * 2;
    ctx.fillStyle = "rgba(255, 60, 200, 0.6)";
    ctx.fillRect(player.x - shift, player.y, player.w, player.h);
    ctx.fillStyle = "rgba(60, 255, 220, 0.6)";
    ctx.fillRect(player.x + shift, player.y, player.w, player.h);
  }
  ctx.fillStyle = noClip ? "rgba(109, 211, 255, 0.85)" : "#6dd3ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#0c1a2e";
  const eyeW = Math.max(2, Math.round(player.w * 0.18));
  const eyeH = Math.max(2, Math.round(player.h * 0.14));
  const eyeY = player.y + Math.round(player.h * 0.28);
  ctx.fillRect(player.x + Math.round(player.w * 0.18), eyeY, eyeW, eyeH);
  ctx.fillRect(player.x + Math.round(player.w * 0.64), eyeY, eyeW, eyeH);

  ctx.restore();

  // Screen-space rainbow flashes when graphics is maxed out.
  if (gfxIntensity > 0.85) {
    const flash = (gfxIntensity - 0.85) / 0.15;
    const t = performance.now() / 1000;
    const hue = (t * 90) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.08 * flash})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Brightness overlay (screen space, on top of everything)
  if (typeof settingValues["brightness"] === "number") {
    const brightness = settingValues["brightness"] as number;
    if (brightness < 100) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(100 - brightness) / 125})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (brightness > 100) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(brightness - 100) / 200})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ----- Loop -----

let lastT = performance.now();
function loop(t: number): void {
  const dt = Math.min((t - lastT) / 1000, 1 / 30);
  lastT = t;
  if (currentLevelIndex >= 0) step(dt);
  render();
  requestAnimationFrame(loop);
}

loadLevel(0);
requestAnimationFrame((t) => {
  lastT = t;
  loop(t);
});
