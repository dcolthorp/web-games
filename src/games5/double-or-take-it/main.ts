import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { THINGS, drawThing, type Thing } from "./things";

installOofShortcut();
installForceRefreshHotkey();

// You stand at the front of a line of people holding a pile of something. Ask
// the person in front: they either take the pile (and you get $1 for every
// thing in it) or say "double it", and the next person gets offered twice as
// many. The worse the thing, the more people double it.

const SAVE_KEY = "double-or-take-it";

interface Save {
  money: string;
  best: string;
  owned: string[];
  using: string;
}

function load(): Save {
  const fresh: Save = { money: "0", best: "0", owned: ["diamond"], using: "diamond" };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    return { ...fresh, ...saved };
  } catch {
    return fresh;
  }
}

const save = load();
let money = BigInt(save.money);
let best = BigInt(save.best);
const owned = new Set(save.owned);
let using = THINGS.find((thing) => thing.id === save.using && owned.has(thing.id)) ?? (THINGS[0] as Thing);

function persist(): void {
  try {
    const data: Save = { money: String(money), best: String(best), owned: [...owned], using: using.id };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // No saving in this browser. The game still works, it just forgets.
  }
}

const dollars = (amount: bigint): string => `$${amount.toLocaleString("en-US")}`;
const pile = (count: bigint, thing: Thing): string =>
  `${count.toLocaleString("en-US")} ${count === 1n ? thing.name : thing.plural}`;

// ---- The street ----

const canvas = document.getElementById("street") as HTMLCanvasElement;
const context = canvas.getContext("2d") as CanvasRenderingContext2D;
const GROUND = 300;
const PIXEL = 5;
const PLAYER_X = 90;
const FRONT_X = 320;
const SPACING = 72;
const LINE_LENGTH = 9;
const WALK_SECONDS = 0.35;
const ANSWER_SECONDS = 0.5;

const PERSON = [
  "..hhhh..",
  ".hhhhhh.",
  ".hssssh.",
  ".sessse.",
  ".ssssss.",
  "..ssss..",
  ".cccccc.",
  "cccccccc",
  "sccccccs",
  "sccccccs",
  ".cccccc.",
];
const LEGS = [
  [".pp..pp.", ".pp..pp.", ".kk..kk."],
  ["..pppp..", ".pp..pp.", "kk....kk"],
];
const SKINS = ["#f1c9a5", "#d9a074", "#a8693f", "#6e4126", "#ffdcb8"];
const HAIRS = ["#2a1a10", "#6b3f1d", "#e8c14a", "#b8432a", "#1c1c1c", "#d8d8d8"];
const SHIRTS = ["#3a7bff", "#e8323c", "#3fbf5f", "#9b4de0", "#ff9a1f", "#1fc8c8", "#ff5fae", "#4a4a5a"];

interface Person {
  skin: string;
  hair: string;
  shirt: string;
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T;
const newPerson = (): Person => ({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS) });
const PLAYER: Person = { skin: "#f1c9a5", hair: "#ffcf2e", shirt: "#ffcf2e" };

function drawPerson(person: Person, x: number, step: number): void {
  const colors: Record<string, string> = {
    h: person.hair,
    s: person.skin,
    e: "#111111",
    c: person.shirt,
    p: "#2b3a66",
    k: "#1a1a1a",
  };
  const rows = [...PERSON, ...(LEGS[step % 2] as string[])];
  const top = GROUND - rows.length * PIXEL;
  rows.forEach((row, rowIndex) => {
    [...row].forEach((key, columnIndex) => {
      const color = colors[key];
      if (!color) return;
      context.fillStyle = color;
      context.fillRect(Math.round(x) + columnIndex * PIXEL, top + rowIndex * PIXEL, PIXEL, PIXEL);
    });
  });
}

interface Leaver {
  person: Person;
  x: number;
  carrying: Thing | null;
}

interface Popup {
  text: string;
  age: number;
}

let line: Person[] = Array.from({ length: LINE_LENGTH }, newPerson);
const leavers: Leaver[] = [];
const popups: Popup[] = [];
let shift = 0; // 1 right after someone leaves, sliding to 0 as the line steps up
let phase: "walking" | "ready" | "answering" = "ready";
let answerTimer = 0;
let answer: "take" | "double" = "take";
let count = 1n;
let walkClock = 0;

function draw(): void {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3b2a4f";
  context.fillRect(0, GROUND, canvas.width, canvas.height - GROUND);
  context.fillStyle = "#4e3a66";
  for (let x = 0; x < canvas.width; x += 40) context.fillRect(x, GROUND, 20, PIXEL);

  const legStep = Math.floor(walkClock * 8);
  for (const leaver of leavers) {
    drawPerson(leaver.person, leaver.x, legStep);
    if (leaver.carrying) drawThing(context, leaver.carrying, leaver.x - 5, GROUND - 105, 5);
  }

  for (let index = line.length - 1; index >= 0; index -= 1) {
    const person = line[index] as Person;
    drawPerson(person, FRONT_X + (index + shift) * SPACING, shift > 0 ? legStep + index : 0);
  }

  drawPerson(PLAYER, PLAYER_X, 0);
  drawThing(context, using, PLAYER_X + 44, GROUND - 75, 5);

  if (phase === "answering") {
    const text = answer === "take" ? "I'll take it!" : "Double it!";
    context.font = "bold 22px 'Courier New', monospace";
    const width = context.measureText(text).width + 24;
    const x = FRONT_X + 20 - width / 2;
    const y = GROUND - 130;
    context.fillStyle = answer === "take" ? "#19a35b" : "#e0335f";
    context.fillRect(x, y, width, 38);
    context.fillRect(FRONT_X + 15, y + 38, 10, 10);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText(text, x + width / 2, y + 26);
  }

  context.textAlign = "center";
  context.font = "bold 26px 'Courier New', monospace";
  for (const popup of popups) {
    context.fillStyle = `rgba(125, 255, 176, ${Math.max(0, 1 - popup.age / 1.4)})`;
    context.fillText(popup.text, canvas.width / 2, 70 - popup.age * 30);
  }
}

