import bluePaperUrl from "../games3/assets/crumpled-school-paper-blue.png";
import * as sfx from "./sfx";
import {
  isThisGameSupercharged,
  isThisHubSupercharged,
  justArrivedThroughParadox,
  rememberSuperchargedGames,
  spreadSuperchargeTo,
} from "./superchargedHub";

// The hub dev.1 supercharged: always blue, SUPERCHARGED written in front of its
// title with a lightning bolt through it, and a pile of little things to do.
//   click anywhere          sparks fly
//   move the mouse          blue spark trail
//   hover a game            it crackles
//   every click             fills the ENERGY meter; full means OVERCHARGE
//   wait a bit              lightning flickers in the background
//   press Z                 lightning strikes a random game
//   double-click            drop a spinning gear
//   click SUPERCHARGED      thunder
//   hold the mouse down     charge a ball, let go for a shockwave
//   type "boom"             blue fireworks
// Every game on that hub is turned all blue and gets the sparks, the spark
// trail and a blue glow around the edges. Some games also play a little
// differently when supercharged; they check isThisGameSupercharged() themselves.

const STYLE = `
  /* Each hub sets its own colours on body, so blue has to win there. */
  html.is-supercharged body {
    --bg: #020a1c !important;
    --bg-accent: #06204a !important;
    --panel: #071631 !important;
    --panel-2: #0b2148 !important;
    --ink: #e3f1ff !important;
    --muted: #8fb8e8 !important;
    --danger: #46a8ff !important;
    --danger-dark: #0d3d7a !important;
    --warn: #7fd0ff !important;
  }
  html.is-supercharged [class*="game-card"]:not(.paper-game-card) {
    background:
      radial-gradient(circle at 90% 15%, rgba(127, 208, 255, 0.18), transparent 25%),
      linear-gradient(180deg, #0f3a78, #071a3a) !important;
    border-color: #46a8ff !important;
  }
  /* Card text in blues too. Some hubs (Penelope's) colour it by hand,
     which would leave dark purple words on a dark blue card. */
  html.is-supercharged [class*="game-card"]:not(.paper-game-card),
  html.is-supercharged [class*="game-card"]:not(.paper-game-card) .game-title {
    color: #e3f1ff !important;
  }
  html.is-supercharged [class*="game-card"]:not(.paper-game-card) .game-blurb {
    color: #b9d6f5 !important;
  }
  html.is-supercharged [class*="game-card"]:not(.paper-game-card) .game-arrow {
    color: #7fd0ff !important;
  }
  html.is-supercharged [class*="game-card"]:not(.paper-game-card) .game-tag {
    background: #46a8ff !important;
    color: #04122a !important;
  }
  /* The tabs to other hubs (like Penelope's pink one) go blue too. */
  html.is-supercharged .owner-switch,
  html.is-supercharged .hub-toggle {
    background: linear-gradient(180deg, #a8dcff, #46a8ff) !important;
  }
  /* Games 3's crumpled-paper card swaps to a blue copy of the same paper.
     Only the red margin line stays red. */
  html.is-supercharged .paper-game-card {
    background-image: url("${bluePaperUrl}") !important;
  }
  html.is-supercharged [class*="stripes"],
  html.is-supercharged .trap-floor {
    background: repeating-linear-gradient(-45deg, #7fd0ff 0 22px, #071a3a 22px 44px) !important;
  }
  html.is-supercharged body {
    background:
      radial-gradient(circle at top, rgba(70, 168, 255, 0.22), transparent 30%),
      linear-gradient(180deg, #06204a, #020a1c) !important;
    color: var(--ink);
  }
  html.is-supercharged .hero-panel,
  html.is-supercharged .menu-container {
    background: linear-gradient(135deg, #0b2a5c, #050f24 65%) !important;
    border-color: #46a8ff !important;
  }
  html.is-supercharged h1 {
    color: #e3f1ff !important;
    text-shadow: 0 4px 0 #000, 0 8px 0 #0d3d7a, 0 0 26px rgba(70, 168, 255, 0.8) !important;
  }
  html.is-supercharged a:hover,
  html.is-supercharged .game-card:hover {
    animation: sc-crackle 0.18s steps(2, end) infinite;
  }
  @keyframes sc-crackle {
    from { box-shadow: 0 0 6px #46a8ff, 0 0 0 2px #46a8ff; }
    to { box-shadow: 0 0 18px #7fd0ff, 0 0 0 2px #e3f1ff; }
  }

  .sc-word {
    position: relative;
    isolation: isolate;
    display: inline-block;
    align-self: center;
    padding: 4px 12px;
    border: 3px solid #46a8ff;
    background: #04122a;
    color: #7fd0ff;
    font: 900 clamp(1.1rem, 3.4vw, 2rem)/1 Impact, Haettenschweiler, sans-serif;
    letter-spacing: 0.08em;
    text-shadow: 0 0 10px #46a8ff;
    cursor: pointer;
    user-select: none;
  }
  /* The bolt crosses behind the letters, so SUPERCHARGED stays readable. */
  .sc-word-text {
    position: relative;
    z-index: 1;
    text-shadow: 0 0 10px #46a8ff, 0 2px 0 #04122a, 0 -2px 0 #04122a, 2px 0 0 #04122a, -2px 0 0 #04122a;
  }
  .sc-word svg {
    z-index: 0;
    opacity: 0.85;
    position: absolute;
    left: 50%;
    top: 50%;
    width: 52px;
    height: 150%;
    transform: translate(-50%, -50%) rotate(18deg);
    overflow: visible;
    pointer-events: none;
    filter: drop-shadow(0 0 6px #ffe14d);
  }
  .sc-word.is-thundering svg {
    animation: sc-bolt-strike 0.5s steps(4, end);
  }
  @keyframes sc-bolt-strike {
    0% { transform: translate(-50%, -160%) rotate(18deg); }
    40% { transform: translate(-50%, -50%) rotate(18deg) scale(1.4); }
    100% { transform: translate(-50%, -50%) rotate(18deg); }
  }

  /* Every colour in the game turns a shade of blue: drained to grey, warmed to
     sepia, then turned round to blue. On the whole page at once, so it covers
     canvas drawings too, and costs one filter instead of one per canvas. */
  html.is-supercharged-game {
    filter: grayscale(1) sepia(1) hue-rotate(175deg) saturate(2.6);
  }
  /* A box-shadow, not a filter, so busy game canvases don't slow down. */
  html.is-supercharged-game canvas {
    box-shadow: 0 0 22px #46a8ff, 0 0 0 2px #7fd0ff;
  }
  .sc-glow {
    inset: 0;
    box-shadow: inset 0 0 40px rgba(70, 168, 255, 0.65), inset 0 0 8px #7fd0ff;
    animation: sc-glow-pulse 1.6s ease-in-out infinite alternate;
  }
  @keyframes sc-glow-pulse {
    from { opacity: 0.6; }
    to { opacity: 1; }
  }
  .sc-badge { left: 10px; bottom: 10px; padding: 4px 8px; border: 2px solid #46a8ff; background: rgba(2, 10, 28, 0.8); color: #7fd0ff; font: 800 11px/1 "Trebuchet MS", sans-serif; letter-spacing: 0.12em; text-shadow: 0 0 6px #46a8ff; }
  .sc-fx { position: fixed; pointer-events: none; z-index: 2147483500; }
  .sc-spark { width: 3px; height: 14px; margin: -7px 0 0 -1.5px; background: #e3f1ff; box-shadow: 0 0 8px #46a8ff; border-radius: 2px; }
  .sc-trail { width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #7fd0ff; box-shadow: 0 0 8px #46a8ff; }
  .sc-flash { inset: 0; background: rgba(170, 215, 255, 0.55); }
  .sc-bg-bolt { top: 0; width: 60px; height: 70vh; opacity: 0.35; }
  .sc-gear { width: 36px; height: 36px; margin: -18px 0 0 -18px; border: 4px dashed #46a8ff; border-radius: 50%; background: radial-gradient(circle, #e3f1ff 0 18%, transparent 19%), repeating-conic-gradient(#46a8ff 0 12deg, transparent 12deg 60deg); animation: sc-spin 1.2s linear infinite; }
  @keyframes sc-spin { to { transform: rotate(360deg); } }
  .sc-ball { border-radius: 50%; background: radial-gradient(circle, #ffffff, #7fd0ff 40%, rgba(70, 168, 255, 0) 70%); }
  .sc-ring { border: 4px solid #7fd0ff; border-radius: 50%; box-shadow: 0 0 20px #46a8ff; }
  .sc-text small { display: block; font-size: 0.32em; letter-spacing: 0.08em; }
  .sc-text { left: 50%; top: 40%; transform: translate(-50%, -50%); color: #e3f1ff; font: 900 clamp(2.5rem, 10vw, 6rem) Impact, Haettenschweiler, sans-serif; text-shadow: 0 0 30px #46a8ff, 0 6px 0 #000; white-space: nowrap; }
  .sc-meter { left: 14px; bottom: 14px; width: 150px; padding: 6px 8px; border: 2px solid #46a8ff; background: rgba(2, 10, 28, 0.85); color: #7fd0ff; font: 800 11px/1 "Trebuchet MS", sans-serif; letter-spacing: 0.12em; pointer-events: auto; }
  .sc-meter-bar { height: 8px; margin-top: 5px; background: #0b2148; }
  .sc-meter-fill { height: 100%; width: 0; background: linear-gradient(90deg, #46a8ff, #e3f1ff); box-shadow: 0 0 8px #46a8ff; transition: width 0.15s; }
`;

