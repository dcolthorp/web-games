export const TERRAIN_WALL = "#";
export const TERRAIN_OPEN = ".";

export type TerrainTile = typeof TERRAIN_WALL | typeof TERRAIN_OPEN;
export type Axis = "horizontal" | "vertical";

export interface Point {
  x: number;
  y: number;
}

export interface FeatureInstance<TKind extends string, TProps = Record<string, unknown>> {
  kind: TKind;
  id: string;
  position: Point;
  props: TProps;
}

export interface SwitchProps {
  timeoutMs: number;
  targetWellIds: string[];
}

export interface WellProps {}

export interface BridgeProps {
  underAxis: Axis;
}

export interface PortalProps {
  targetPortalId: string;
}

export interface SpinProps {
  rotationQuarterDelta: number;
}

export interface ReverseProps {}

export interface ResetProps {}

export type SwitchFeature = FeatureInstance<"switch", SwitchProps>;
export type WellFeature = FeatureInstance<"well", WellProps>;
export type BridgeFeature = FeatureInstance<"bridge", BridgeProps>;
export type PortalFeature = FeatureInstance<"portal", PortalProps>;
export type SpinFeature = FeatureInstance<"spin", SpinProps>;
export type ReverseFeature = FeatureInstance<"reverse", ReverseProps>;
export type ResetFeature = FeatureInstance<"reset", ResetProps>;

export type MapFeature =
  | SwitchFeature
  | WellFeature
  | BridgeFeature
  | PortalFeature
  | SpinFeature
  | ReverseFeature
  | ResetFeature;

export type FeatureKind = MapFeature["kind"];

export interface MazeMap {
  id: number;
  name: string;
  terrain: string[];
  markers: {
    start: Point;
    exit: Point;
  };
  features: MapFeature[];
}

export type FeaturePropertyType =
  | "number"
  | "axis"
  | "feature-ref"
  | "feature-ref-list";

export interface FeaturePropertyOption {
  label: string;
  value: string;
}

export interface FeaturePropertyDefinition {
  key: string;
  label: string;
  description: string;
  type: FeaturePropertyType;
  defaultValue: unknown;
  min?: number;
  step?: number;
  featureKinds?: FeatureKind[];
  options?: FeaturePropertyOption[];
}

export interface SemanticGraphicsDescriptor {
  icon: string;
  paletteKey: string;
  overlayStyle: string;
  annotationLabel: string;
  annotationHint?: string;
}

export interface PlacementRuleSet {
  allowedTerrain: TerrainTile[];
  maxPerCell: number;
  notes: string[];
}

export interface ValidationIssue {
  severity: "error";
  message: string;
  featureId?: string;
}

export interface FeatureDefinition {
  kind: FeatureKind;
  label: string;
  description: string;
  graphics: SemanticGraphicsDescriptor;
  properties: FeaturePropertyDefinition[];
  placement: PlacementRuleSet;
  validate: (
    map: MazeMap,
    feature: MapFeature,
    context: ValidationContext
  ) => ValidationIssue[];
}

export interface ValidationContext {
  cols: number;
  rows: number;
  terrain: TerrainTile[][];
  featureById: Map<string, MapFeature>;
  featureIdsByCell: Map<string, string[]>;
}

export interface NormalizedMazeMap {
  map: MazeMap;
  cols: number;
  rows: number;
  terrain: TerrainTile[][];
  featureById: Map<string, MapFeature>;
  featureByCell: Map<string, MapFeature[]>;
  bridgesByCell: Map<string, BridgeFeature>;
  portalsById: Map<string, PortalFeature>;
  portalsByCell: Map<string, PortalFeature>;
  switchesByCell: Map<string, SwitchFeature>;
  wellsById: Map<string, WellFeature>;
  wellsByCell: Map<string, WellFeature>;
}

const FEATURE_KINDS: readonly FeatureKind[] = [
  "switch",
  "well",
  "bridge",
  "portal",
  "spin",
  "reverse",
  "reset",
];

