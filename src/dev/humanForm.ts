import * as sfx from "../shared/sfx";
import { makePerson } from "./dev1Figure";

// Supercharged dev.1's Games. Instead of the usual hello, dev.1 thanks you and
// switches to his human form: a person in a green hoodie with impostor eyes
// walks on, waves, and shows you what he looked like originally by switching
// into dev.0 (a gray hoodie), which glitches out and explodes. He walks back
// on, and a few wheels fly round and smash the System Monitor into dev.1's
// own game, the one he made a long time ago.

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function playHumanForm(hello: HTMLElement, monitor: HTMLElement): Promise<void> {
  const heading = document.getElementById("dev-monitor-heading");
  // The letter tricks are dev.1's normal page; today he has other plans.
  heading?.classList.add("is-busy");

  await typeInto(hello, "I'm supercharged. Thank you. I'll switch to my human form.");
  await wait(1200);
  await hello.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: "forwards" }).finished;

  const stage = document.createElement("div");
  stage.className = "dev1-stage";
  hello.insertAdjacentElement("afterend", stage);
  const person = makePerson();
  stage.appendChild(person);
  const bubble = document.createElement("p");
  bubble.className = "dev1-bubble";
  bubble.hidden = true;
  stage.appendChild(bubble);

  await walkOn(stage, person);
  person.classList.add("is-waving");
  await say(bubble, "Hi, I'm dev.1. You've never seen me in my human form, but fine.");
  await wait(1400);
  person.classList.remove("is-waving");
  await say(bubble, "Anyway, let me switch into dev.0 to show you what I looked like originally.");
  await wait(1400);

  // Back to dev.0: the hoodie goes gray and everything goes wrong.
  bubble.hidden = true;
  person.classList.add("is-dev0");
  sfx.zap(0.2);
  await wait(500);
  person.classList.add("is-glitching");
  bubble.hidden = false;
  bubble.classList.add("is-screaming");
  const screams = ["A", " - A", " - A", " - A", " - A", " A", " A", " A", " A", " A", " "];
  // …and then the scream just keeps going, louder and faster.
  for (let i = 0; i < 24; i++) screams.push("A");
  bubble.textContent = "";
  for (const [i, scream] of screams.entries()) {
    bubble.textContent += scream;
    bubble.style.fontSize = `${1.4 + Math.max(0, i - 10) * 0.06}rem`;
    sfx.bleep(Math.random() * 12 + i * 0.4);
    await wait(i < 11 ? 160 : 70);
  }
  await wait(300);
  explodePerson(stage, person);
  bubble.hidden = true;
  bubble.classList.remove("is-screaming");
  // The scream grew the writing; dev.1 talks at normal size again.
  bubble.style.fontSize = "";
  await wait(1600);

  // And he's back, like nothing happened.
  const again = makePerson();
  stage.appendChild(again);
  await walkOn(stage, again);
  await say(
    bubble,
    "Anyway, since you supercharged me, I'll show you this game I made a long time ago. I set this up and I'm not good at coding, so it took years just to make that cutscene, and it took lifetimes to make the game itself. But anyways, here's the game."
  );
  await wait(1200);

  await smashMonitor(monitor);
  // And there it is.
  again.classList.add("is-pointing");
  if (heading) {
    heading.classList.remove("is-busy");
    heading.textContent = "dev.1's Game";
    const copy = heading.parentElement?.querySelector(".section-copy");
    if (copy) copy.textContent = "The game I made a long time ago.";
  }
}

async function typeInto(element: HTMLElement, text: string): Promise<void> {
  element.textContent = "";
  for (let shown = 1; shown <= text.length; shown++) {
    element.textContent = text.slice(0, shown);
    if (shown % 3 === 0) sfx.bleep(-12);
    await wait(32);
  }
}

async function say(bubble: HTMLElement, text: string): Promise<void> {
  bubble.hidden = false;
  await typeInto(bubble, text);
}

