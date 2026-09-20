import { doorAt, doorBoxes, floodFill, parseColor, type Door } from "./paint";

export type ToolName = "freeform" | "line" | "square" | "fill" | "eraser" | "text";

export const PAPER_WIDTH = 900;
export const PAPER_HEIGHT = 620;
export const PAPER_COLOR = "#ffffff";

export interface Board {
  setTool(tool: ToolName): void;
  setColor(color: string): void;
  setSize(size: number): void;
  setLocked(locked: boolean): void;
  eraseAll(): void;
  placeText(spot: Point, text: string): void;
  doors(): Door[];
  load(dataUrl: string, doors?: Door[]): Promise<void>;
  snapshot(): string;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoardHooks {
  // The text tool asks the page for words instead of drawing straight away.
  onTextSpot?(spot: Point): void;
  onDoorOpen?(door: Door): void;
  onDoorsChanged?(doors: Door[]): void;
}

export function textFont(size: number): string {
  return `${textHeight(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Trebuchet MS", sans-serif`;
}

export function textHeight(size: number): number {
  return Math.max(18, Math.round(size * 3.5));
}

/**
 * The paper. Everything lands on the bottom canvas; the top one only ever
 * holds the line or square you're still dragging, so a shape can follow the
 * cursor without smearing the drawing underneath it.
 */
export function createBoard(
  paper: HTMLCanvasElement,
  preview: HTMLCanvasElement,
  hooks: BoardHooks = {}
): Board {
  const ink = paper.getContext("2d", { willReadFrequently: true });
  const ghost = preview.getContext("2d");
  if (!ink || !ghost) throw new Error("This browser can't do canvas.");

  let tool: ToolName = "freeform";
  let color = "#111111";
  let size = 6;
  let locked = false;
  let start: Point | null = null;
  let last: Point | null = null;
  let doors: Door[] = [];

  const fillPaper = (): void => {
    ink.fillStyle = PAPER_COLOR;
    ink.fillRect(0, 0, paper.width, paper.height);
  };

  const rememberDoors = (next: Door[]): void => {
    doors = next;
    hooks.onDoorsChanged?.(doors);
  };

  // Rubbing a door out takes the doorway with it, otherwise you'd be clicking
  // on a door that isn't there any more.
  const eraseDoorsUnder = (spot: Point): void => {
    const survivors = doors.filter((door) => !doorAt([door], spot.x, spot.y));
    if (survivors.length !== doors.length) rememberDoors(survivors);
  };
  fillPaper();

  const spotFor = (event: PointerEvent): Point => {
    const box = paper.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * paper.width,
      y: ((event.clientY - box.top) / box.height) * paper.height,
    };
  };

  const strokeStyle = (context: CanvasRenderingContext2D): void => {
    context.strokeStyle = tool === "eraser" ? PAPER_COLOR : color;
    context.lineWidth = tool === "eraser" ? size * 2.5 : size;
    context.lineCap = "round";
    context.lineJoin = "round";
  };

  const drawSegment = (from: Point, to: Point): void => {
    strokeStyle(ink);
    ink.beginPath();
    ink.moveTo(from.x, from.y);
    ink.lineTo(to.x, to.y);
    ink.stroke();
  };

  const drawShape = (context: CanvasRenderingContext2D, from: Point, to: Point): void => {
    strokeStyle(context);
    context.beginPath();
    if (tool === "line") {
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    } else {
      context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
    }
    context.stroke();
  };

  const bucket = (spot: Point): void => {
    const image = ink.getImageData(0, 0, paper.width, paper.height);
    const changed = floodFill(
      image.data,
      paper.width,
      paper.height,
      spot.x,
      spot.y,
      parseColor(tool === "eraser" ? PAPER_COLOR : color)
    );
    if (changed > 0) ink.putImageData(image, 0, 0);
  };

  paper.addEventListener("pointerdown", (event) => {
    if (locked || !event.isPrimary) return;
    event.preventDefault();
    paper.setPointerCapture(event.pointerId);
    const spot = spotFor(event);
    if (tool === "text") {
      hooks.onTextSpot?.(spot);
      return;
    }
    if (tool === "fill") {
      bucket(spot);
      return;
    }
    if (tool === "eraser") eraseDoorsUnder(spot);
    start = spot;
    last = spot;
    // A single tap with the pencil should still leave a dot behind.
    if (tool === "freeform" || tool === "eraser") drawSegment(spot, spot);
  });

  paper.addEventListener("pointermove", (event) => {
    if (locked || !start || !event.isPrimary) return;
    const spot = spotFor(event);
    if (tool === "freeform" || tool === "eraser") {
      drawSegment(last ?? spot, spot);
      if (tool === "eraser") eraseDoorsUnder(spot);
      last = spot;
      return;
    }
    ghost.clearRect(0, 0, preview.width, preview.height);
    drawShape(ghost, start, spot);
  });

  const finish = (event: PointerEvent): void => {
    if (!start) return;
    const spot = spotFor(event);
    if (tool === "line" || tool === "square") drawShape(ink, start, spot);
    ghost.clearRect(0, 0, preview.width, preview.height);
    start = null;
    last = null;
  };

  // A door opens on a double-click, so opening one never gets mixed up with
  // drawing on top of it.
  paper.addEventListener("dblclick", (event) => {
    const box = paper.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * paper.width;
    const y = ((event.clientY - box.top) / box.height) * paper.height;
    const door = doorAt(doors, x, y);
    if (door) hooks.onDoorOpen?.(door);
  });

  paper.addEventListener("pointerup", finish);
  paper.addEventListener("pointercancel", finish);
  paper.addEventListener("pointerleave", (event) => {
    if (tool === "line" || tool === "square") return;
    finish(event);
  });

  return {
    setTool(next) {
      tool = next;
    },
    setColor(next) {
      color = next;
    },
    setSize(next) {
      size = next;
    },
    setLocked(next) {
      locked = next;
      if (next) {
        ghost.clearRect(0, 0, preview.width, preview.height);
        start = null;
        last = null;
      }
    },
    eraseAll() {
      fillPaper();
      ghost.clearRect(0, 0, preview.width, preview.height);
      rememberDoors([]);
    },
    placeText(spot, text) {
      const words = text.trim();
      if (!words) return;
      const height = textHeight(size);
      ink.font = textFont(size);
      ink.textBaseline = "top";
      ink.fillStyle = tool === "eraser" ? PAPER_COLOR : color;
      ink.fillText(words, spot.x, spot.y);
      const found = doorBoxes(words, (run) => ink.measureText(run).width, spot.x, spot.y, height);
      if (found.length > 0) rememberDoors([...doors, ...found]);
    },
    doors() {
      return doors.map((door) => ({ ...door }));
    },
    load(dataUrl, nextDoors = []) {
      return new Promise((resolve) => {
        rememberDoors(nextDoors.map((door) => ({ ...door })));
        if (!dataUrl) {
          fillPaper();
          resolve();
          return;
        }
        const picture = new Image();
        picture.onload = () => {
          fillPaper();
          ink.drawImage(picture, 0, 0, paper.width, paper.height);
          resolve();
        };
        // A drawing that won't load shouldn't strand anybody on a dead round.
        picture.onerror = () => {
          fillPaper();
          resolve();
        };
        picture.src = dataUrl;
      });
    },
    snapshot() {
      return paper.toDataURL("image/png");
    },
  };
}