const OPEN_CELL_PLACEMENT: PlacementRuleSet = {
  allowedTerrain: [TERRAIN_OPEN],
  maxPerCell: 1,
  notes: ["Must be placed on open terrain.", "Only one feature may occupy a cell."],
};

const SUPPORTED_SPIN_DELTAS = new Set([-3, -2, -1, 1, 2, 3]);

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function getFeatureDefinitions(): readonly FeatureDefinition[] {
  return FEATURE_KINDS.map((kind) => FEATURE_DEFINITIONS[kind]!);
}

export function getFeatureDefinition(kind: FeatureKind): FeatureDefinition {
  return FEATURE_DEFINITIONS[kind]!;
}

export function terrainTileAt(
  terrain: TerrainTile[][],
  point: Point
): TerrainTile | null {
  const row = terrain[point.y];
  if (!row) {
    return null;
  }
  return row[point.x] ?? null;
}

export function featureAt(
  map: NormalizedMazeMap,
  point: Point
): MapFeature | null {
  const features = map.featureByCell.get(pointKey(point));
  return features?.[0] ?? null;
}

export function cloneTerrain(terrain: string[]): TerrainTile[][] {
  return terrain.map((row) => row.split("") as TerrainTile[]);
}

export function validateMazeMap(map: MazeMap): ValidationIssue[] {
  const issues = validateTerrain(map);
  const dimensions = getTerrainDimensions(map.terrain);
  if (!dimensions) {
    return issues;
  }

  const terrain = cloneTerrain(map.terrain);
  const featureById = new Map<string, MapFeature>();
  const featureIdsByCell = new Map<string, string[]>();

  for (const feature of map.features) {
    if (featureById.has(feature.id)) {
      issues.push({
        severity: "error",
        featureId: feature.id,
        message: `Duplicate feature id '${feature.id}'.`,
      });
    } else {
      featureById.set(feature.id, feature);
    }

    const cellKey = pointKey(feature.position);
    const ids = featureIdsByCell.get(cellKey);
    if (ids) {
      ids.push(feature.id);
    } else {
      featureIdsByCell.set(cellKey, [feature.id]);
    }
  }

  validateMarker("start", map.markers.start, terrain, issues);
  validateMarker("exit", map.markers.exit, terrain, issues);

  const context: ValidationContext = {
    cols: dimensions.cols,
    rows: dimensions.rows,
    terrain,
    featureById,
    featureIdsByCell,
  };

  for (const feature of map.features) {
    const definition = getFeatureDefinition(feature.kind);
    issues.push(...validateFeatureBaseline(map, feature, definition, context));
    issues.push(...definition.validate(map, feature, context));
  }

  return issues;
}

export function normalizeMazeMap(map: MazeMap): NormalizedMazeMap {
  const issues = validateMazeMap(map);
  if (issues.length > 0) {
    throw new Error(
      `Invalid map '${map.name}': ${issues.map((issue) => issue.message).join(" ")}`
    );
  }

  const terrain = cloneTerrain(map.terrain);
  const cols = terrain[0]?.length ?? 0;
  const rows = terrain.length;
  const featureById = new Map<string, MapFeature>();
  const featureByCell = new Map<string, MapFeature[]>();
  const bridgesByCell = new Map<string, BridgeFeature>();
  const portalsById = new Map<string, PortalFeature>();
  const portalsByCell = new Map<string, PortalFeature>();
  const switchesByCell = new Map<string, SwitchFeature>();
  const wellsById = new Map<string, WellFeature>();
  const wellsByCell = new Map<string, WellFeature>();

  for (const feature of map.features) {
    featureById.set(feature.id, feature);
    const cellKey = pointKey(feature.position);
    const existing = featureByCell.get(cellKey);
    if (existing) {
      existing.push(feature);
    } else {
      featureByCell.set(cellKey, [feature]);
    }

    if (feature.kind === "bridge") {
      bridgesByCell.set(cellKey, feature);
    } else if (feature.kind === "portal") {
      portalsById.set(feature.id, feature);
      portalsByCell.set(cellKey, feature);
    } else if (feature.kind === "switch") {
      switchesByCell.set(cellKey, feature);
    } else if (feature.kind === "well") {
      wellsById.set(feature.id, feature);
      wellsByCell.set(cellKey, feature);
    }
  }

  return {
    map,
    cols,
    rows,
    terrain,
    featureById,
    featureByCell,
    bridgesByCell,
    portalsById,
    portalsByCell,
    switchesByCell,
    wellsById,
    wellsByCell,
  };
}