function update(seconds: number): void {
  walkClock += seconds;
  for (const leaver of leavers) leaver.x -= seconds * 260;
  while (leavers[0] && leavers[0].x < -60) leavers.shift();
  for (const popup of popups) popup.age += seconds;
  while (popups[0] && popups[0].age > 1.4) popups.shift();

  if (phase === "answering") {
    answerTimer -= seconds;
    if (answerTimer <= 0) finishAnswer();
  } else if (phase === "walking") {
    shift = Math.max(0, shift - seconds / WALK_SECONDS);
    if (shift === 0) {
      phase = "ready";
      refresh();
    }
  }
}

// ---- Asking ----

function ask(): void {
  if (phase !== "ready") return;
  answer = Math.random() * 100 < using.doubleChance ? "double" : "take";
  phase = "answering";
  answerTimer = ANSWER_SECONDS;
  refresh();
}

function finishAnswer(): void {
  const asked = line.shift() as Person;
  line.push(newPerson());
  leavers.push({ person: asked, x: FRONT_X, carrying: answer === "take" ? using : null });
  shift = 1;
  phase = "walking";

  if (answer === "take") {
    money += count;
    if (count > best) best = count;
    popups.push({ text: `+${dollars(count)}`, age: 0 });
    status.textContent = `They took ${pile(count, using)}. You got ${dollars(count)}!`;
    count = 1n;
    persist();
  } else {
    status.textContent = `They said double it! The next person gets ${pile(count * 2n, using)}.`;
    count *= 2n;
  }
  refresh();
}

// ---- Page ----

const offer = document.getElementById("offer") as HTMLElement;
const odds = document.getElementById("odds") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const askButton = document.getElementById("ask") as HTMLButtonElement;
const moneyLine = document.getElementById("money") as HTMLElement;
const bestLine = document.getElementById("best") as HTMLElement;
const shop = document.getElementById("shop") as HTMLOListElement;

function refresh(): void {
  offer.textContent = `Offering: ${pile(count, using)}`;
  odds.textContent = `People double it ${using.doubleChance}% of the time.`;
  askButton.disabled = phase !== "ready";
  moneyLine.textContent = `Your money: ${dollars(money)}`;
  bestLine.textContent = `Biggest take: ${dollars(best)}`;
  renderShop();
}

function renderShop(): void {
  shop.replaceChildren(
    ...THINGS.map((thing) => {
      const row = document.createElement("li");
      row.className = "shop-row";
      if (thing === using) row.classList.add("is-using");

      const picture = document.createElement("canvas");
      picture.width = 40;
      picture.height = 40;
      const pictureContext = picture.getContext("2d");
      if (pictureContext) drawThing(pictureContext, thing, 0, 0, 4);

      const words = document.createElement("span");
      words.className = "shop-words";
      words.innerHTML = `<strong></strong><small>${thing.doubleChance}% double it</small>`;
      (words.querySelector("strong") as HTMLElement).textContent = thing.name;

      const button = document.createElement("button");
      button.type = "button";
      if (thing === using) {
        button.textContent = "USING";
        button.disabled = true;
      } else if (owned.has(thing.id)) {
        button.textContent = "USE";
        button.addEventListener("click", () => use(thing));
      } else {
        button.textContent = `BUY ${dollars(thing.price)}`;
        button.className = "buy";
        button.disabled = money < thing.price;
        button.addEventListener("click", () => buy(thing));
      }
      row.append(picture, words, button);
      return row;
    })
  );
}

// Switching to a different thing starts a fresh pile of one.
function use(thing: Thing): void {
  using = thing;
  count = 1n;
  status.textContent = `Now you're giving out ${thing.plural}.`;
  persist();
  refresh();
}

function buy(thing: Thing): void {
  if (money < thing.price) return;
  money -= thing.price;
  owned.add(thing.id);
  use(thing);
  status.textContent = `You bought ${thing.name === thing.plural ? "" : "a "}${thing.name}!`;
}

askButton.addEventListener("click", ask);
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Enter") return;
  event.preventDefault();
  ask();
});

let last = performance.now();
function frame(now: number): void {
  update(Math.min((now - last) / 1000, 0.05));
  last = now;
  draw();
  requestAnimationFrame(frame);
}

status.textContent = "Walk up and ask. Will they take it or double it?";
refresh();
requestAnimationFrame(frame);
