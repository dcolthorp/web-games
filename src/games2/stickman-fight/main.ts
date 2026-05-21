// Stickman Fight — ragdoll-physics brawler with a weapon shop.

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = HEIGHT * 0.65;
const GRAVITY = 0.55;
const AIR_DAMP = 0.992;
const GROUND_FRIC = 0.86;

type WeaponId = "fist" | "stick" | "bat" | "sword" | "hammer" | "spear" | "lightsaber";

interface WeaponDef {
  id: WeaponId;
  name: string;
  price: number;
  length: number;
  width: number;
  color: string;
  damage: number;
  tipBonus: number; // extra damage on tip
}

const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist:       { id: "fist",       name: "Bare Fists",    price: 0,    length: 10, width: 8,  color: "#e8c79a", damage: 0.6, tipBonus: 0   },
  stick:      { id: "stick",      name: "Stick",         price: 15,   length: 55, width: 5,  color: "#7a4a1a", damage: 0.9, tipBonus: 0.2 },
  bat:        { id: "bat",        name: "Baseball Bat",  price: 50,   length: 70, width: 8,  color: "#c98a3c", damage: 1.3, tipBonus: 0.3 },
  sword:      { id: "sword",      name: "Sword",         price: 120,  length: 85, width: 4,  color: "#d8d8e6", damage: 1.6, tipBonus: 0.6 },
  spear:      { id: "spear",      name: "Spear",         price: 220,  length: 120,width: 3,  color: "#bdbdbd", damage: 1.4, tipBonus: 1.2 },
  hammer:     { id: "hammer",     name: "War Hammer",    price: 350,  length: 70, width: 14, color: "#5a5a66", damage: 2.4, tipBonus: 0.4 },
  lightsaber: { id: "lightsaber", name: "Lightsaber",    price: 900,  length: 95, width: 7,  color: "#5cffff", damage: 3.2, tipBonus: 1.0 },
};

const WEAPON_ORDER: WeaponId[] = ["fist", "stick", "bat", "sword", "spear", "hammer", "lightsaber"];

// ─────────────────────────────────────────────────────────────────────────────
// Verlet particles & sticks
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  radius: number;
  pinned: boolean;
}

interface Stick {
  a: Particle;
  b: Particle;
  length: number;
  stiffness: number;
}

function makeParticle(x: number, y: number, radius = 4): Particle {
  return { x, y, px: x, py: y, radius, pinned: false };
}

function makeStick(a: Particle, b: Particle, stiffness = 1, length?: number): Stick {
  const dx = a.x - b.x, dy = a.y - b.y;
  return { a, b, length: length ?? Math.hypot(dx, dy), stiffness };
}

function updateParticle(p: Particle): void {
  if (p.pinned) return;
  const vx = (p.x - p.px) * AIR_DAMP;
  const vy = (p.y - p.py) * AIR_DAMP;
  p.px = p.x;
  p.py = p.y;
  p.x += vx;
  p.y += vy + GRAVITY;
}

function constrainStick(s: Stick): void {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const diff = (s.length - dist) / dist;
  const offX = dx * 0.5 * diff * s.stiffness;
  const offY = dy * 0.5 * diff * s.stiffness;
  if (!s.a.pinned) { s.a.x -= offX; s.a.y -= offY; }
  if (!s.b.pinned) { s.b.x += offX; s.b.y += offY; }
}

