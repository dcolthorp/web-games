import { isDevZeroRebuilt } from "../shared/devZero";
import * as sfx from "../shared/sfx";
import { isThisHubSupercharged, rememberSuperchargedHub } from "../shared/superchargedHub";
import { playHumanForm } from "./humanForm";

// dev.1's own hub. dev.0 was the very first Oscar's Games; once it's been
// rebuilt it watches over every hub that got built on top of it. Before then
// there's nothing here but a broken page.

interface System {
  name: string;
  path: string;
}

const SYSTEMS: System[] = [
  { name: "Oscar's Games", path: "../index.html" },
  { name: "Penelope's Games", path: "../penelope/index.html" },
  { name: "BIG games", path: "../big-games/index.html" },
  { name: "Games 2", path: "../games2/index.html" },
  { name: "Games 3", path: "../games3/index.html" },
  { name: "Games 4", path: "../games4/index.html" },
  { name: "Games 5", path: "../games5/index.html" },
  { name: "Mods & DLCs", path: "../mods/index.html" },
];

const hello = document.getElementById("dev-hello");
const monitor = document.getElementById("dev-monitor");

if (!isDevZeroRebuilt()) {
  document.body.classList.add("is-broken");
  if (hello) hello.textContent = "ERROR: dev.0 is still broken. Go back and fix it.";
} else if (isThisHubSupercharged() && hello && monitor) {
  // Reached through the Supercharged Paradox: dev.1 has something to show you.
  renderMonitor();
  void playHumanForm(hello, monitor);
} else {
  typeOut("Hi. It's me, dev.1. I was here first. Pick a system and I'll boot it up for you.");
  renderMonitor();
  installLaserO();
}

function typeOut(text: string): void {
  if (!hello) return;
  let shown = 0;
  const step = (): void => {
    shown += 1;
    hello.textContent = text.slice(0, shown);
    if (shown < text.length) window.setTimeout(step, 30);
  };
  step();
}

function renderMonitor(): void {
  if (!monitor) return;
  SYSTEMS.forEach((system, index) => {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.className = "dev-system";
    link.href = system.path;
    // Each one "boots" a moment after the last, like a computer starting up.
    link.style.animationDelay = `${0.4 + index * 0.25}s`;

    const name = document.createElement("span");
    name.className = "dev-system-name";
    name.textContent = system.name;
    const status = document.createElement("span");
    status.className = "dev-system-status";
    status.textContent = "RUNNING";

    link.append(name, status);
    row.appendChild(link);
    monitor.appendChild(row);
  });
}

// The last two letters of "System Monitor" are secretly weapons, one shot each
// until the page is reloaded. The second O is a laser that zaps one random
// system. The R's legs turn into rockets and it rams another one side-on.
function installLaserO(): void {
  const cannon = document.getElementById("dev-laser-o");
  const rocketR = document.getElementById("dev-rocket-r");
  if (!cannon || !rocketR) return;

  cannon.addEventListener("click", () => {
    if (cannon.classList.contains("is-spent")) return;
    const target = randomRunningSystem();
    if (!target) return;
    cannon.classList.add("is-spent");
    zap(cannon, target);
  });

  installWInTheChat();
  installZigzagZ();
  installHulaHoop();
  installPogoI();
  installMalletT();
  installSystemSupercharge();

  rocketR.addEventListener("click", () => {
    if (rocketR.classList.contains("is-spent") || rocketR.classList.contains("is-flying")) return;
    const target = randomRunningSystem();
    if (target) rocketRam(rocketR, target);
  });
}

// Systems something is already on its way to hit. Whatever picks a target
// calls dibs on it, so two attacks never go for the same one: the second just
// picks again from what's left, until it finds one that's free.
const claimed = new Set<HTMLElement>();

// Mods & DLCs never gets to be the last one standing: when it's one of the
// final two free systems, it's the one that gets hit.
const NEVER_SUPERCHARGED = "../mods/index.html";

function claimRandom(selector: string): HTMLElement | undefined {
  if (!monitor) return undefined;
  const free = Array.from(monitor.querySelectorAll<HTMLElement>(selector)).filter((system) => !claimed.has(system));
  const mods = free.find((system) => system.getAttribute("href") === NEVER_SUPERCHARGED);
  const target = mods && free.length <= 2 ? mods : free[Math.floor(Math.random() * free.length)];
  if (target) claimed.add(target);
  return target;
}