const BOLT_POINTS = "30,0 8,58 26,58 14,110 46,40 28,40 40,0";

// dev.1's own page plays its own supercharged scene instead.
if (isThisHubSupercharged() && !document.body.classList.contains("dev-hub")) supercharge();
else if (isThisGameSupercharged()) superchargeGame();

function supercharge(): void {
  document.documentElement.classList.add("is-supercharged");
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  rememberHubGames();
  installParadox();
  addTitleWord();
  installClickSparks();
  installTrail();
  installEnergyMeter();
  installBackgroundLightning();
  installZapKey();
  installGears();
  installChargeBall();
  installBoom();
}

// Inside a game: no theme changes and no extra keys, so nothing gets in the
// way of playing. Just a blue glow round the edges, around the game's canvas,
// and the sparks and trail.
function superchargeGame(): void {
  document.documentElement.classList.add("is-supercharged-game");
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);
  fx("sc-glow");
  const badge = fx("sc-badge");
  badge.textContent = "⚡ SUPERCHARGED";
  window.addEventListener("pointerdown", (event) => sparkBurst(event.clientX, event.clientY, 8));
  installTrail();
}

// The Supercharged Paradox: the buttons that take you to another hub carry
// the charge with you, so wherever you go from here is supercharged too.
// Except Mods & DLCs, which never gets supercharged.
const HUB_LINKS = "a.owner-switch, a.hub-dropdown-link, a.hub-toggle, a.back-link";

