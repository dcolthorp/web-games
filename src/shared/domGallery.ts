export {};

interface Exhibit {
  kind: "image" | "audio" | "video" | "style" | "element";
  label: string;
  source?: string;
}

const host = document.createElement("div");
host.id = "dom-gallery-root";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .door { position: fixed; z-index: 2147483646; top: 0; right: 0; width: 92px; height: 72px; border: 0; opacity: 0; cursor: pointer; background: #05070a; color: #62ffb2; font: 800 11px/1.15 monospace; letter-spacing: .08em; transition: opacity 140ms; }
    .door:hover, .door:focus-visible { opacity: .94; outline: 2px solid #62ffb2; outline-offset: -4px; }
    .glitch { position: fixed; z-index: 2147483647; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(98,255,178,.22) 0 2px, transparent 2px 7px), #05070a; animation: glitch-in 680ms steps(8,end) forwards; }
    .glitch::after { content: "OPENING THE DOM"; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font: 900 clamp(24px,7vw,80px) monospace; text-shadow: 8px 0 #ff3158, -8px 0 #44aaff; }
    @keyframes glitch-in { 0% { clip-path: inset(0 0 90% 0); } 20% { clip-path: inset(65% 0 0 0); transform: translateX(18px); } 45% { clip-path: inset(0); } 80% { opacity: 1; filter: invert(1); } 100% { opacity: 0; } }
    .gallery { position: fixed; z-index: 2147483645; inset: 0; overflow: hidden; color: #dfffee; background: #07100d; font-family: monospace; }
    .gallery[hidden] { display: none; }
    .sky { position: absolute; inset: 0; background: linear-gradient(#061b17 0 64%, #101a16 64%); }
    .grid { position: absolute; inset: 0; opacity: .25; background-image: linear-gradient(#38ef9a 1px,transparent 1px),linear-gradient(90deg,#38ef9a 1px,transparent 1px); background-size: 42px 42px; perspective: 300px; }
    .header { position: fixed; z-index: 3; top: 18px; left: 22px; right: 22px; display: flex; align-items: center; justify-content: space-between; gap: 18px; pointer-events: none; }
    .title { margin: 0; color: #62ffb2; font: 900 clamp(20px,4vw,46px)/1 monospace; text-shadow: 3px 0 #ff3158; }
    .help { margin: 6px 0 0; font: 700 12px monospace; }
    .close { pointer-events: auto; border: 2px solid #62ffb2; padding: 9px 12px; color: #62ffb2; background: #07100d; font: 800 12px monospace; cursor: pointer; }
    .world { position: absolute; left: 0; bottom: 74px; height: 430px; will-change: transform; }
    .floor { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; border-top: 4px solid #62ffb2; background: #17251f; }
    .exhibit { position: absolute; bottom: 44px; width: 230px; height: 280px; padding: 12px; border: 2px solid #3fd894; border-bottom: 12px solid #3fd894; background: rgba(7,16,13,.92); box-shadow: 8px 8px 0 rgba(0,0,0,.45); overflow: hidden; }
    .exhibit:nth-child(3n) { height: 330px; }
    .kind { color: #ff7891; font: 800 10px monospace; letter-spacing: .14em; }
    .label { height: 48px; margin: 6px 0 8px; overflow: hidden; color: #dfffee; font: 800 13px/1.25 monospace; overflow-wrap: anywhere; }
    .preview { display: grid; place-items: center; width: 100%; height: 170px; border: 1px solid #215b45; background: #020705; overflow: hidden; }
    .preview img, .preview video { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
    .preview audio { width: 95%; }
    .node { color: #62ffb2; font: 900 18px/1.35 monospace; text-align: center; overflow-wrap: anywhere; }
    .player { position: fixed; z-index: 4; left: 22%; bottom: 116px; width: 35px; height: 62px; filter: drop-shadow(0 5px 3px #000); transition: transform 50ms linear; }
    .head { position: absolute; left: 9px; top: 0; width: 18px; height: 18px; border: 4px solid #dfffee; border-radius: 50%; }
    .body,.arm,.leg { position: absolute; left: 16px; width: 4px; border-radius: 3px; background: #dfffee; transform-origin: 2px 2px; }
    .body { top: 17px; height: 25px; }.arm { top: 22px; height: 24px; }.arm.a { transform: rotate(55deg); }.arm.b { transform: rotate(-55deg); }.leg { top: 40px; height: 25px; }.leg.a { transform: rotate(28deg); }.leg.b { transform: rotate(-28deg); }
    .player.walking .arm.a,.player.walking .leg.b { animation: limb 240ms infinite alternate; }.player.walking .arm.b,.player.walking .leg.a { animation: limb2 240ms infinite alternate; }
    @keyframes limb { to { transform: rotate(-38deg); } } @keyframes limb2 { to { transform: rotate(38deg); } }
    .counter { position: fixed; left: 22px; bottom: 18px; color: #78b99b; font: 700 12px monospace; }
  </style>
  <button class="door" type="button" aria-label="Enter the DOM">ENTER<br>THE DOM</button>
  <div class="gallery" hidden>
    <div class="sky"></div><div class="grid"></div>
    <header class="header"><div><h2 class="title">THE DOM GALLERY</h2><p class="help">A/D or ←/→ to walk · inspect every asset</p></div><button class="close" type="button">EXIT DOM</button></header>
    <div class="world"><div class="floor"></div></div>
    <div class="player" aria-label="Your stickman"><i class="head"></i><i class="body"></i><i class="arm a"></i><i class="arm b"></i><i class="leg a"></i><i class="leg b"></i></div>
    <div class="counter"></div>
  </div>
`;
document.body.appendChild(host);

const door = shadow.querySelector<HTMLButtonElement>(".door");
const gallery = shadow.querySelector<HTMLElement>(".gallery");
const world = shadow.querySelector<HTMLElement>(".world");
const player = shadow.querySelector<HTMLElement>(".player");
const counter = shadow.querySelector<HTMLElement>(".counter");
const closeButton = shadow.querySelector<HTMLButtonElement>(".close");
const keys = new Set<string>();
let open = false;
let playerX = 180;
let cameraX = 0;
let worldWidth = 0;
let previousFrame = 0;
let animationFrame = 0;

function shortLabel(source: string): string {
  try {
    const url = new URL(source, location.href);
    return decodeURIComponent(url.pathname.split("/").pop() || url.hostname);
  } catch { return source; }
}

function collectAssets(): Exhibit[] {
  const exhibits: Exhibit[] = [];
  const seen = new Set<string>();
  const add = (exhibit: Exhibit): void => {
    const key = `${exhibit.kind}:${exhibit.source ?? exhibit.label}`;
    if (!seen.has(key)) { seen.add(key); exhibits.push(exhibit); }
  };
  document.querySelectorAll<HTMLImageElement>("img").forEach((node) => add({ kind: "image", label: node.alt || shortLabel(node.currentSrc || node.src), source: node.currentSrc || node.src }));
  document.querySelectorAll<HTMLAudioElement>("audio").forEach((node) => node.src && add({ kind: "audio", label: shortLabel(node.src), source: node.src }));
  document.querySelectorAll<HTMLVideoElement>("video").forEach((node) => node.src && add({ kind: "video", label: shortLabel(node.src), source: node.src }));
  document.querySelectorAll<HTMLSourceElement>("source").forEach((node) => {
    if (!node.src) return;
    const kind = node.type.startsWith("audio") ? "audio" : node.type.startsWith("video") ? "video" : "image";
    add({ kind, label: shortLabel(node.src), source: node.src });
  });
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((node) => add({ kind: "style", label: shortLabel(node.href), source: node.href }));
  for (const node of document.querySelectorAll<HTMLElement>("body *")) {
    if (node === host) continue;
    const background = getComputedStyle(node).backgroundImage;
    for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const source = new URL(match[1]!, location.href).href;
      add({ kind: "image", label: shortLabel(source), source });
    }
  }
  document.querySelectorAll<HTMLElement>("main, section, canvas, button, h1, h2").forEach((node) => {
    const id = node.id ? `#${node.id}` : "";
    const className = typeof node.className === "string" && node.className ? `.${node.className.trim().split(/\s+/).join(".")}` : "";
    add({ kind: "element", label: `<${node.tagName.toLowerCase()}${id}${className}>` });
  });
  return exhibits;
}

function preview(exhibit: Exhibit): string {
  if (exhibit.kind === "image") return `<img src="${exhibit.source}" alt="">`;
  if (exhibit.kind === "audio") return `<audio controls src="${exhibit.source}"></audio>`;
  if (exhibit.kind === "video") return `<video controls muted src="${exhibit.source}"></video>`;
  return `<span class="node">${exhibit.kind === "style" ? "{ CSS }" : exhibit.label.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</span>`;
}

function buildGallery(): void {
  if (!world || !counter) return;
  const exhibits = collectAssets();
  world.querySelectorAll(".exhibit").forEach((node) => node.remove());
  exhibits.forEach((exhibit, index) => {
    const card = document.createElement("article");
    card.className = "exhibit";
    card.style.left = `${120 + index * 280}px`;
    card.innerHTML = `<div class="kind">${exhibit.kind.toUpperCase()}</div><div class="label">${exhibit.label}</div><div class="preview">${preview(exhibit)}</div>`;
    world.appendChild(card);
  });
  worldWidth = Math.max(innerWidth, 280 + exhibits.length * 280);
  world.style.width = `${worldWidth}px`;
  counter.textContent = `${exhibits.length} EXHIBITS · ${location.pathname}`;
}

function enter(): void {
  if (!gallery || open) return;
  open = true;
  const glitch = document.createElement("div");
  glitch.className = "glitch";
  shadow.appendChild(glitch);
  window.setTimeout(() => glitch.remove(), 720);
  buildGallery();
  gallery.hidden = false;
  door?.setAttribute("hidden", "");
  previousFrame = performance.now();
  animationFrame = requestAnimationFrame(tick);
}

function exitGallery(): void {
  open = false;
  cancelAnimationFrame(animationFrame);
  if (gallery) gallery.hidden = true;
  door?.removeAttribute("hidden");
  keys.clear();
}

function tick(timestamp: number): void {
  if (!open || !world || !player) return;
  const delta = Math.min(.04, (timestamp - previousFrame) / 1000 || 0);
  previousFrame = timestamp;
  const direction = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
  playerX = Math.max(20, Math.min(worldWidth - 50, playerX + direction * 330 * delta));
  cameraX += (Math.max(0, Math.min(worldWidth - innerWidth, playerX - innerWidth * .22)) - cameraX) * Math.min(1, delta * 8);
  world.style.transform = `translateX(${-cameraX}px)`;
  player.classList.toggle("walking", direction !== 0);
  player.style.transform = `scaleX(${direction < 0 ? -1 : 1})`;
  animationFrame = requestAnimationFrame(tick);
}

door?.addEventListener("click", enter);
closeButton?.addEventListener("click", exitGallery);
window.addEventListener("keydown", (event) => {
  if (!open) return;
  const key = event.key.toLowerCase();
  if (["a", "d", "arrowleft", "arrowright", "escape"].includes(key)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
  if (key === "escape") exitGallery(); else keys.add(key);
}, true);
window.addEventListener("keyup", (event) => {
  if (open) { keys.delete(event.key.toLowerCase()); event.stopImmediatePropagation(); }
}, true);