// A system that's still RUNNING. Every attack, cracking or exploding, only
// goes for these, so the seven Monitor letters hit seven different systems
// and exactly one is left standing for "System" to supercharge.
function randomRunningSystem(): HTMLElement | undefined {
  return claimRandom(".dev-system:not(.is-unstable):not(.is-exploded):not(.is-supercharged)");
}

// A flying copy of the R, with its legs turned into rockets, lifts straight
// up, curves smoothly over beside the target and slams into its end. Then it
// flies home and lands.
function rocketRam(letterButton: HTMLElement, target: HTMLElement): void {
  letterButton.classList.add("is-flying");
  const home = letterButton.getBoundingClientRect();
  const style = getComputedStyle(letterButton);

  const rocket = document.createElement("div");
  rocket.className = "dev-flying-r";
  rocket.style.width = `${home.width}px`;
  rocket.style.height = `${home.height}px`;
  const letter = document.createElement("span");
  letter.textContent = letterButton.textContent ?? "r";
  letter.style.font = style.font;
  letter.style.letterSpacing = style.letterSpacing;
  letter.style.textTransform = style.textTransform;
  letter.style.color = style.color;
  rocket.appendChild(letter);
  for (const side of ["left", "right"]) {
    const leg = document.createElement("span");
    leg.className = `dev-rocket-leg dev-rocket-leg-${side}`;
    rocket.appendChild(leg);
  }
  document.body.appendChild(rocket);
  sfx.rocket(5);

  // Everything below is in terms of where the R's top-left corner goes. The
  // flying R is pinned to the screen's top-left, so moving it there is just
  // translating by x and y.
  const at = (x: number, y: number): string => `translate(${x}px, ${y}px)`;
  const tilt = (degrees: number): string => ` rotate(${degrees}deg)`;
  const box = target.getBoundingClientRect();
  const fromLeft = Math.random() < 0.5;
  const rowY = box.top + box.height / 2 - home.height / 2;
  // Where it waits beside the game before charging, kept on screen.
  const lineUpX = Math.min(
    Math.max(fromLeft ? box.left - home.width - 140 : box.right + 140, 10),
    window.innerWidth - home.width - 10
  );
  const hitX = fromLeft ? box.left - home.width * 0.4 : box.right - home.width * 0.6;
  // Only a gentle lean, toward wherever it's heading.
  const lean = fromLeft ? 1 : -1;
  const liftY = home.top - 70;

  // One smooth curve from the top of the lift-off to the line-up spot, bending
  // out sideways first and then down to the game's row.
  const curve: Keyframe[] = [];
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = (1 - t) * (1 - t) * home.left + 2 * (1 - t) * t * lineUpX + t * t * lineUpX;
    const y = (1 - t) * (1 - t) * liftY + 2 * (1 - t) * t * liftY + t * t * rowY;
    curve.push({ transform: at(x, y) + tilt(lean * 12 * Math.sin(t * Math.PI)), offset: 0.2 + t * 0.55 });
  }

  // Legs sprout first, then lift-off.
  window.setTimeout(() => rocket.classList.add("has-rockets"), 10);

  const flight = rocket.animate(
    [
      { transform: at(home.left, home.top) + tilt(0), offset: 0 },
      { transform: at(home.left, home.top) + tilt(0), offset: 0.06, easing: "ease-in-out" },
      { transform: at(home.left, liftY) + tilt(0), offset: 0.2 },
      ...curve,
      // A short pause to aim, leaning in…
      { transform: at(lineUpX, rowY) + tilt(lean * 20), offset: 0.84, easing: "ease-in" },
      // …and charge.
      { transform: at(hitX, rowY) + tilt(lean * 20), offset: 1 },
    ],
    { duration: 5000, fill: "forwards" }
  );

  flight.onfinish = () => {
    sfx.thunk();
    const boom = document.createElement("div");
    boom.className = "dev-laser-spark dev-rocket-boom";
    boom.style.left = `${fromLeft ? box.left : box.right}px`;
    boom.style.top = `${box.top + box.height / 2}px`;
    document.body.appendChild(boom);
    window.setTimeout(() => boom.remove(), 400);
    crack(target, fromLeft ? 2 : target.clientWidth - 2);

    // Bounce off, then head home.
    const bounceX = fromLeft ? hitX - 50 : hitX + 50;
    sfx.rocket(2.2);
    const goHome = rocket.animate(
      [
        { transform: at(hitX, rowY) + tilt(lean * 20) },
        { transform: at(bounceX, rowY - 20) + tilt(0), offset: 0.2 },
        { transform: at(home.left, liftY) + tilt(0), offset: 0.75 },
        { transform: at(home.left, home.top) + tilt(0) },
      ],
      { duration: 2200, easing: "ease-in-out", fill: "forwards" }
    );
    goHome.onfinish = () => {
      rocket.classList.remove("has-rockets");
      window.setTimeout(() => {
        rocket.remove();
        letterButton.classList.remove("is-flying");
        letterButton.classList.add("is-spent");
      }, 250);
    };
  };
}