function constrainGround(p: Particle): void {
  if (p.pinned) return;
  if (p.y + p.radius > GROUND_Y) {
    p.y = GROUND_Y - p.radius;
    p.px = p.x - (p.x - p.px) * GROUND_FRIC;
    p.py = p.y + 1; // a little bounce
  }
  if (p.x < p.radius) { p.x = p.radius; p.px = p.x + (p.x - p.px) * 0.5; }
  if (p.x > WIDTH - p.radius) { p.x = WIDTH - p.radius; p.px = p.x + (p.x - p.px) * 0.5; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stickman
// ─────────────────────────────────────────────────────────────────────────────

interface Stickman {
  head: Particle;
  neck: Particle;
  hip: Particle;
  handL: Particle;
  handR: Particle;
  footL: Particle;
  footR: Particle;
  parts: Particle[];
  sticks: Stick[];
  hp: number;
  maxHp: number;
  weapon: WeaponId;
  facing: 1 | -1;
  ai: boolean;
  dead: boolean;
  color: string;
  // per-frame hit cooldown so damage doesn't stack every frame
  hitCooldown: number;
  // grace period when round begins
  grace: number;
  // AI
  swingPhase: number;
  // postural target (for upright assist)
  uprightStrength: number;
}

function makeStickman(x: number, y: number, opts: { ai: boolean; weapon: WeaponId; color: string; hp: number }): Stickman {
  const head  = makeParticle(x, y - 60, 12);
  const neck  = makeParticle(x, y - 40, 4);
  const hip   = makeParticle(x, y, 5);
  const handL = makeParticle(x - 18, y - 25, 5);
  const handR = makeParticle(x + 18, y - 25, 5);
  const footL = makeParticle(x - 12, y + 30, 5);
  const footR = makeParticle(x + 12, y + 30, 5);

  const parts = [head, neck, hip, handL, handR, footL, footR];
  const sticks: Stick[] = [
    makeStick(head, neck, 1, 18),
    makeStick(neck, hip, 1, 38),
    makeStick(neck, handL, 0.6, 32),
    makeStick(neck, handR, 0.6, 32),
    makeStick(hip, footL, 0.7, 40),
    makeStick(hip, footR, 0.7, 40),
    // bracing
    makeStick(head, hip, 0.05, 56),
    makeStick(handL, handR, 0.02, 50),
    makeStick(footL, footR, 0.05, 26),
  ];

  return {
    head, neck, hip, handL, handR, footL, footR,
    parts, sticks,
    hp: opts.hp,
    maxHp: opts.hp,
    weapon: opts.weapon,
    facing: 1,
    ai: opts.ai,
    dead: false,
    color: opts.color,
    hitCooldown: 0,
    grace: 90, // ~1.5 seconds of invulnerability at spawn
    swingPhase: Math.random() * Math.PI * 2,
    uprightStrength: 1,
  };
}

// Postural assist: keep stickman upright while alive.
// Without this the ragdoll just collapses immediately.
function applyPosture(s: Stickman): void {
  if (s.dead) return;
  const k = s.uprightStrength;

  // Hip wants to stay near a standing height above the ground
  const desiredHipY = GROUND_Y - 35;
  s.hip.y += (desiredHipY - s.hip.y) * 0.12 * k;

  // Head wants to be above the hip
  const desiredHeadY = s.hip.y - 60;
  const desiredHeadX = s.hip.x;
  s.head.y += (desiredHeadY - s.head.y) * 0.10 * k;
  s.head.x += (desiredHeadX - s.head.x) * 0.04 * k;

  // Neck between hip and head
  const desiredNeckX = (s.head.x + s.hip.x) * 0.5;
  const desiredNeckY = (s.head.y + s.hip.y) * 0.5;
  s.neck.x += (desiredNeckX - s.neck.x) * 0.22 * k;
  s.neck.y += (desiredNeckY - s.neck.y) * 0.22 * k;

  // Feet stay roughly under the hip, on the ground
  const footTargetY = GROUND_Y - 4;
  s.footL.y += (footTargetY - s.footL.y) * 0.15 * k;
  s.footR.y += (footTargetY - s.footR.y) * 0.15 * k;
  const footLTargetX = s.hip.x - 12;
  const footRTargetX = s.hip.x + 12;
  s.footL.x += (footLTargetX - s.footL.x) * 0.08 * k;
  s.footR.x += (footRTargetX - s.footR.x) * 0.08 * k;

  // Off-hand wants to rest by the neck
  const offHandTargetX = s.neck.x - 18 * s.facing;
  const offHandTargetY = s.neck.y + 6;
  s.handL.x += (offHandTargetX - s.handL.x) * 0.06 * k;
  s.handL.y += (offHandTargetY - s.handL.y) * 0.06 * k;
}

// Weapon hand tip position (extending from the active hand)
function weaponTip(s: Stickman): { x: number; y: number; px: number; py: number; dir: { x: number; y: number } } {
  const hand = s.handR;
  // Direction: hand swing velocity if moving, else from neck->hand
  const vx = hand.x - hand.px;
  const vy = hand.y - hand.py;
  let dx: number, dy: number;
  if (Math.hypot(vx, vy) > 0.5) {
    dx = vx; dy = vy;
  } else {
    dx = hand.x - s.neck.x;
    dy = hand.y - s.neck.y;
  }
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const wl = WEAPONS[s.weapon].length;
  return {
    x: hand.x + ux * wl,
    y: hand.y + uy * wl,
    px: hand.px + ux * wl,
    py: hand.py + uy * wl,
    dir: { x: ux, y: uy },
  };
}

function drawStickman(s: Stickman): void {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  // limbs
  const lines: [Particle, Particle][] = [
    [s.head, s.neck], [s.neck, s.hip],
    [s.neck, s.handL], [s.neck, s.handR],
    [s.hip, s.footL], [s.hip, s.footR],
  ];
  ctx.beginPath();
  for (const [a, b] of lines) {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(s.head.x, s.head.y, s.head.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.stroke();
  // eyes
  if (!s.dead) {
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(s.head.x - 3, s.head.y - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(s.head.x + 3, s.head.y - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.head.x - 5, s.head.y - 3); ctx.lineTo(s.head.x - 1, s.head.y + 1);
    ctx.moveTo(s.head.x - 1, s.head.y - 3); ctx.lineTo(s.head.x - 5, s.head.y + 1);
    ctx.moveTo(s.head.x + 1, s.head.y - 3); ctx.lineTo(s.head.x + 5, s.head.y + 1);
    ctx.moveTo(s.head.x + 5, s.head.y - 3); ctx.lineTo(s.head.x + 1, s.head.y + 1);
    ctx.stroke();
  }

  // weapon
  const w = WEAPONS[s.weapon];
  const tip = weaponTip(s);
  if (s.weapon !== "fist") {
    ctx.strokeStyle = w.color;
    ctx.lineWidth = w.width;
    ctx.beginPath();
    ctx.moveTo(s.handR.x, s.handR.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    // weapon-specific accent
    if (s.weapon === "hammer") {
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.weapon === "spear") {
      ctx.fillStyle = "#dadada";
      ctx.beginPath();
      const dx = tip.x - s.handR.x, dy = tip.y - s.handR.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux;
      ctx.moveTo(tip.x + ux * 10, tip.y + uy * 10);
      ctx.lineTo(tip.x + px * 5, tip.y + py * 5);
      ctx.lineTo(tip.x - px * 5, tip.y - py * 5);
      ctx.closePath();
      ctx.fill();
    } else if (s.weapon === "sword") {
      ctx.strokeStyle = "#3a2616";
      ctx.lineWidth = 6;
      ctx.beginPath();
      const dx = tip.x - s.handR.x, dy = tip.y - s.handR.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len * 6, py = dx / len * 6;
      ctx.moveTo(s.handR.x + px, s.handR.y + py);
      ctx.lineTo(s.handR.x - px, s.handR.y - py);
      ctx.stroke();
    } else if (s.weapon === "lightsaber") {
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width;
      ctx.beginPath();
      ctx.moveTo(s.handR.x, s.handR.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Grace shield
  if (!s.dead && s.grace > 0) {
    ctx.strokeStyle = `rgba(120, 200, 255, ${0.4 + 0.3 * Math.sin(s.grace * 0.3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.hip.x, s.hip.y - 20, 42, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP bar
  if (!s.dead) {
    const barX = s.head.x - 18, barY = s.head.y - 22;
    ctx.fillStyle = "#222";
    ctx.fillRect(barX, barY, 36, 4);
    ctx.fillStyle = s.ai ? "#ff5050" : "#4ad295";
    ctx.fillRect(barX, barY, 36 * Math.max(0, s.hp / s.maxHp), 4);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Damage system
// ─────────────────────────────────────────────────────────────────────────────

function segDistSq(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cy = ay + dy * t;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

function applyImpulse(p: Particle, ix: number, iy: number): void {
  if (p.pinned) return;
  p.px -= ix;
  p.py -= iy;
}

interface Hit {
  x: number;
  y: number;
  life: number;
}
const hits: Hit[] = [];

function checkWeaponHits(attacker: Stickman, defender: Stickman): void {
  if (attacker.dead || defender.dead) return;
  if (defender.grace > 0 || defender.hitCooldown > 0) return;
  const tip = weaponTip(attacker);
  const tipVx = tip.x - tip.px;
  const tipVy = tip.y - tip.py;
  const speed = Math.hypot(tipVx, tipVy);
  if (speed < 5) return; // minimum swing speed to deal damage
  const w = WEAPONS[attacker.weapon];

  const targets: { p: Particle; mult: number }[] = [
    { p: defender.head, mult: 1.4 },
    { p: defender.neck, mult: 1.1 },
    { p: defender.hip, mult: 1.0 },
    { p: defender.handL, mult: 0.6 },
    { p: defender.handR, mult: 0.6 },
    { p: defender.footL, mult: 0.6 },
    { p: defender.footR, mult: 0.6 },
  ];
  for (const t of targets) {
    const distSq = segDistSq(attacker.handR.x, attacker.handR.y, tip.x, tip.y, t.p.x, t.p.y);
    const r = t.p.radius + w.width;
    if (distSq < r * r) {
      // damage = weapon.damage * t.mult * speed factor
      // Tip extra if the contact is near the tip
      const distFromTip = Math.hypot(t.p.x - tip.x, t.p.y - tip.y);
      const tipFactor = 1 + w.tipBonus * Math.max(0, 1 - distFromTip / 30);
      const dmg = w.damage * t.mult * (speed * 0.10) * tipFactor;
      defender.hp -= dmg;
      defender.hitCooldown = 18; // ~0.3s before next hit lands

      // knockback impulse
      const kx = tipVx * 0.45;
      const ky = tipVy * 0.45 - 1.2;
      applyImpulse(t.p, kx, ky);
      applyImpulse(defender.hip, kx * 0.3, ky * 0.2);

      hits.push({ x: t.p.x, y: t.p.y, life: 14 });

      if (defender.hp <= 0) {
        defender.dead = true;
        defender.uprightStrength = 0;
      }
      // only one hit per swing-tick per defender to avoid combo blowups
      return;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "stickman-fight-save";

interface SaveData {
  coins: number;
  owned: WeaponId[];
  equipped: WeaponId;
  round: number;
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        coins: data.coins ?? 0,
        owned: Array.isArray(data.owned) ? data.owned : ["fist"],
        equipped: data.equipped ?? "fist",
        round: data.round ?? 1,
      };
    }
  } catch {}
  return { coins: 0, owned: ["fist"], equipped: "fist", round: 1 };
}

function persistSave(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ coins: save.coins, owned: save.owned, equipped: save.equipped, round: save.round })
  );
}

const save = loadSave();

const player: Stickman = makeStickman(220, GROUND_Y - 35, {
  ai: false,
  weapon: save.equipped,
  color: "#111",
  hp: 150,
});

let enemies: Stickman[] = [];

function spawnRound(round: number): void {
  enemies = [];
  const count = Math.min(1 + Math.floor((round - 1) / 2), 4);
  const enemyWeapons: WeaponId[] = ["fist", "fist", "stick", "stick", "bat", "sword", "spear", "hammer"];
  for (let i = 0; i < count; i++) {
    const wpn = enemyWeapons[Math.min(round - 1 + i, enemyWeapons.length - 1)] ?? "fist";
    const e = makeStickman(WIDTH - 100 - i * 90, GROUND_Y - 35, {
      ai: true,
      weapon: wpn,
      color: "#a83232",
      hp: 40 + round * 12,
    });
    e.facing = -1;
    enemies.push(e);
  }
}

spawnRound(save.round);

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

let dragging: Particle | null = null;
let mouseX = 0, mouseY = 0;
const keys = new Set<string>();

function getMouse(e: MouseEvent | TouchEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  let cx = 0, cy = 0;
  if ("touches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (t) { cx = t.clientX; cy = t.clientY; }
  } else {
    cx = e.clientX; cy = e.clientY;
  }
  return {
    x: ((cx - rect.left) / rect.width) * WIDTH,
    y: ((cy - rect.top) / rect.height) * HEIGHT,
  };
}

function startDrag(x: number, y: number): void {
  mouseX = x; mouseY = y;
  // grab nearest hand within range
  const candidates: Particle[] = [player.handR, player.handL];
  let best: Particle | null = null;
  let bestDist = 70;
  for (const c of candidates) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  dragging = best ?? player.handR; // default to weapon hand
}

canvas.addEventListener("mousedown", (e) => {
  const { x, y } = getMouse(e);
  startDrag(x, y);
});
canvas.addEventListener("mousemove", (e) => {
  const { x, y } = getMouse(e);
  mouseX = x; mouseY = y;
});
window.addEventListener("mouseup", () => { dragging = null; });

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const { x, y } = getMouse(e);
  startDrag(x, y);
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const { x, y } = getMouse(e);
  mouseX = x; mouseY = y;
}, { passive: false });
canvas.addEventListener("touchend", () => { dragging = null; });

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys.delete(e.key.toLowerCase()); });

// ─────────────────────────────────────────────────────────────────────────────
// Shop UI
// ─────────────────────────────────────────────────────────────────────────────

const overlay = document.getElementById("sf-overlay")!;
const panel = document.getElementById("sf-panel")!;
const coinsEl = document.getElementById("sf-coins")!;
const roundEl = document.getElementById("sf-round")!;
const shopBtn = document.getElementById("sf-shop-btn") as HTMLButtonElement;

let paused = false;

function updateHUD(): void {
  coinsEl.textContent = `💰 ${save.coins}`;
  roundEl.textContent = `Round ${save.round}`;
}

function openShop(): void {
  paused = true;
  overlay.hidden = false;
  panel.innerHTML = `
    <h2>Weapon Shop</h2>
    <p>Buy bigger sticks. Hit harder.</p>
    <div class="sf-shop-list">
      ${WEAPON_ORDER.map((id) => {
        const w = WEAPONS[id];
        const owned = save.owned.includes(id);
        const equipped = save.equipped === id;
        const canBuy = !owned && save.coins >= w.price;
        let btn = "";
        if (equipped) btn = `<button disabled>Equipped</button>`;
        else if (owned) btn = `<button data-equip="${id}">Equip</button>`;
        else btn = `<button data-buy="${id}" ${canBuy ? "" : "disabled"}>${canBuy ? `Buy 💰${w.price}` : `💰${w.price}`}</button>`;
        return `
          <div class="sf-shop-item ${equipped ? "equipped" : ""}">
            <span><b>${w.name}</b> — dmg ${w.damage.toFixed(1)}${w.tipBonus ? ` + tip ${w.tipBonus.toFixed(1)}` : ""}, reach ${w.length}</span>
            ${btn}
          </div>
        `;
      }).join("")}
    </div>
    <div class="sf-actions">
      <button id="sf-close-shop">Close</button>
    </div>
  `;
  panel.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset["buy"] as WeaponId;
      const w = WEAPONS[id];
      if (save.coins >= w.price) {
        save.coins -= w.price;
        save.owned.push(id);
        save.equipped = id;
        player.weapon = id;
        persistSave();
        updateHUD();
        openShop();
      }
    });
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset["equip"] as WeaponId;
      save.equipped = id;
      player.weapon = id;
      persistSave();
      openShop();
    });
  });
  panel.querySelector<HTMLButtonElement>("#sf-close-shop")!.addEventListener("click", closeOverlay);
}

function showRoundComplete(reward: number): void {
  paused = true;
  overlay.hidden = false;
  panel.innerHTML = `
    <h2>Round ${save.round} Cleared!</h2>
    <p>You earned 💰 ${reward}.</p>
    <div class="sf-actions">
      <button id="sf-shop-open">Visit Shop</button>
      <button id="sf-next">Next Round →</button>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>("#sf-shop-open")!.addEventListener("click", openShop);
  panel.querySelector<HTMLButtonElement>("#sf-next")!.addEventListener("click", () => {
    save.round += 1;
    persistSave();
    updateHUD();
    spawnRound(save.round);
    resetPlayer();
    roundResolved = false;
    showStartRound();
  });
}

function showStartRound(): void {
  paused = true;
  overlay.hidden = false;
  panel.innerHTML = `
    <h2>Round ${save.round}</h2>
    <p>Drag your stickman's <b>right hand</b> (the one holding the weapon) around the canvas to swing.
       Faster swings hit harder. Tap arrows / WASD to nudge your body and jump.</p>
    <p>You're holding: <b>${WEAPONS[save.equipped].name}</b></p>
    <div class="sf-actions">
      <button id="sf-shop-open">Shop</button>
      <button id="sf-fight">Fight! →</button>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>("#sf-shop-open")!.addEventListener("click", openShop);
  panel.querySelector<HTMLButtonElement>("#sf-fight")!.addEventListener("click", () => {
    closeOverlay();
  });
}

function showDefeat(): void {
  paused = true;
  overlay.hidden = false;
  panel.innerHTML = `
    <h2>You got knocked out.</h2>
    <p>Round ${save.round} restarts. Try again — same weapons, same coins.</p>
    <div class="sf-actions">
      <button id="sf-shop-open">Shop</button>
      <button id="sf-retry">Retry</button>
    </div>
  `;
  panel.querySelector<HTMLButtonElement>("#sf-shop-open")!.addEventListener("click", openShop);
  panel.querySelector<HTMLButtonElement>("#sf-retry")!.addEventListener("click", () => {
    spawnRound(save.round);
    resetPlayer();
    roundResolved = false;
    showStartRound();
  });
}

function closeOverlay(): void {
  overlay.hidden = true;
  paused = false;
}

function resetPlayer(): void {
  const fresh = makeStickman(220, GROUND_Y - 35, { ai: false, weapon: save.equipped, color: "#111", hp: 150 });
  Object.assign(player, fresh);
}

shopBtn.addEventListener("click", () => {
  if (!paused) openShop();
});

// ─────────────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────────────

function updateAI(e: Stickman, _dt: number): void {
  if (e.dead) return;
  // Move toward player
  const dx = player.hip.x - e.hip.x;
  const dir = Math.sign(dx) || 1;
  e.facing = dir as 1 | -1;
  const wReach = WEAPONS[e.weapon].length + 30;

  // Walk if too far
  if (Math.abs(dx) > wReach) {
    const speed = 0.18 + Math.min(0.12, save.round * 0.015);
    applyImpulse(e.hip, dir * speed, 0);
    applyImpulse(e.footL, dir * speed * 0.8, 0);
    applyImpulse(e.footR, dir * speed * 0.8, 0);
  }

  // Only swing when in range or close to it; pause between swings.
  const inRange = Math.abs(dx) < wReach + 30;
  const swingSpeed = 0.06 + Math.min(0.05, save.round * 0.008);
  e.swingPhase += inRange ? swingSpeed : swingSpeed * 0.3;
  const swing = Math.sin(e.swingPhase);
  const armReach = 26 + swing * 22;
  const targetHandX = e.neck.x + dir * armReach;
  const targetHandY = e.neck.y + Math.cos(e.swingPhase) * 18 - 4;
  const pullStrength = 0.10 + Math.min(0.10, save.round * 0.012);
  e.handR.x += (targetHandX - e.handR.x) * pullStrength;
  e.handR.y += (targetHandY - e.handR.y) * pullStrength;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────────

let roundResolved = false;

function step(): void {
  if (paused) {
    requestAnimationFrame(step);
    return;
  }

  // Keyboard nudge
  if (!player.dead) {
    let moveX = 0;
    if (keys.has("arrowleft") || keys.has("a")) moveX -= 0.5;
    if (keys.has("arrowright") || keys.has("d")) moveX += 0.5;
    if (moveX !== 0) {
      applyImpulse(player.hip, moveX, 0);
      applyImpulse(player.footL, moveX * 0.8, 0);
      applyImpulse(player.footR, moveX * 0.8, 0);
    }
    if (keys.has("arrowup") || keys.has("w") || keys.has(" ")) {
      const grounded = player.footL.y >= GROUND_Y - player.footL.radius - 2
        || player.footR.y >= GROUND_Y - player.footR.radius - 2;
      if (grounded) {
        applyImpulse(player.hip, 0, -9);
        applyImpulse(player.head, 0, -7);
      }
    }
  }

  // Dragging hand
  if (dragging && !player.dead) {
    // move hand toward mouse with spring
    const k = 0.35;
    dragging.x += (mouseX - dragging.x) * k;
    dragging.y += (mouseY - dragging.y) * k;
  } else if (!player.dead) {
    // Rest: pull weapon hand back toward a neutral guard position
    // and damp residual velocity so the body doesn't drift after a swing.
    const restX = player.neck.x + 22;
    const restY = player.neck.y + 4;
    player.handR.x += (restX - player.handR.x) * 0.12;
    player.handR.y += (restY - player.handR.y) * 0.12;
    // Damp horizontal velocity on the body
    const dampHip = 0.85;
    player.hip.px = player.hip.x - (player.hip.x - player.hip.px) * dampHip;
    player.head.px = player.head.x - (player.head.x - player.head.px) * dampHip;
  }

  // Physics step
  const all = [player, ...enemies];
  for (const s of all) {
    if (s.grace > 0) s.grace--;
    if (s.hitCooldown > 0) s.hitCooldown--;
    applyPosture(s);
    for (const p of s.parts) updateParticle(p);
  }
  // Multiple constraint passes
  for (let i = 0; i < 4; i++) {
    for (const s of all) {
      for (const st of s.sticks) constrainStick(st);
      for (const p of s.parts) constrainGround(p);
    }
  }

  // AI act
  for (const e of enemies) updateAI(e, 1);

  // Combat
  for (const e of enemies) {
    checkWeaponHits(player, e);
    checkWeaponHits(e, player);
  }

  // Draw
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // sky already in css gradient but canvas covers — paint backdrop
  const grd = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grd.addColorStop(0, "#7fc2ff");
  grd.addColorStop(0.64, "#c8e8ff");
  grd.addColorStop(0.65, "#d6b687");
  grd.addColorStop(1, "#a07440");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // ground line
  ctx.strokeStyle = "#7a5532";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(WIDTH, GROUND_Y);
  ctx.stroke();

  // distant mountains
  ctx.fillStyle = "rgba(80, 110, 140, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= WIDTH; x += 80) {
    ctx.lineTo(x, GROUND_Y - 60 - Math.sin(x * 0.013) * 30 - (x % 160 === 0 ? 20 : 0));
  }
  ctx.lineTo(WIDTH, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // hit sparks
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]!;
    ctx.strokeStyle = `rgba(255, 220, 80, ${h.life / 14})`;
    ctx.lineWidth = 3;
    const r = 18 - h.life;
    ctx.beginPath();
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + h.life * 0.2;
      ctx.moveTo(h.x + Math.cos(ang) * 4, h.y + Math.sin(ang) * 4);
      ctx.lineTo(h.x + Math.cos(ang) * (4 + r), h.y + Math.sin(ang) * (4 + r));
    }
    ctx.stroke();
    h.life--;
    if (h.life <= 0) hits.splice(i, 1);
  }

  for (const s of all) drawStickman(s);

  // Round / death checks
  if (!roundResolved) {
    if (player.dead) {
      roundResolved = true;
      setTimeout(showDefeat, 1200);
    } else if (enemies.every((e) => e.dead)) {
      roundResolved = true;
      const reward = 20 + save.round * 10;
      save.coins += reward;
      persistSave();
      updateHUD();
      setTimeout(() => showRoundComplete(reward), 900);
    }
  }
  if (roundResolved && (player.dead || enemies.every((e) => e.dead)) && !overlay.hidden === false) {
    // overlay handles next step
  }
  if (!paused && (player.dead || enemies.every((e) => e.dead))) {
    // wait
  }
  if (!player.dead && enemies.some((e) => !e.dead)) {
    roundResolved = false;
  }

  requestAnimationFrame(step);
}

updateHUD();
showStartRound();
requestAnimationFrame(step);
