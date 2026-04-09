import { describe, expect, it } from "vitest";
import { MAZE_MAPS, NORMALIZED_MAZE_MAPS } from "./maps";
import {
  getFeatureDefinitions,
  normalizeMazeMap,
  pointKey,
  validateMazeMap,
  type MazeMap,
} from "./model";

describe("feature registry", () => {
  it("exposes all current feature kinds for editor discovery", () => {
    const definitions = getFeatureDefinitions();
    expect(definitions.map((definition) => definition.kind)).toEqual([
      "switch",
      "well",
      "bridge",
      "portal",
      "spin",
      "reverse",
      "reset",
    ]);

    const switchDefinition = definitions.find(
      (definition) => definition.kind === "switch"
    );
    expect(switchDefinition?.properties.map((property) => property.key)).toEqual([
      "timeoutMs",
      "targetWellIds",
    ]);

    const reverseDefinition = definitions.find(
      (definition) => definition.kind === "reverse"
    );
    expect(reverseDefinition?.properties).toEqual([]);
  });
});

describe("built-in maps", () => {
  it("validate cleanly and keep terrain free of legacy glyphs", () => {
    for (const map of MAZE_MAPS) {
      expect(validateMazeMap(map)).toEqual([]);
      expect(map.terrain.every((row) => /^[#.]+$/.test(row))).toBe(true);
      expect(map.markers.start).toBeTruthy();
      expect(map.markers.exit).toBeTruthy();
    }
  });

  it("build normalized indexes for the switch and well heavy level", () => {
    const levelSix = NORMALIZED_MAZE_MAPS.find((level) => level.map.id === 6);
    expect(levelSix).toBeDefined();
    expect(levelSix?.wellsById.size).toBe(8);
    expect(levelSix?.switchesByCell.size).toBe(8);
  });
});

describe("map validation", () => {
  it("preserves per-instance switch timeout values", () => {
    const map: MazeMap = {
      id: 999,
      name: "Custom Switch Timeout",
      terrain: ["....."],
      markers: {
        start: { x: 0, y: 0 },
        exit: { x: 4, y: 0 },
      },
      features: [
        {
          kind: "switch",
          id: "switch-a",
          position: { x: 1, y: 0 },
          props: {
            timeoutMs: 2_500,
            targetWellIds: ["well-a"],
          },
        },
        {
          kind: "well",
          id: "well-a",
          position: { x: 2, y: 0 },
          props: {},
        },
      ],
    };

    const normalized = normalizeMazeMap(map);
    const mazeSwitch = normalized.switchesByCell.get(pointKey({ x: 1, y: 0 }));
    expect(mazeSwitch?.props.timeoutMs).toBe(2_500);
    expect(normalized.wellsById.has("well-a")).toBe(true);
  });

  it("rejects invalid bridge placement", () => {
    const map: MazeMap = {
      id: 1_000,
      name: "Invalid Bridge",
      terrain: [".....", "#####", "#####"],
      markers: {
        start: { x: 0, y: 0 },
        exit: { x: 4, y: 0 },
      },
      features: [
        {
          kind: "bridge",
          id: "bridge-a",
          position: { x: 2, y: 0 },
          props: { underAxis: "horizontal" },
        },
      ],
    };

    const issues = validateMazeMap(map);
    expect(issues.some((issue) => issue.message.includes("must sit on a T or +"))).toBe(
      true
    );
  });

  it("rejects invalid portal links", () => {
    const map: MazeMap = {
      id: 1_001,
      name: "Invalid Portal",
      terrain: ["....."],
      markers: {
        start: { x: 0, y: 0 },
        exit: { x: 4, y: 0 },
      },
      features: [
        {
          kind: "portal",
          id: "portal-a",
          position: { x: 1, y: 0 },
          props: { targetPortalId: "portal-a" },
        },
      ],
    };

    const issues = validateMazeMap(map);
    expect(issues.some((issue) => issue.message.includes("cannot target itself"))).toBe(
      true
    );
  });
});