async function walkOn(stage: HTMLElement, person: HTMLElement): Promise<void> {
  const from = stage.clientWidth + 40;
  const to = stage.clientWidth * 0.18;
  person.classList.add("is-walking");
  const steps = window.setInterval(() => sfx.thunk(), 380);
  await person.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], {
    duration: 2400,
    easing: "ease-out",
    fill: "forwards",
  }).finished;
  window.clearInterval(steps);
  person.classList.remove("is-walking");
}

function explodePerson(stage: HTMLElement, person: HTMLElement): void {
  const box = person.getBoundingClientRect();
  sfx.boom(2);
  const flash = document.createElement("div");
  flash.className = "dev-screen-boom";
  document.body.appendChild(flash);
  window.setTimeout(() => flash.remove(), 1200);
  const colours = ["#9aa3ad", "#5c636b", "#46e0f0", "#d9ffe3", "#ff2d55"];
  for (let i = 0; i < 26; i++) {
    const chunk = document.createElement("div");
    chunk.className = "dev-chunk";
    const size = 8 + Math.random() * 18;
    chunk.style.width = `${size}px`;
    chunk.style.height = `${size}px`;
    chunk.style.left = `${box.left + Math.random() * box.width}px`;
    chunk.style.top = `${box.top + Math.random() * box.height}px`;
    chunk.style.background = colours[i % colours.length] ?? "#9aa3ad";
    document.body.appendChild(chunk);
    const flyX = (Math.random() - 0.5) * 600;
    const flyY = -100 - Math.random() * 250;
    chunk
      .animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${flyX * 0.6}px, ${flyY}px) rotate(${Math.random() * 500}deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${flyX}px, ${flyY + 520}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
        ],
        { duration: 1400 + Math.random() * 500, easing: "ease-out", fill: "forwards" }
      )
      .finished.then(() => chunk.remove());
  }
  person.remove();
  stage.animate(
    [{ transform: "translate(0, 0)" }, { transform: "translate(-12px, 6px)" }, { transform: "translate(10px, -6px)" }, { transform: "translate(0, 0)" }],
    { duration: 350 }
  );
}

// Three gear-wheels fly loops round the screen, then all slam into the
// System Monitor at once. When the dust settles it's dev.1's game instead.
async function smashMonitor(monitor: HTMLElement): Promise<void> {
  const size = 46;
  const box = monitor.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const spot = (): string => `translate(${40 + Math.random() * (W - 80 - size)}px, ${40 + Math.random() * (H - 80 - size)}px)`;
  sfx.whir(3);
  const flights = [0, 1, 2].map((index) => {
    const wheel = document.createElement("div");
    wheel.className = "dev-wheel is-fast";
    document.body.appendChild(wheel);
    const target = `translate(${box.left + box.width * (0.25 + index * 0.25) - size / 2}px, ${box.top + box.height / 2 - size / 2}px)`;
    return wheel
      .animate([{ transform: `translate(${W / 2}px, -60px)` }, { transform: spot() }, { transform: spot() }, { transform: spot() }, { transform: target }], {
        duration: 2800,
        delay: index * 150,
        easing: "ease-in-out",
        fill: "forwards",
      })
      .finished.then(() => wheel);
  });
  const wheels = await Promise.all(flights);
  sfx.thunk();
  sfx.boom(1.5);
  wheels.forEach((wheel) => wheel.remove());
  monitor.animate(
    [{ transform: "scale(1)" }, { transform: "scale(0.94) rotate(-1deg)" }, { transform: "scale(1.03) rotate(1deg)" }, { transform: "scale(1)" }],
    { duration: 450 }
  );
  await wait(300);

  // His game: dev.1 Studio, the ultra secret one. This is the only way in.
  monitor.replaceChildren();
  monitor.classList.add("is-dev1-game");
  const game = document.createElement("li");
  game.className = "dev1-game";
  game.innerHTML = `<span class="dev1-game-title">dev.1 Studio</span><span class="dev1-game-note">Make your own dev.1s, put on a show.</span><a class="dev1-game-play" href="./studio/index.html">▶ Play</a>`;
  monitor.appendChild(game);
  sfx.powerUp();
}
