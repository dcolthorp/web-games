import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// Best thing first, worst thing last. Every double swaps it for twice as many
// of the next thing down, until it's dirt. After that it's just more dirt.
interface Thing {
  name: string;
  plural: string;
  colors: Record<string, string>;
  sprite: string[];
}

const THINGS: Thing[] = [
  {
    name: "Diamond",
    plural: "Diamonds",
    colors: { c: "#2a9fd6", C: "#8fe6ff", w: "#ffffff" },
    sprite: [
      "..........",
      "..cccccc..",
      ".cCCwCCCc.",
      "cCCwCCCCCc",
      "cccccccccc",
      ".cCCCCCCc.",
      "..cCCCCc..",
      "...cCCc...",
      "....cc....",
      "..........",
    ],
  },
  {
    name: "Crown",
    plural: "Crowns",
    colors: { y: "#ffcf2e", o: "#c98a00", r: "#ff3355", b: "#3a7bff" },
    sprite: [
      "..........",
      "y...yy...y",
      "yy..yy..yy",
      "yyy.yy.yyy",
      "yyyyyyyyyy",
      "yryybyyryy",
      "yyyyyyyyyy",
      "oooooooooo",
      "..........",
      "..........",
    ],
  },
  {
    name: "Gold Bar",
    plural: "Gold Bars",
    colors: { y: "#ffcf2e", Y: "#fff08a", o: "#b37700" },
    sprite: [
      "..........",
      "..........",
      "...yyyyy..",
      "..yYYYYYy.",
      ".yYYYYYYyo",
      "yyyyyyyyoo",
      "yyyyyyyyoo",
      "ooooooooo.",
      "..........",
      "..........",
    ],
  },
  {
    name: "Trophy",
    plural: "Trophies",
    colors: { y: "#ffcf2e", Y: "#fff08a", o: "#b37700", k: "#6b4a2b" },
    sprite: [
      ".yyyyyyyy.",
      "yyYYyyyyyy",
      "y.YyyyyyY.",
      "y.yyyyyyy.",
      ".yyyyyyyy.",
      "..yyyyyy..",
      "....yy....",
      "....oo....",
      "..kkkkkk..",
      "..kkkkkk..",
    ],
  },
  {
    name: "Pizza",
    plural: "Pizzas",
    colors: { k: "#c07a2c", y: "#ffd55a", r: "#d6332b" },
    sprite: [
      "kkkkkkkkkk",
      "kkkkkkkkkk",
      ".yyyyyyyy.",
      ".yryyyyry.",
      "..yyyyyy..",
      "..yyryyy..",
      "...yyyy...",
      "...yyry...",
      "....yy....",
      "....y.....",
    ],
  },
  {
    name: "Cookie",
    plural: "Cookies",
    colors: { t: "#c98a4b", T: "#e0a868", d: "#4a2a14" },
    sprite: [
      "..........",
      "...tttt...",
      "..tTTdTt..",
      ".tdTTTTTt.",
      ".tTTTdTTt.",
      ".tTdTTTdt.",
      ".tTTTTTTt.",
      "..tTdTTt..",
      "...tttt...",
      "..........",
    ],
  },
  {
    name: "Banana Peel",
    plural: "Banana Peels",
    colors: { y: "#ffe14d", b: "#6b4a1a" },
    sprite: [
      "..........",
      "....b.....",
      "....y.....",
      "...yyy....",
      "..yyyyy...",
      ".yy.y.yy..",
      "yy..y..yy.",
      "y...y...y.",
      "....y.....",
      "..........",
    ],
  },
  {
    name: "Stinky Sock",
    plural: "Stinky Socks",
    colors: { w: "#e8e8e0", r: "#d6332b", g: "#7fbf3f" },
    sprite: [
      "..g...g...",
      "...g.g....",
      "..wwww....",
      "..rrrr....",
      "..wwww....",
      "..wwww....",
      "..wwwww...",
      "..wwwwwww.",
      "..wwwwwww.",
      "..........",
    ],
  },
  {
    name: "Rock",
    plural: "Rocks",
    colors: { g: "#7a7a80", G: "#a3a3aa", d: "#4d4d52" },
    sprite: [
      "..........",
      "..........",
      "..........",
      "...gggg...",
      "..gGGggg..",
      ".gGgggggd.",
      ".ggggggdd.",
      "gggggdddd.",
      ".dddddddd.",
      "..........",
    ],
  },
  {
    name: "Dirt",
    plural: "Dirt",
    colors: { d: "#6b4423", D: "#8a5a32", k: "#3d2512" },
    sprite: [
      "..........",
      "..........",
      "..........",
      "..........",
      "....dd....",
      "..dDddkd..",
      ".dkddDddd.",
      "ddddkdddDd",
      "kkkkkkkkkk",
      "..........",
    ],
  },
];