function installParadox(): void {
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(HUB_LINKS) : null;
      if (!link || /\/mods\//.test(link.pathname)) return;
      spreadSuperchargeTo(link.href);
    },
    true
  );
  if (!justArrivedThroughParadox()) return;
  window.setTimeout(() => {
    sfx.powerUp();
    flash(600);
    const text = fx("sc-text");
    text.innerHTML = "⚡ THE SUPERCHARGED PARADOX ⚡<br><small>The charge followed you here.</small>";
    // Smaller than OVERCHARGE!, and allowed to wrap, so the long name fits.
    text.style.textAlign = "center";
    text.style.whiteSpace = "normal";
    text.style.width = "min(90vw, 900px)";
    text.style.fontSize = "clamp(1.8rem, 6vw, 3.6rem)";
    text.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.15 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.85 },
        { transform: "translate(-50%, -50%) scale(1.1)", opacity: 0 },
      ],
      { duration: 2600, fill: "forwards" }
    ).finished.then(() => text.remove());
  }, 300);
}

// Hub pages draw their game cards in their own script, which runs first, so
// most game links are already on the page. Some turn up later (BIG games'
// secret door only appears once the waterfalls start), so keep watching and
// add those too. Links to other hubs don't count.
function rememberHubGames(): void {
  const record = (): void => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("main a[href]")).filter(
      (link) => !link.matches(".owner-switch, .hub-toggle, .hub-dropdown-link")
    );
    rememberSuperchargedGames(links.map((link) => link.href));
  };
  record();
  const main = document.querySelector("main");
  if (!main) return;
  let pending = 0;
  new MutationObserver(() => {
    window.clearTimeout(pending);
    pending = window.setTimeout(record, 200);
  }).observe(main, { childList: true, subtree: true });
}

function fx(className: string, x?: number, y?: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `sc-fx ${className}`;
  if (x !== undefined) element.style.left = `${x}px`;
  if (y !== undefined) element.style.top = `${y}px`;
  document.body.appendChild(element);
  return element;
}