function validateTerrain(map: MazeMap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { terrain } = map;
  if (terrain.length === 0) {
    issues.push({
      severity: "error",
      message: "Terrain must contain at least one row.",
    });
    return issues;
  }

  const expectedWidth = terrain[0]?.length ?? 0;
  if (expectedWidth === 0) {
    issues.push({
      severity: "error",
      message: "Terrain rows must not be empty.",
    });
  }

  for (let y = 0; y < terrain.length; y += 1) {
    const row = terrain[y];
    if (!row) {
      continue;
    }
    if (row.length !== expectedWidth) {
      issues.push({
        severity: "error",
        message: `Terrain row ${y} has width ${row.length}; expected ${expectedWidth}.`,
      });
    }

    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== TERRAIN_WALL && tile !== TERRAIN_OPEN) {
        issues.push({
          severity: "error",
          message: `Terrain at ${x},${y} must be '${TERRAIN_WALL}' or '${TERRAIN_OPEN}'.`,
        });
      }
    }
  }

  return issues;
}

function getTerrainDimensions(
  terrain: string[]
): { cols: number; rows: number } | null {
  if (terrain.length === 0 || (terrain[0]?.length ?? 0) === 0) {
    return null;
  }
  return {
    cols: terrain[0]!.length,
    rows: terrain.length,
  };
}

function validateMarker(
  label: "start" | "exit",
  point: Point,
  terrain: TerrainTile[][],
  issues: ValidationIssue[]
): void {
  if (!isPointInBounds(terrain, point)) {
    issues.push({
      severity: "error",
      message: `${label} marker is out of bounds at ${point.x},${point.y}.`,
    });
    return;
  }

  if (terrainTileAt(terrain, point) !== TERRAIN_OPEN) {
    issues.push({
      severity: "error",
      message: `${label} marker must be on open terrain at ${point.x},${point.y}.`,
    });
  }
}

function validateFeatureBaseline(
  map: MazeMap,
  feature: MapFeature,
  definition: FeatureDefinition,
  context: ValidationContext
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { position } = feature;

  if (!isPointInBounds(context.terrain, position)) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Feature '${feature.id}' is out of bounds at ${position.x},${position.y}.`,
    });
    return issues;
  }

  const terrain = terrainTileAt(context.terrain, position);
  if (!terrain || !definition.placement.allowedTerrain.includes(terrain)) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Feature '${feature.id}' cannot be placed on terrain '${terrain ?? "?"}'.`,
    });
  }

  const cellIds = context.featureIdsByCell.get(pointKey(position)) ?? [];
  if (cellIds.length > definition.placement.maxPerCell) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Cell ${position.x},${position.y} has ${cellIds.length} features; maximum is ${definition.placement.maxPerCell}.`,
    });
  }

  if (samePoint(position, map.markers.start) || samePoint(position, map.markers.exit)) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Feature '${feature.id}' cannot share a cell with a start or exit marker.`,
    });
  }

  return issues;
}

function isPointInBounds(terrain: TerrainTile[][], point: Point): boolean {
  return (
    point.y >= 0 &&
    point.y < terrain.length &&
    point.x >= 0 &&
    point.x < (terrain[0]?.length ?? 0)
  );
}

function isOpenTile(terrain: TerrainTile[][], point: Point): boolean {
  return terrainTileAt(terrain, point) === TERRAIN_OPEN;
}