function zap(cannon: HTMLElement, target: HTMLElement): void {
  sfx.laser();
  const from = cannon.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  // Hits somewhere along the row, not always dead centre.
  const endX = to.left + to.width * (0.2 + Math.random() * 0.6);
  const endY = to.top + to.height / 2;

  const beam = document.createElement("div");
  beam.className = "dev-laser-beam";
  beam.style.left = `${startX}px`;
  beam.style.top = `${startY}px`;
  beam.style.width = `${Math.hypot(endX - startX, endY - startY)}px`;
  beam.style.transform = `rotate(${Math.atan2(endY - startY, endX - startX)}rad)`;
  document.body.appendChild(beam);

  const spark = document.createElement("div");
  spark.className = "dev-laser-spark";
  spark.style.left = `${endX}px`;
  spark.style.top = `${endY}px`;
  document.body.appendChild(spark);

  cannon.classList.remove("is-firing");
  void cannon.offsetWidth;
  cannon.classList.add("is-firing");

  window.setTimeout(() => {
    beam.remove();
    spark.remove();
    crack(target, endX - to.left);
  }, 260);
}

// Jagged crack lines spreading out from where the laser hit, and the status
// flips from RUNNING to UNSTABLE.
function crack(target: HTMLElement, hitX: number): void {
  claimed.delete(target);
  // A laser or rocket can be on its way when something else blows the system
  // up. There's nothing left to crack by then, so it stays EXPLODED.
  if (target.classList.contains("is-exploded")) return;
  // The boot-up delay would hold back the shake, so drop it now.
  target.style.animationDelay = "0s";
  target.classList.add("is-unstable");
  sfx.crack();
  const status = target.querySelector(".dev-system-status");
  if (status) status.textContent = "UNSTABLE";

  const width = target.clientWidth;
  const height = target.clientHeight;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "dev-crack");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");

  const centreY = height / 2;
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = (arm / 6) * Math.PI * 2 + Math.random() * 0.6;
    let x = hitX;
    let y = centreY;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const reach = 30 + Math.random() * 70;
    for (let step = 0; step < 5; step += 1) {
      const wobble = angle + (Math.random() - 0.5) * 1.1;
      x += Math.cos(wobble) * (reach / 5);
      y += Math.sin(wobble) * (reach / 5);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  target.appendChild(svg);
}

// The M in "Monitor" flips over into a W, stretches out to say W in the chat,
// and then one random system blows up. One go per page load, like the others.
function installWInTheChat(): void {
  const letter = document.getElementById("dev-m");
  const wrap = letter?.parentElement;
  if (!letter || !wrap) return;

  letter.addEventListener("click", () => {
    if (letter.classList.contains("is-spent")) return;
    letter.classList.add("is-spent", "is-flipping");
    sfx.whoosh(0.5);

    // Halfway through the flip it's upside down, which is when M becomes W.
    window.setTimeout(() => {
      letter.textContent = "W";
      letter.setAttribute("aria-label", "W");
    }, 250);

    window.setTimeout(() => {
      letter.classList.remove("is-flipping");
      const banner = document.createElement("span");
      banner.className = "dev-w-banner";
      banner.textContent = "W IN THE CHAT BOIIIIII";
      wrap.appendChild(banner);
      window.setTimeout(() => banner.classList.add("is-out"), 20);
      sfx.chime();
      window.setTimeout(() => banner.classList.remove("is-out"), 3800);
      window.setTimeout(() => banner.remove(), 4400);
    }, 550);

    window.setTimeout(() => {
      const target = randomRunningSystem();
      if (target) explode(target);
    }, 2100);
  });
}

// A flash, then the row bursts into chunks that fly out and fall, leaving a
// scorched, dead slot behind.
function explode(target: HTMLElement): void {
  target.style.animationDelay = "0s";
  target.classList.add("is-about-to-blow");

  window.setTimeout(() => {
    sfx.boom(1);
    const box = target.getBoundingClientRect();
    burstChunks(box, 18, 500);

    const boom = document.createElement("div");
    boom.className = "dev-laser-spark dev-explosion";
    boom.style.left = `${box.left + box.width / 2}px`;
    boom.style.top = `${box.top + box.height / 2}px`;
    document.body.appendChild(boom);
    window.setTimeout(() => boom.remove(), 700);

    document.querySelector(".menu-shell")?.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-10px, 6px)" },
        { transform: "translate(9px, -7px)" },
        { transform: "translate(-6px, 4px)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 400 }
    );

    target.classList.remove("is-about-to-blow", "is-unstable");
    target.classList.add("is-exploded");
    claimed.delete(target);
    target.querySelector(".dev-crack")?.remove();
    const status = target.querySelector(".dev-system-status");
    if (status) status.textContent = "EXPLODED";
  }, 450);
}