function boltSvg(colour: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 54 110");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const bolt = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  bolt.setAttribute("points", BOLT_POINTS);
  bolt.setAttribute("fill", colour);
  bolt.setAttribute("stroke", "#000");
  bolt.setAttribute("stroke-width", "2");
  svg.appendChild(bolt);
  return svg;
}

function shake(strength: number): void {
  const target = document.querySelector("main") ?? document.body;
  target.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${-strength}px, ${strength / 2}px)` },
      { transform: `translate(${strength}px, ${-strength / 2}px)` },
      { transform: "translate(0, 0)" },
    ],
    { duration: 300 }
  );
}

function flash(ms: number): void {
  const overlay = fx("sc-flash");
  overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" }).finished.then(() => overlay.remove());
}

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

// SUPERCHARGED goes in front of the title, with a bolt straight through it.
// It sits beside the h1 rather than inside it, so title tricks that rewrite
// the h1's text can't wipe it out.
function addTitleWord(): void {
  const title = document.querySelector("h1");
  if (!title) return;
  const word = document.createElement("span");
  word.className = "sc-word";
  const text = document.createElement("span");
  text.className = "sc-word-text";
  text.textContent = "SUPERCHARGED";
  word.appendChild(text);
  word.title = "Click me";
  word.appendChild(boltSvg("#ffe14d"));
  title.insertAdjacentElement("beforebegin", word);

  word.addEventListener("click", (event) => {
    event.stopPropagation();
    word.classList.remove("is-thundering");
    void word.offsetWidth;
    word.classList.add("is-thundering");
    flash(500);
    window.setTimeout(() => flash(300), 180);
    sfx.thunder();
    shake(10);
  });
}

function sparkBurst(x: number, y: number, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const spark = fx("sc-spark", x, y);
    const angle = (index / count) * 360 + Math.random() * 20;
    const distance = 30 + Math.random() * 40;
    spark
      .animate(
        [
          { transform: `rotate(${angle}deg) translateY(0)`, opacity: 1 },
          { transform: `rotate(${angle}deg) translateY(${-distance}px)`, opacity: 0 },
        ],
        { duration: 380, easing: "ease-out", fill: "forwards" }
      )
      .finished.then(() => spark.remove());
  }
}

function installClickSparks(): void {
  window.addEventListener("click", (event) => {
    sparkBurst(event.clientX, event.clientY, 8);
    sfx.zap(0.06);
  });
}

function installTrail(): void {
  let last = 0;
  window.addEventListener("pointermove", (event) => {
    const now = performance.now();
    if (now - last < 30) return;
    last = now;
    const dot = fx("sc-trail", event.clientX, event.clientY);
    dot.animate([{ opacity: 0.9, transform: "scale(1)" }, { opacity: 0, transform: "scale(0.2)" }], {
      duration: 450,
      fill: "forwards",
    }).finished.then(() => dot.remove());
  });
}

function installEnergyMeter(): void {
  const meter = fx("sc-meter");
  meter.title = "Click to charge. Try Z, double-click, holding the mouse down, and typing boom.";
  meter.innerHTML = `⚡ ENERGY<div class="sc-meter-bar"><div class="sc-meter-fill"></div></div>`;
  const fill = meter.querySelector<HTMLElement>(".sc-meter-fill");
  let energy = 0;

  window.addEventListener("click", () => {
    energy = Math.min(energy + 8, 100);
    if (fill) fill.style.width = `${energy}%`;
    if (energy < 100) return;
    energy = 0;
    window.setTimeout(() => {
      if (fill) fill.style.width = "0%";
    }, 600);
    overcharge();
  });
}

function overcharge(): void {
  sfx.powerUp();
  sfx.boom(2);
  flash(900);
  shake(16);
  const text = fx("sc-text");
  text.textContent = "OVERCHARGE!";
  text.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.1)", opacity: 1, offset: 0.2 },
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.8 },
      { transform: "translate(-50%, -50%) scale(1.2)", opacity: 0 },
    ],
    { duration: 1500, fill: "forwards" }
  ).finished.then(() => text.remove());
  for (let burst = 0; burst < 6; burst += 1) {
    window.setTimeout(
      () => sparkBurst(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 12),
      burst * 120
    );
  }
}

function installBackgroundLightning(): void {
  const strike = (): void => {
    const bolt = fx("sc-bg-bolt");
    bolt.style.left = `${Math.random() * (window.innerWidth - 60)}px`;
    bolt.appendChild(boltSvg("#7fd0ff"));
    bolt.querySelector("svg")?.setAttribute("style", "width:100%;height:100%");
    // Far away, so only a soft rumble.
    sfx.zap(0.03);
    bolt.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0.05 }, { opacity: 0.35 }, { opacity: 0 }], {
      duration: 600,
      fill: "forwards",
    }).finished.then(() => bolt.remove());
    window.setTimeout(strike, 6000 + Math.random() * 6000);
  };
  window.setTimeout(strike, 3000);
}

// Lightning drops out of the sky onto a random game card or link.
function installZapKey(): void {
  window.addEventListener("keydown", (event) => {
    if (typing(event) || event.key.toLowerCase() !== "z") return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".game-card, main a"));
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!target) return;
    const box = target.getBoundingClientRect();
    const bolt = fx("sc-bg-bolt");
    bolt.style.left = `${box.left + box.width / 2 - 30}px`;
    bolt.style.height = `${Math.max(box.top + box.height / 2, 40)}px`;
    bolt.appendChild(boltSvg("#e3f1ff"));
    bolt.querySelector("svg")?.setAttribute("style", "width:100%;height:100%");
    bolt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).finished.then(() => bolt.remove());
    sparkBurst(box.left + box.width / 2, box.top + box.height / 2, 14);
    sfx.zap(0.2);
    sfx.thunder();
    target.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-14px) rotate(-2deg)" }, { transform: "translateY(0)" }],
      { duration: 350, easing: "ease-out" }
    );
  });
}

function installGears(): void {
  const gears: HTMLElement[] = [];
  window.addEventListener("dblclick", (event) => {
    const gear = fx("sc-gear", event.clientX, event.clientY);
    gear.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: 250, easing: "cubic-bezier(0.2, 1.6, 0.4, 1)" });
    gears.push(gear);
    sfx.whir(0.3);
    // Only a dozen at a time; the oldest one pops.
    if (gears.length > 12) gears.shift()?.remove();
  });
}

// Hold the mouse down to charge a ball of energy; let go to fire a shockwave.
function installChargeBall(): void {
  let ball: HTMLDivElement | null = null;
  let started = 0;
  let x = 0;
  let y = 0;
  let frame = 0;

  const grow = (): void => {
    if (!ball) return;
    const size = Math.min(20 + (performance.now() - started) / 12, 160);
    ball.style.width = `${size}px`;
    ball.style.height = `${size}px`;
    ball.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
    frame = requestAnimationFrame(grow);
  };

  window.addEventListener("pointerdown", (event) => {
    x = event.clientX;
    y = event.clientY;
    started = performance.now();
    // Quick clicks shouldn't show a ball, so it only appears once held.
    window.setTimeout(() => {
      if (started === 0 || ball) return;
      ball = fx("sc-ball", x, y);
      grow();
    }, 250);
  });

  window.addEventListener("pointerup", () => {
    started = 0;
    if (!ball) return;
    cancelAnimationFrame(frame);
    const size = ball.offsetWidth;
    ball.remove();
    ball = null;
    const ring = fx("sc-ring", x, y);
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
    ring.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
    ring.animate([{ transform: "scale(1)", opacity: 1 }, { transform: `scale(${4 + size / 40})`, opacity: 0 }], {
      duration: 600,
      easing: "ease-out",
      fill: "forwards",
    }).finished.then(() => ring.remove());
    sfx.boom(size > 100 ? 2 : 1);
    if (size > 100) shake(8);
  });
}

function installBoom(): void {
  const word = "boom";
  let typed = "";
  window.addEventListener("keydown", (event) => {
    if (typing(event) || event.key.length !== 1) return;
    typed = (typed + event.key.toLowerCase()).slice(-word.length);
    if (typed !== word) return;
    typed = "";
    for (let firework = 0; firework < 8; firework += 1) {
      window.setTimeout(() => sfx.boom(0.4), firework * 160);
      window.setTimeout(
        () =>
          sparkBurst(
            window.innerWidth * (0.15 + Math.random() * 0.7),
            window.innerHeight * (0.15 + Math.random() * 0.5),
            16
          ),
        firework * 160
      );
    }
  });
}