function validateSwitchFeature(
  _map: MazeMap,
  feature: MapFeature,
  context: ValidationContext
): ValidationIssue[] {
  if (feature.kind !== "switch") {
    return [];
  }

  const issues: ValidationIssue[] = [];
  if (feature.props.timeoutMs <= 0) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Switch '${feature.id}' must have a positive timeoutMs.`,
    });
  }

  if (!Number.isInteger(feature.props.timeoutMs)) {
    issues.push({
      severity: "error",
      featureId: feature.id,
      message: `Switch '${feature.id}' timeoutMs must be an integer.`,
    });
  }

  const targetIds = new Set<string>();
  for (const targetWellId of feature.props.targetWellIds) {
    if (targetIds.has(targetWellId)) {
      issues.push({
        severity: "error",
        featureId: feature.id,
        message: `Switch '${feature.id}' references well '${targetWellId}' more than once.`,
      });
      continue;
    }
    targetIds.add(targetWellId);

    const target = context.featureById.get(targetWellId);
    if (!target) {
      issues.push({
        severity: "error",
        featureId: feature.id,
        message: `Switch '${feature.id}' references missing well '${targetWellId}'.`,
      });
    } else if (target.kind !== "well") {
      issues.push({
        severity: "error",
        featureId: feature.id,
        message: `Switch '${feature.id}' can only target wells; '${targetWellId}' is a '${target.kind}'.`,
      });
    }
  }

  return issues;
}

function validateWellFeature(): ValidationIssue[] {
  return [];
}

function validateBridgeFeature(
  _map: MazeMap,
  feature: MapFeature,
  context: ValidationContext
): ValidationIssue[] {
  if (feature.kind !== "bridge") {
    return [];
  }

  const { x, y } = feature.position;
  const left = isOpenTile(context.terrain, { x: x - 1, y });
  const right = isOpenTile(context.terrain, { x: x + 1, y });
  const up = isOpenTile(context.terrain, { x, y: y - 1 });
  const down = isOpenTile(context.terrain, { x, y: y + 1 });

  const horizontalThrough = left && right;
  const verticalThrough = up && down;
  const hasOverAxisNeighbor =
    feature.props.underAxis === "horizontal" ? up || down : left || right;
  const validUnderAxis =
    feature.props.underAxis === "horizontal" ? horizontalThrough : verticalThrough;
  const hasDiagonalNeighbor =
    isOpenTile(context.terrain, { x: x - 1, y: y - 1 }) ||
    isOpenTile(context.terrain, { x: x + 1, y: y - 1 }) ||
    isOpenTile(context.terrain, { x: x - 1, y: y + 1 }) ||
    isOpenTile(context.terrain, { x: x + 1, y: y + 1 });

  if (!validUnderAxis || !hasOverAxisNeighbor || hasDiagonalNeighbor) {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Bridge '${feature.id}' at ${x},${y} must sit on a T or + intersection with a straight under-path and no diagonal neighbors.`,
      },
    ];
  }

  return [];
}

function validatePortalFeature(
  _map: MazeMap,
  feature: MapFeature,
  context: ValidationContext
): ValidationIssue[] {
  if (feature.kind !== "portal") {
    return [];
  }

  const target = context.featureById.get(feature.props.targetPortalId);
  if (!target) {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Portal '${feature.id}' references missing portal '${feature.props.targetPortalId}'.`,
      },
    ];
  }

  if (target.kind !== "portal") {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Portal '${feature.id}' must target another portal; '${target.id}' is '${target.kind}'.`,
      },
    ];
  }

  if (target.id === feature.id) {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Portal '${feature.id}' cannot target itself.`,
      },
    ];
  }

  if (target.props.targetPortalId !== feature.id) {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Portal '${feature.id}' must be reciprocally linked with '${target.id}'.`,
      },
    ];
  }

  return [];
}

function validateSpinFeature(
  _map: MazeMap,
  feature: MapFeature
): ValidationIssue[] {
  if (feature.kind !== "spin") {
    return [];
  }

  if (!SUPPORTED_SPIN_DELTAS.has(feature.props.rotationQuarterDelta)) {
    return [
      {
        severity: "error",
        featureId: feature.id,
        message: `Spin '${feature.id}' has unsupported rotationQuarterDelta '${feature.props.rotationQuarterDelta}'.`,
      },
    ];
  }

  return [];
}

function validateReverseFeature(): ValidationIssue[] {
  return [];
}

function validateResetFeature(): ValidationIssue[] {
  return [];
}