const Z_POWERS = [
  { name: "LIGHTNING POWER", emoji: "⚡", colour: "#ffe14d" },
  { name: "FIRE POWER", emoji: "🔥", colour: "#ff7a1f" },
  { name: "ICE POWER", emoji: "❄️", colour: "#7fe8ff" },
  { name: "RAINBOW POWER", emoji: "🌈", colour: "#ff5cd6" },
  { name: "POISON POWER", emoji: "☠️", colour: "#a6ff3d" },
];

// The N in "Monitor" tips over sideways into a Z. A pencil zigzags across the
// whole screen drawing a giant Z, the Z shrinks down, picks up a random power,
// and flies off to blow up a random system. One go per page load.
function installZigzagZ(): void {
  const letter = document.getElementById("dev-n");
  if (!letter) return;

  letter.addEventListener("click", () => {
    if (letter.classList.contains("is-spent")) return;
    letter.classList.add("is-spent", "is-tipping");
    sfx.whoosh(0.4);
    // An N turned on its side is a Z, so swap it once it's lying down.
    window.setTimeout(() => {
      letter.classList.remove("is-tipping");
      letter.textContent = "z";
      letter.setAttribute("aria-label", "z");
    }, 400);
    window.setTimeout(drawGiantZ, 600);
  });
}

function drawGiantZ(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const left = width * 0.12;
  const right = width * 0.88;
  const top = height * 0.15;
  const bottom = height * 0.85;

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("class", "dev-giant-z");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("d", `M ${left} ${top} L ${right} ${top} L ${left} ${bottom} L ${right} ${bottom}`);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const pencil = document.createElement("div");
  pencil.className = "dev-pencil";
  pencil.textContent = "✏️";
  document.body.appendChild(pencil);

  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;

  const drawMs = 2200;
  sfx.scribble(drawMs / 1000);
  const started = performance.now();
  const draw = (now: number): void => {
    const progress = Math.min((now - started) / drawMs, 1);
    const drawn = length * progress;
    path.style.strokeDashoffset = `${length - drawn}`;
    const point = path.getPointAtLength(drawn);
    // The emoji's tip is its bottom-left corner, so put that on the line.
    pencil.style.transform = `translate(${point.x}px, ${point.y - pencil.offsetHeight}px)`;
    if (progress < 1) {
      requestAnimationFrame(draw);
    } else {
      pencil.remove();
      shrinkAndPowerUp(svg, path);
    }
  };
  requestAnimationFrame(draw);
}

function shrinkAndPowerUp(svg: SVGSVGElement, path: SVGPathElement): void {
  const power = Z_POWERS[Math.floor(Math.random() * Z_POWERS.length)] ?? Z_POWERS[0]!;
  const small = 0.12;

  const shrink = svg.animate([{ transform: "scale(1)" }, { transform: `scale(${small})` }], {
    duration: 900,
    easing: "ease-in-out",
    fill: "forwards",
  });

  shrink.onfinish = () => {
    svg.style.setProperty("--power-colour", power.colour);
    svg.classList.add("is-powered");
    sfx.powerUp();
    path.style.stroke = power.colour;

    const label = document.createElement("div");
    label.className = "dev-power-label";
    label.style.color = power.colour;
    label.textContent = `${power.emoji} ${power.name} ${power.emoji}`;
    document.body.appendChild(label);

    window.setTimeout(() => {
      label.remove();
      const target = randomRunningSystem();
      if (!target) {
        svg.remove();
        return;
      }
      const box = target.getBoundingClientRect();
      const dx = box.left + box.width / 2 - window.innerWidth / 2;
      const dy = box.top + box.height / 2 - window.innerHeight / 2;
      sfx.whoosh(0.65);
      const fly = svg.animate(
        [
          { transform: `translate(0, 0) scale(${small})` },
          { transform: `translate(${dx}px, ${dy}px) scale(${small * 0.6})` },
        ],
        { duration: 650, easing: "ease-in", fill: "forwards" }
      );
      fly.onfinish = () => {
        svg.remove();
        explode(target);
      };
    }, 1500);
  };
}