const thingAt = (step: number): Thing => THINGS[Math.min(step, THINGS.length - 1)] as Thing;
const countAt = (step: number): number => 2 ** step;
const label = (step: number): string => {
  const count = countAt(step);
  const thing = thingAt(step);
  return `${count.toLocaleString()} ${count === 1 ? thing.name : thing.plural}`;
};

const canvas = document.getElementById("pile") as HTMLCanvasElement;
const context = canvas.getContext("2d") as CanvasRenderingContext2D;
const question = document.getElementById("question") as HTMLElement;
const buttons = document.getElementById("buttons") as HTMLElement;
const takeButton = document.getElementById("take") as HTMLButtonElement;
const doubleButton = document.getElementById("double") as HTMLButtonElement;
const againButton = document.getElementById("again") as HTMLButtonElement;
const ladder = document.getElementById("ladder") as HTMLOListElement;
const bank = document.getElementById("bank") as HTMLElement;

let step = 0;
let money = 0;

function drawSprite(thing: Thing, x: number, y: number, pixel: number): void {
  thing.sprite.forEach((row, rowIndex) => {
    [...row].forEach((key, columnIndex) => {
      const color = thing.colors[key];
      if (!color) return;
      context.fillStyle = color;
      context.fillRect(x + columnIndex * pixel, y + rowIndex * pixel, pixel, pixel);
    });
  });
}

// Draws one of the thing for every one you'd get, packed into a grid. Past
// 512 they can't all fit, so it shows a full screen and says how many more.
const MAX_DRAWN = 512;

function drawPile(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  const thing = thingAt(step);
  const count = countAt(step);
  const drawn = Math.min(count, MAX_DRAWN);

  // Biggest whole-pixel sprite size where `drawn` of them fit on the canvas.
  let pixel = 24;
  let columns = 1;
  for (; pixel > 1; pixel -= 1) {
    const size = pixel * 10;
    columns = Math.floor(canvas.width / size);
    const rows = Math.floor(canvas.height / size);
    if (columns * rows >= drawn) break;
  }
  const size = pixel * 10;
  columns = Math.floor(canvas.width / size);
  const usedColumns = Math.min(columns, drawn);
  const rows = Math.ceil(drawn / columns);
  const left = Math.floor((canvas.width - usedColumns * size) / 2);
  const top = Math.floor((canvas.height - rows * size) / 2);

  for (let index = 0; index < drawn; index += 1) {
    drawSprite(thing, left + (index % columns) * size, top + Math.floor(index / columns) * size, pixel);
  }

  if (count > MAX_DRAWN) {
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, canvas.height - 56, canvas.width, 56);
    context.fillStyle = "#ffe066";
    context.font = "bold 28px 'Courier New', monospace";
    context.textAlign = "center";
    context.fillText(`+ ${(count - MAX_DRAWN).toLocaleString()} more`, canvas.width / 2, canvas.height - 18);
  }
}

function drawLadder(): void {
  ladder.replaceChildren(
    ...THINGS.map((thing, index) => {
      const item = document.createElement("li");
      item.textContent = thing.name;
      const now = Math.min(step, THINGS.length - 1);
      if (index < now) item.classList.add("is-done");
      if (index === now) item.classList.add("is-now");
      return item;
    })
  );
}

function offer(): void {
  question.textContent = `Do you want ${label(step)}, or double it and give it to the next person?`;
  buttons.hidden = false;
  againButton.hidden = true;
  drawPile();
  drawLadder();
}

takeButton.addEventListener("click", () => {
  const count = countAt(step);
  money += count;
  bank.textContent = `Your money: $${money.toLocaleString()}`;
  question.textContent = `You took ${label(step)}. That's $${count.toLocaleString()}!`;
  buttons.hidden = true;
  againButton.hidden = false;
});

doubleButton.addEventListener("click", () => {
  step += 1;
  offer();
});

againButton.addEventListener("click", () => {
  step = 0;
  offer();
});

offer();
