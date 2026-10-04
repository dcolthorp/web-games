export {};

// A Credits button on every page of the site. The credits roll like the end
// of a movie, except every name has been scribbled out, so nobody can tell who
// made anything. The letters under the scribbles are random every time, so not
// even peeking at the page's code gives the names away.

// Sits just left of the DOM gallery's invisible door in the very corner, so
// the two never fight over clicks.
const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .open { position: fixed; z-index: 2147483600; top: 10px; right: 172px; border: 2px solid rgba(255,255,255,.55); border-radius: 999px; padding: 5px 12px; background: rgba(0,0,0,.6); color: #fff; font: 800 12px/1 "Trebuchet MS", sans-serif; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
  .open:hover, .open:focus-visible { background: #000; border-color: #fff; outline: none; }
  .screen { position: fixed; z-index: 2147483600; inset: 0; overflow: hidden; background: #000; color: #fff; font-family: "Trebuchet MS", sans-serif; text-align: center; cursor: pointer; animation: fade-in 400ms ease-out; }
  .screen[hidden] { display: none; }
  .roll { position: absolute; left: 0; right: 0; top: 70%; display: flex; flex-direction: column; align-items: center; gap: 46px; padding: 0 16px 40vh; animation: roll 18s linear forwards; }
  .game { margin: 0; font: 900 clamp(30px, 7vw, 64px)/1.05 Impact, Haettenschweiler, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
  .role { margin: 0 0 10px; color: #a9a9a9; font-size: 14px; letter-spacing: .3em; text-transform: uppercase; }
  .name { position: relative; display: inline-block; padding: 0 10px; font: 800 clamp(24px, 5vw, 38px)/1.2 "Trebuchet MS", sans-serif; }
  .name svg { position: absolute; inset: -6px -4px; width: calc(100% + 8px); height: calc(100% + 12px); overflow: visible; }
  .end { margin: 0; font: 900 clamp(26px, 5vw, 44px)/1.1 Impact, Haettenschweiler, sans-serif; text-transform: uppercase; }
  .close { position: fixed; top: 14px; left: 14px; border: 2px solid #fff; border-radius: 999px; padding: 7px 14px; background: #000; color: #fff; font: 800 13px "Trebuchet MS", sans-serif; cursor: pointer; }
  @keyframes roll { to { transform: translateY(calc(-100% + 15vh)); } }
  @keyframes fade-in { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .roll { animation: none; top: 60px; } }
`;

const ROLES = ["Made by", "Game design", "Art", "Music & sounds", "Coding", "Special thanks"];

const host = document.createElement("div");
host.className = "site-credits";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `<style>${STYLE}</style>`;

const openButton = document.createElement("button");
openButton.type = "button";
openButton.className = "open";
openButton.textContent = "Credits";

const screen = document.createElement("div");
screen.className = "screen";
screen.hidden = true;
screen.setAttribute("role", "dialog");
screen.setAttribute("aria-label", "Credits");

shadow.append(openButton, screen);
document.body.appendChild(host);

openButton.addEventListener("click", (event) => {
  event.stopPropagation();
  showCredits();
});
screen.addEventListener("click", hideCredits);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !screen.hidden) hideCredits();
});

function showCredits(): void {
  const roll = document.createElement("div");
  roll.className = "roll";

  const game = document.createElement("p");
  game.className = "game";
  game.textContent = gameName();
  roll.appendChild(game);

  for (const role of ROLES) {
    const block = document.createElement("div");
    const label = document.createElement("p");
    label.className = "role";
    label.textContent = role;
    block.append(label, scribbledName());
    roll.appendChild(block);
  }

  const end = document.createElement("p");
  end.className = "end";
  end.textContent = "Thanks for playing";
  roll.appendChild(end);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "✕ Close";

  screen.replaceChildren(roll, close);
  screen.hidden = false;
  openButton.hidden = true;
  close.focus();
}

function hideCredits(): void {
  screen.hidden = true;
  screen.replaceChildren();
  openButton.hidden = false;
}

function gameName(): string {
  const title = document.title.trim();
  return title || "Oscar's Games";
}

// A made-up name, then a heavy ballpoint scribble right over the top of it.
function scribbledName(): HTMLElement {
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = randomName();
  name.setAttribute("aria-label", "Name scribbled out");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 40");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  for (const width of [7, 4]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", scribblePath());
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#f4f4f4");
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);
  }
  name.appendChild(svg);
  return name;
}

function randomName(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const word = (length: number): string => {
    let text = "";
    for (let index = 0; index < length; index += 1) {
      text += letters[Math.floor(Math.random() * letters.length)];
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  return `${word(4 + Math.floor(Math.random() * 4))} ${word(5 + Math.floor(Math.random() * 5))}`;
}

// Back and forth across the name, zigzagging up and down, so no letter is left
// readable.
function scribblePath(): string {
  const jitter = (amount: number): number => (Math.random() - 0.5) * amount;
  let d = `M ${jitter(4)} ${20 + jitter(16)}`;
  const passes = 5 + Math.floor(Math.random() * 2);
  for (let pass = 0; pass < passes; pass += 1) {
    const goingRight = pass % 2 === 0;
    for (let step = 1; step <= 14; step += 1) {
      const x = goingRight ? (step / 14) * 100 : 100 - (step / 14) * 100;
      const y = step % 2 === 0 ? 4 + Math.random() * 8 : 28 + Math.random() * 10;
      d += ` L ${(x + jitter(6)).toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
}