// Bits of debris flung up out of a box, falling and spinning away.
function burstChunks(box: DOMRect, count: number, spread: number): void {
  const colours = ["#ffb02e", "#ff2d55", "#5cff8a", "#04110a", "#fff7c2"];
  for (let index = 0; index < count; index += 1) {
    const chunk = document.createElement("div");
    chunk.className = "dev-chunk";
    const size = 8 + Math.random() * 22;
    chunk.style.width = `${size}px`;
    chunk.style.height = `${size * (0.5 + Math.random())}px`;
    chunk.style.left = `${box.left + Math.random() * box.width}px`;
    chunk.style.top = `${box.top + Math.random() * box.height}px`;
    chunk.style.background = colours[index % colours.length] ?? "#ffb02e";
    document.body.appendChild(chunk);
    const flyX = (Math.random() - 0.5) * spread;
    const flyY = -80 - Math.random() * (spread * 0.45);
    chunk
      .animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${flyX * 0.6}px, ${flyY}px) rotate(${Math.random() * 400}deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${flyX}px, ${flyY + 520}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 500, easing: "ease-out", fill: "forwards" }
      )
      .finished.then(() => chunk.remove());
  }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

// The first O in "Monitor" pops out and grows into a hula hoop. A random
// system sprouts hands, grabs it and tries to hula hoop. It can't. FAIL, the
// whole screen blows up, and when the smoke clears only that one is gone.
function installHulaHoop(): void {
  const letter = document.getElementById("dev-hoop-o");
  if (!letter) return;

  letter.addEventListener("click", () => {
    if (letter.classList.contains("is-spent")) return;
    const target = randomRunningSystem();
    if (!target) return;
    letter.classList.add("is-spent", "is-flying");
    void hulaHoopFail(letter, target);
  });
}

async function hulaHoopFail(letter: HTMLElement, target: HTMLElement): Promise<void> {
  const from = letter.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const centreX = box.left + box.width / 2;
  const size = 170;

  // 1. The O grows into a hoop and floats up over the system.
  sfx.whoosh(1.1);
  const hoop = document.createElement("div");
  hoop.className = "dev-hoop";
  hoop.style.width = `${size}px`;
  hoop.style.height = `${size}px`;
  document.body.appendChild(hoop);
  const hoverX = centreX - size / 2;
  const hoverY = box.top - size - 70;
  const startScale = from.width / size;
  await hoop.animate(
    [
      { transform: `translate(${from.left + from.width / 2 - size / 2}px, ${from.top + from.height / 2 - size / 2}px) scale(${startScale})` },
      { transform: `translate(${hoverX}px, ${hoverY}px) scale(1) rotate(360deg)` },
    ],
    { duration: 1100, easing: "ease-in-out", fill: "forwards" }
  ).finished;

  // 2. The system grows two arms with hands and reaches up for it.
  sfx.boing();
  const arms = [-1, 1].map((side) => {
    const arm = document.createElement("div");
    arm.className = "dev-arm";
    const hand = document.createElement("span");
    hand.className = "dev-hand";
    hand.textContent = side < 0 ? "🤚" : "✋";
    arm.appendChild(hand);
    arm.style.left = `${centreX + side * 70 - 4}px`;
    arm.style.top = `${box.top - 110}px`;
    document.body.appendChild(arm);
    arm.animate(
      [
        { transform: "scaleY(0) rotate(0deg)" },
        { transform: `scaleY(1) rotate(${side * 12}deg)`, offset: 0.5 },
        { transform: `scaleY(1) rotate(${side * -6}deg)`, offset: 0.75 },
        { transform: `scaleY(1) rotate(${side * 10}deg)` },
      ],
      { duration: 1200, easing: "ease-out", fill: "forwards" }
    );
    return arm;
  });
  await wait(1300);

  // 3. Grab! The hoop gets pulled down onto the system and goes flat around
  // its middle, and the arms let go.
  sfx.thunk();
  const waistY = box.top + box.height / 2 - size / 2;
  for (const arm of arms) {
    arm.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 400, fill: "forwards" });
  }
  await hoop.animate(
    [
      { transform: `translate(${hoverX}px, ${hoverY}px) scale(1)` },
      { transform: `translate(${hoverX}px, ${waistY}px) scale(1.6, 0.25)` },
    ],
    { duration: 500, easing: "ease-in", fill: "forwards" }
  ).finished;
  arms.forEach((arm) => arm.remove());

  // 4. Hula! The system wiggles, the hoop swings round… and gets wobblier…
  target.style.animationDelay = "0s";
  target.classList.add("is-hula");
  for (let swing = 0; swing < 8; swing += 1) window.setTimeout(() => sfx.whoosh(0.25), swing * 275);
  const swings: string[] = [];
  for (let swing = 0; swing <= 8; swing += 1) {
    const reach = 60 + swing * 12;
    const x = hoverX + (swing % 2 === 0 ? -reach : reach);
    swings.push(`translate(${x}px, ${waistY + swing * 6}px) scale(1.6, 0.25) rotate(${(swing % 2 === 0 ? -1 : 1) * swing}deg)`);
  }
  await hoop.animate(
    swings.map((transform) => ({ transform })),
    { duration: 2200, easing: "ease-in-out", fill: "forwards" }
  ).finished;

  // …and it drops straight off the bottom of the screen.
  target.classList.remove("is-hula");
  hoop.animate(
    [{ transform: swings[swings.length - 1] ?? "" }, { transform: `translate(${hoverX}px, ${window.innerHeight + 200}px) scale(1.6, 0.25) rotate(25deg)` }],
    { duration: 700, easing: "ease-in", fill: "forwards" }
  ).finished.then(() => hoop.remove());
  await wait(500);

  // 5. FAIL.
  sfx.buzzer();
  const fail = document.createElement("div");
  fail.className = "dev-fail";
  fail.textContent = "FAIL";
  document.body.appendChild(fail);
  await wait(1300);

  // 6. The whole screen explodes… but only the hula hooper is really gone.
  const flash = document.createElement("div");
  flash.className = "dev-screen-boom";
  document.body.appendChild(flash);
  burstChunks(new DOMRect(0, 0, window.innerWidth, window.innerHeight), 70, 900);
  sfx.boom(3);
  document.querySelector(".menu-shell")?.animate(
    [
      { transform: "translate(0, 0) rotate(0deg)" },
      { transform: "translate(-24px, 14px) rotate(-1deg)" },
      { transform: "translate(22px, -18px) rotate(1deg)" },
      { transform: "translate(-16px, 10px) rotate(-0.5deg)" },
      { transform: "translate(10px, -6px)" },
      { transform: "translate(0, 0)" },
    ],
    { duration: 800 }
  );
  fail.remove();
  explode(target);
  window.setTimeout(() => flash.remove(), 1200);
  letter.classList.remove("is-flying");
}