const FEATURE_DEFINITIONS: Record<FeatureKind, FeatureDefinition> = {
  switch: {
    kind: "switch",
    label: "Switch",
    description: "Opens one or more wells for a configurable timeout.",
    graphics: {
      icon: "switch",
      paletteKey: "button",
      overlayStyle: "symbol",
      annotationLabel: "Switch",
      annotationHint: "Targets wells and exposes an editable timeout.",
    },
    properties: [
      {
        key: "timeoutMs",
        label: "Timeout",
        description: "How long the targeted wells stay open after activation.",
        type: "number",
        defaultValue: 10_000,
        min: 100,
        step: 100,
      },
      {
        key: "targetWellIds",
        label: "Target Wells",
        description: "The well ids opened by this switch.",
        type: "feature-ref-list",
        defaultValue: [],
        featureKinds: ["well"],
      },
    ],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateSwitchFeature,
  },
  well: {
    kind: "well",
    label: "Well",
    description: "A timed barrier opened by switches.",
    graphics: {
      icon: "well",
      paletteKey: "timedWall",
      overlayStyle: "fill",
      annotationLabel: "Well",
      annotationHint: "Closed by default; opens when a linked switch is pressed.",
    },
    properties: [],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateWellFeature,
  },
  bridge: {
    kind: "bridge",
    label: "Bridge",
    description: "Lets the player pass over or under depending on movement direction.",
    graphics: {
      icon: "bridge",
      paletteKey: "bridge",
      overlayStyle: "bridge",
      annotationLabel: "Bridge",
      annotationHint: "Requires a straight under-path and a crossing over-path.",
    },
    properties: [
      {
        key: "underAxis",
        label: "Under Axis",
        description: "The axis used when traveling under the bridge.",
        type: "axis",
        defaultValue: "horizontal",
        options: [
          { label: "Horizontal", value: "horizontal" },
          { label: "Vertical", value: "vertical" },
        ],
      },
    ],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateBridgeFeature,
  },
  portal: {
    kind: "portal",
    label: "Portal",
    description: "Teleports the player to a linked portal.",
    graphics: {
      icon: "portal",
      paletteKey: "portal",
      overlayStyle: "symbol",
      annotationLabel: "Portal",
      annotationHint: "Must be paired with exactly one reciprocal target portal.",
    },
    properties: [
      {
        key: "targetPortalId",
        label: "Target Portal",
        description: "The portal reached after entering this portal.",
        type: "feature-ref",
        defaultValue: "",
        featureKinds: ["portal"],
      },
    ],
    placement: OPEN_CELL_PLACEMENT,
    validate: validatePortalFeature,
  },
  spin: {
    kind: "spin",
    label: "Spin",
    description: "Rotates the maze view by a configurable quarter-turn delta.",
    graphics: {
      icon: "spin",
      paletteKey: "spin",
      overlayStyle: "symbol",
      annotationLabel: "Spin",
      annotationHint: "Rotates the maze using quarter-turn increments.",
    },
    properties: [
      {
        key: "rotationQuarterDelta",
        label: "Rotation Delta",
        description: "Quarter turns to apply when the feature is activated.",
        type: "number",
        defaultValue: 1,
        step: 1,
      },
    ],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateSpinFeature,
  },
  reverse: {
    kind: "reverse",
    label: "Reverse Controls",
    description: "Toggles reversed movement controls.",
    graphics: {
      icon: "reverse",
      paletteKey: "reverse",
      overlayStyle: "symbol",
      annotationLabel: "Reverse",
      annotationHint: "Flips the player controls until toggled again or reset.",
    },
    properties: [],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateReverseFeature,
  },
  reset: {
    kind: "reset",
    label: "Reset Illusions",
    description: "Resets the current illusion state.",
    graphics: {
      icon: "reset",
      paletteKey: "reset",
      overlayStyle: "symbol",
      annotationLabel: "Reset",
      annotationHint: "Returns rotation and controls to their defaults.",
    },
    properties: [],
    placement: OPEN_CELL_PLACEMENT,
    validate: validateResetFeature,
  },
};
