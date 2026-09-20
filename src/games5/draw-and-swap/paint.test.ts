import { describe, expect, it } from "vitest";
import { doorAt, doorBoxes, floodFill, formatClock, parseColor, swapOrder } from "./paint";

function makeCanvas(width: number, height: number, color: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color;
    pixels[i + 1] = color;
    pixels[i + 2] = color;
    pixels[i + 3] = 255;
  }
  return pixels;
}

function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const at = (y * width + x) * 4;
  return Array.from(pixels.slice(at, at + 4));
}

describe("parseColor", () => {
  it("reads long and short hex", () => {
    expect(parseColor("#ff8800")).toEqual({ r: 255, g: 136, b: 0, a: 255 });
    expect(parseColor("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 255 });
  });
});

describe("floodFill", () => {
  it("fills the whole canvas when nothing is in the way", () => {
    const pixels = makeCanvas(4, 4, 255);
    const changed = floodFill(pixels, 4, 4, 0, 0, parseColor("#ff0000"));
    expect(changed).toBe(16);
    expect(pixelAt(pixels, 4, 3, 3)).toEqual([255, 0, 0, 255]);
  });

  it("stops at a drawn line", () => {
    const pixels = makeCanvas(5, 3, 255);
    // A black wall straight down the middle column.
    for (let y = 0; y < 3; y += 1) {
      const at = (y * 5 + 2) * 4;
      pixels[at] = 0;
      pixels[at + 1] = 0;
      pixels[at + 2] = 0;
    }
    const changed = floodFill(pixels, 5, 3, 0, 0, parseColor("#0000ff"));
    expect(changed).toBe(6);
    expect(pixelAt(pixels, 5, 1, 2)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(pixels, 5, 3, 0)).toEqual([255, 255, 255, 255]);
  });

  it("does nothing when the colour is already there", () => {
    const pixels = makeCanvas(3, 3, 255);
    expect(floodFill(pixels, 3, 3, 1, 1, parseColor("#ffffff"))).toBe(0);
  });

  it("ignores clicks outside the paper", () => {
    const pixels = makeCanvas(3, 3, 255);
    expect(floodFill(pixels, 3, 3, -1, 9, parseColor("#000000"))).toBe(0);
  });
});

describe("swapOrder", () => {
  it("leaves everyone on their own paper on the first round", () => {
    expect(swapOrder(4, 0)).toEqual([0, 1, 2, 3]);
  });

  it("passes every paper one seat along", () => {
    expect(swapOrder(4, 1)).toEqual([1, 2, 3, 0]);
  });

  it("hands a lone artist their own paper back", () => {
    expect(swapOrder(1, 1)).toEqual([0]);
  });

  it("wraps all the way round", () => {
    expect(swapOrder(3, 3)).toEqual([0, 1, 2]);
  });
});

describe("formatClock", () => {
  it("counts down in minutes and seconds", () => {
    expect(formatClock(300000)).toBe("5:00");
    expect(formatClock(61000)).toBe("1:01");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("doorBoxes", () => {
  // A stand-in for canvas text measuring: every character is 10 wide.
  const measure = (run: string): number => Array.from(run).length * 10;

  it("finds nothing in plain words", () => {
    expect(doorBoxes("hello", measure, 0, 0, 20)).toEqual([]);
  });

  it("boxes a door where it sits in the line", () => {
    expect(doorBoxes("hi 🚪", measure, 100, 50, 20)).toEqual([
      { x: 130, y: 50, w: 10, h: 20 },
    ]);
  });

  it("boxes every door in the line", () => {
    const doors = doorBoxes("🚪a🚪", measure, 0, 0, 20);
    expect(doors.map((door) => door.x)).toEqual([0, 20]);
  });
});

describe("doorAt", () => {
  const doors = [{ x: 10, y: 10, w: 20, h: 30 }];

  it("opens when you click inside it", () => {
    expect(doorAt(doors, 15, 20)).toBe(doors[0]);
  });

  it("stays shut when you miss", () => {
    expect(doorAt(doors, 5, 20)).toBeNull();
    expect(doorAt(doors, 15, 60)).toBeNull();
  });

  it("picks the newest door when two overlap", () => {
    const stacked = [
      { x: 0, y: 0, w: 50, h: 50 },
      { x: 10, y: 10, w: 10, h: 10 },
    ];
    expect(doorAt(stacked, 15, 15)).toBe(stacked[1]);
  });
});