// The i in "Monitor" turns into a pogo stick, its dot as the rider's head. It
// boings around the screen a few times, then comes down on a random system by
// accident, cracking it UNSTABLE, and bounces home. One go per page load.
function installPogoI(): void {
  const letter = document.getElementById("dev-pogo-i");
  if (!letter) return;

  letter.addEventListener("click", () => {
    if (letter.classList.contains("is-spent")) return;
    letter.classList.add("is-spent", "is-flying");
    void pogo(letter);
  });
}

async function pogo(letter: HTMLElement): Promise<void> {
  const home = letter.getBoundingClientRect();
  const stick = document.createElement("div");
  stick.className = "dev-pogo";
  stick.innerHTML = `
    <span class="dev-pogo-head"></span>
    <span class="dev-pogo-handle"></span>
    <span class="dev-pogo-pole"></span>
    <span class="dev-pogo-pegs"></span>
    <span class="dev-pogo-spring"></span>
  `;
  document.body.appendChild(stick);
  const width = 34;
  const height = 96;

  // Positions are where the bottom of the pogo stick touches down.
  let x = home.left + home.width / 2;
  let y = home.bottom;
  const place = (atX: number, atY: number, squash = 1, lean = 0): string =>
    `translate(${atX - width / 2}px, ${atY - height}px) rotate(${lean}deg) scale(${1 / Math.sqrt(squash)}, ${squash})`;

  const hop = async (toX: number, toY: number, ms: number): Promise<void> => {
    sfx.boing();
    const peak = Math.min(y, toY) - 120 - Math.random() * 80;
    const lean = toX > x ? 10 : -10;
    await stick.animate(
      [
        { transform: place(x, y, 0.7), offset: 0 },
        { transform: place(x, y, 1.1, lean), offset: 0.12, easing: "ease-out" },
        { transform: place((x + toX) / 2, peak, 1, lean), offset: 0.5, easing: "ease-in" },
        { transform: place(toX, toY, 1, lean), offset: 0.9 },
        { transform: place(toX, toY, 0.7), offset: 1 },
      ],
      { duration: ms, fill: "forwards" }
    ).finished;
    x = toX;
    y = toY;
  };

  // Boing around the page a few times…
  const hops = 3 + Math.floor(Math.random() * 3);
  for (let count = 0; count < hops; count += 1) {
    const toX = 40 + Math.random() * (window.innerWidth - 80);
    const toY = window.innerHeight * (0.35 + Math.random() * 0.55);
    await hop(toX, toY, 700);
  }

  // …until it comes down right on top of a system. Oops.
  const target = randomRunningSystem();
  if (target) {
    const box = target.getBoundingClientRect();
    const landX = box.left + box.width * (0.15 + Math.random() * 0.7);
    await hop(landX, box.top + 4, 800);
    crack(target, landX - box.left);
    target.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(6px)" }, { transform: "translateY(0)" }],
      { duration: 250 }
    );
  }

  // Then it bounces home and turns back into an i.
  await hop(home.left + home.width / 2, home.bottom, 900);
  stick.remove();
  letter.classList.remove("is-flying");
}

// The T in "Monitor" is already shaped like a mallet, so it becomes one. It
// flies over a random system, winds up, and smashes it UNSTABLE. One go per
// page load.
function installMalletT(): void {
  const letter = document.getElementById("dev-mallet-t");
  if (!letter) return;

  letter.addEventListener("click", () => {
    if (letter.classList.contains("is-spent")) return;
    const target = randomRunningSystem();
    if (!target) return;
    letter.classList.add("is-spent", "is-flying");
    void smash(letter, target);
  });
}

async function smash(letter: HTMLElement, target: HTMLElement): Promise<void> {
  const width = 64;
  const height = 104;
  const headDepth = 30;
  const home = letter.getBoundingClientRect();
  const box = target.getBoundingClientRect();

  const mallet = document.createElement("div");
  mallet.className = "dev-mallet";
  mallet.innerHTML = `<span class="dev-mallet-head"></span><span class="dev-mallet-handle"></span>`;
  document.body.appendChild(mallet);

  // It swings around the bottom of its handle. Tipped all the way over, the
  // head lands to the left of that point, so put the point just far enough to
  // the right and above the system for the head to meet its top edge.
  const hitX = box.left + box.width * (0.15 + Math.random() * 0.6);
  const pivotX = hitX + height - headDepth / 2;
  const pivotY = box.top - width / 2 + 4;
  const at = (x: number, y: number): string => `translate(${x - width / 2}px, ${y - height}px)`;
  const ready = at(pivotX, pivotY);

  await mallet.animate(
    [
      { transform: `${at(home.left + home.width / 2, home.bottom)} scale(${home.height / height})` },
      { transform: `${ready} scale(1)` },
    ],
    { duration: 800, easing: "ease-in-out", fill: "forwards" }
  ).finished;

  // Wind up…
  sfx.whoosh(0.45);
  await mallet.animate([{ transform: `${ready} rotate(0deg)` }, { transform: `${ready} rotate(35deg)` }], {
    duration: 450,
    easing: "ease-out",
    fill: "forwards",
  }).finished;

  // …SMASH.
  await mallet.animate([{ transform: `${ready} rotate(35deg)` }, { transform: `${ready} rotate(-90deg)` }], {
    duration: 160,
    easing: "ease-in",
    fill: "forwards",
  }).finished;

  sfx.thunk();
  const spark = document.createElement("div");
  spark.className = "dev-laser-spark dev-rocket-boom";
  spark.style.left = `${hitX}px`;
  spark.style.top = `${box.top}px`;
  document.body.appendChild(spark);
  window.setTimeout(() => spark.remove(), 400);
  crack(target, hitX - box.left);
  target.animate(
    [
      { transform: "translateY(0) scaleY(1)" },
      { transform: "translateY(5px) scaleY(0.88)" },
      { transform: "translateY(0) scaleY(1)" },
    ],
    { duration: 300 }
  );
  await wait(350);

  // Lift back up and head home.
  await mallet.animate([{ transform: `${ready} rotate(-90deg)` }, { transform: `${ready} rotate(0deg)` }], {
    duration: 350,
    easing: "ease-out",
    fill: "forwards",
  }).finished;
  await mallet.animate(
    [
      { transform: `${ready} scale(1)` },
      { transform: `${at(home.left + home.width / 2, home.bottom)} scale(${home.height / height})` },
    ],
    { duration: 800, easing: "ease-in-out", fill: "forwards" }
  ).finished;
  mallet.remove();
  letter.classList.remove("is-flying");
}

// Seven letters in "Monitor" and eight systems, so one is always left
// running. That's what "System" is for. Once every Monitor letter has been
// used, clicking it makes the letters wave: S, S and E go up while Y, T and M
// go down, then swap, five times. Three wheels appear, start turning, and
// roll onto whichever system is still running, which turns blue:
// SUPERCHARGED.
const MONITOR_LETTER_IDS = ["dev-m", "dev-hoop-o", "dev-n", "dev-pogo-i", "dev-mallet-t", "dev-laser-o", "dev-rocket-r"];

function installSystemSupercharge(): void {
  const word = document.getElementById("dev-system-word");
  if (!word) return;

  word.addEventListener("click", () => {
    if (word.classList.contains("is-spent")) return;
    // Ready once every Monitor letter is used up and every hit has landed,
    // leaving exactly one system still running.
    const running = monitor
      ? Array.from(monitor.querySelectorAll<HTMLElement>(".dev-system:not(.is-unstable):not(.is-exploded):not(.is-supercharged)"))
      : [];
    const lastOne = running.length === 1 ? running[0] : undefined;
    const ready =
      claimed.size === 0 &&
      MONITOR_LETTER_IDS.every((id) => {
        const letter = document.getElementById(id);
        return letter?.classList.contains("is-spent") && !letter.classList.contains("is-flying");
      });
    if (!ready || !lastOne) {
      // Not yet: there's no last one standing.
      sfx.buzzer();
      word.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
        { duration: 250 }
      );
      return;
    }
    word.classList.add("is-spent");
    void supercharge(word, lastOne);
  });
}

async function supercharge(word: HTMLElement, target: HTMLElement): Promise<void> {
  // 1. The wave: every other letter up, the rest down, then swap, five times.
  const letters = Array.from(word.querySelectorAll<HTMLElement>("span"));
  const waves = letters.map((letter, index) => {
    const way = index % 2 === 0 ? -1 : 1;
    return letter.animate(
      [
        { transform: "translateY(0)" },
        { transform: `translateY(${way * 16}px)` },
        { transform: `translateY(${-way * 16}px)` },
        { transform: "translateY(0)" },
      ],
      { duration: 600, iterations: 5, easing: "ease-in-out" }
    );
  });
  // A blip each time the letters swap.
  for (let swap = 0; swap < 10; swap += 1) window.setTimeout(() => sfx.bleep(swap), swap * 300);
  await Promise.all(waves.map((wave) => wave.finished));

  // 2. Three wheels pop up over the word and start turning.
  const from = word.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const size = 46;
  const wheels = [0, 1, 2].map((index) => {
    const wheel = document.createElement("div");
    wheel.className = "dev-wheel";
    document.body.appendChild(wheel);
    const startX = from.left + from.width / 2 + (index - 1) * (size + 10) - size / 2;
    const startY = from.top - size - 10;
    wheel.animate([{ transform: `translate(${startX}px, ${startY}px) scale(0)` }, { transform: `translate(${startX}px, ${startY}px) scale(1)` }], {
      duration: 350,
      delay: index * 200,
      easing: "cubic-bezier(0.2, 1.6, 0.4, 1)",
      fill: "forwards",
    });
    return { wheel, startX, startY };
  });
  sfx.whir(1.3);
  await wait(1300);

  // 3. They roll down onto the last system standing…
  const rolls = wheels.map(({ wheel, startX, startY }, index) => {
    const endX = box.left + box.width * (0.3 + index * 0.2) - size / 2;
    const endY = box.top - size + 6;
    return wheel.animate(
      [{ transform: `translate(${startX}px, ${startY}px)` }, { transform: `translate(${endX}px, ${endY}px)` }],
      { duration: 1100, delay: index * 120, easing: "ease-in-out", fill: "forwards" }
    ).finished;
  });
  await Promise.all(rolls);
  wheels.forEach(({ wheel }) => wheel.classList.add("is-fast"));
  sfx.whir(0.7);
  await wait(700);

  // 4. …and charge it up.
  sfx.powerUp();
  wheels.forEach(({ wheel }) => {
    wheel.animate([{ opacity: 1 }, { opacity: 0, filter: "brightness(3)" }], { duration: 400, fill: "forwards" }).finished.then(() =>
      wheel.remove()
    );
  });
  target.style.animationDelay = "0s";
  target.querySelector(".dev-crack")?.remove();
  target.classList.add("is-supercharged");
  const status = target.querySelector(".dev-system-status");
  if (status) status.textContent = "SUPERCHARGED";
  // Go there now and it's blue and SUPERCHARGED, and it stays that way.
  rememberSuperchargedHub(target.getAttribute("href") ?? "");
}
