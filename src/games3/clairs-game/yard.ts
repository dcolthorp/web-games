/**
 * The front yard: no walking, no city, just you and gravity. Hold Space to
 * squeeze, release to get shoved, and the edges wrap so there's nowhere to
 * get stuck.
 */

import { fartImpulse, wrap, wrappedCopies } from "./physics";
import { FRONT_YARD, type Body } from "./planets";
import { playFart } from "./sfx";

const MAX_CHARGE = 1.15;
const MIN_PUSH = 200;
const MAX_PUSH = 880;
const AIM_SPEED = 3.1;
const PLAYER_R = 15;

type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };
type Cloud = { x: number; y: number; r: number; drift: number; tone: number };

export type Yard = {
  /** Same rules everywhere; only the body's gravity and air change. */
  enter(body: Body): void;
  update(dt: number): void;
  draw(): void;
  press(key: string): void;
  release(key: string): void;
};

export function createYard(
  context: CanvasRenderingContext2D,
  W: number,
  H: number,
  hud: { charge: HTMLElement; farts: HTMLElement },
): Yard {
  let body: Body = FRONT_YARD;
  const player = { x: W / 2, y: H / 2, vx: 0, vy: 0, aim: -Math.PI / 2, lean: 0 };
  const puffs: Puff[] = [];
  let clouds: Cloud[] = makeClouds(FRONT_YARD);

  function makeClouds(from: Body): Cloud[] {
    return Array.from({ length: from.hazeCount }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 40 + Math.random() * 90,
      drift: 4 + Math.random() * 12,
      tone: 0.5 + Math.random() * 0.5,
    }));
  }
  const keys = new Set<string>();
  let charge = 0;
  let charging = false;
  let farts = 0;

  window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  // Losing focus mid-squeeze shouldn't leave the charge stuck on forever.
  window.addEventListener("blur", () => {
    keys.clear();
    charging = false;
    charge = 0;
  });

  function releaseFart(): void {
    if (!charging) return;
    charging = false;
    const power = charge / MAX_CHARGE;
    const push = fartImpulse(charge, MAX_CHARGE, MIN_PUSH, MAX_PUSH);
    // You go where you point; the gas goes the other way.
    player.vx += Math.cos(player.aim) * push;
    player.vy += Math.sin(player.aim) * push;
    player.lean = 1;
    spawnPuffs(power);
    playFart(power);
    farts += 1;
    hud.farts.textContent = `FARTS ${farts}`;
    charge = 0;
  }

  function spawnPuffs(power: number): void {
    const back = player.aim + Math.PI;
    const count = 8 + Math.round(power * 16);
    for (let i = 0; i < count; i += 1) {
      const spread = (Math.random() - 0.5) * 0.9;
      const speed = 60 + Math.random() * (110 + power * 260);
      const angle = back + spread;
      puffs.push({
        x: player.x + Math.cos(back) * PLAYER_R,
        y: player.y + Math.sin(back) * PLAYER_R,
        vx: Math.cos(angle) * speed + player.vx * 0.2,
        vy: Math.sin(angle) * speed + player.vy * 0.2,
        life: 0,
        max: 0.5 + Math.random() * (0.5 + power),
        r: 4 + Math.random() * (6 + power * 12),
      });
    }
  }

  function update(dt: number): void {
    if (keys.has("arrowleft") || keys.has("a")) player.aim -= AIM_SPEED * dt;
    if (keys.has("arrowright") || keys.has("d")) player.aim += AIM_SPEED * dt;

    if (charging) charge = Math.min(MAX_CHARGE, charge + dt);
    hud.charge.style.width = `${(charge / MAX_CHARGE) * 100}%`;

    player.vy += body.gravity * dt;
    const keep = body.air ** dt;
    player.vx *= keep;
    player.vy *= keep;
    player.x = wrap(player.x + player.vx * dt, W);
    player.y = wrap(player.y + player.vy * dt, H);
    player.lean = Math.max(0, player.lean - dt * 2.6);

    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const puff = puffs[i]!;
      puff.life += dt;
      if (puff.life >= puff.max) {
        puffs.splice(i, 1);
        continue;
      }
      puff.vy -= 26 * dt; // stink rises
      puff.vx *= 0.985;
      puff.vy *= 0.985;
      puff.x = wrap(puff.x + puff.vx * dt, W);
      puff.y = wrap(puff.y + puff.vy * dt, H);
      puff.r += dt * 22;
    }

    for (const cloud of clouds) cloud.x = wrap(cloud.x + cloud.drift * dt, W);
  }

  /**
   * Draw once per wrapped copy. Anything within a margin of an edge is painted
   * again on the far side, so crossing over looks continuous instead of like
   * the sprite vanishing into a wall.
   */
  function eachWrapped(x: number, y: number, margin: number, draw: (dx: number, dy: number) => void): void {
    for (const copy of wrappedCopies(x, y, margin, W, H)) draw(copy.x, copy.y);
  }

  function draw(): void {
    const sky = context.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, body.skyTop);
    sky.addColorStop(1, body.skyBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, W, H);

    for (const cloud of clouds) {
      eachWrapped(cloud.x, cloud.y, cloud.r + 10, (x, y) => {
        const glow = context.createRadialGradient(x, y, 0, x, y, cloud.r);
        glow.addColorStop(0, `rgba(${body.haze}, ${body.hazeAlpha * cloud.tone})`);
        glow.addColorStop(1, `rgba(${body.haze}, 0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, cloud.r, 0, Math.PI * 2);
        context.fill();
      });
    }

    for (const puff of puffs) {
      const t = puff.life / puff.max;
      eachWrapped(puff.x, puff.y, puff.r + 10, (x, y) => {
        context.fillStyle = `rgba(164, 214, 106, ${(1 - t) * 0.42})`;
        context.beginPath();
        context.arc(x, y, puff.r, 0, Math.PI * 2);
        context.fill();
      });
    }

    eachWrapped(player.x, player.y, 70, (x, y) => {
      context.save();
      context.translate(x, y);

      // Aim pointer: where the next fart will send you. Grows as you squeeze.
      const power = charge / MAX_CHARGE;
      const reach = 30 + power * 62;
      context.rotate(player.aim);
      context.strokeStyle = charging ? `rgba(255, 236, 120, ${0.55 + power * 0.45})` : "rgba(255, 255, 255, 0.32)";
      context.lineWidth = charging ? 3 + power * 3 : 2;
      context.setLineDash([7, 6]);
      context.beginPath();
      context.moveTo(PLAYER_R + 4, 0);
      context.lineTo(reach, 0);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(reach + 9, 0);
      context.lineTo(reach - 3, -6);
      context.lineTo(reach - 3, 6);
      context.closePath();
      context.fillStyle = charging ? "#ffec78" : "rgba(255,255,255,0.4)";
      context.fill();
      context.restore();

      // The person. Upright, squashing a little on the recoil.
      context.save();
      context.translate(x, y);
      const squash = 1 + player.lean * 0.16;
      context.scale(1 / squash, squash);
      context.strokeStyle = "#f4f7ff";
      context.fillStyle = "#f4f7ff";
      context.lineWidth = 4;
      context.lineCap = "round";
      context.beginPath();
      context.arc(0, -14, 8, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(0, -6);
      context.lineTo(0, 8);
      context.moveTo(0, -2);
      context.lineTo(-9, 4);
      context.moveTo(0, -2);
      context.lineTo(9, 4);
      context.moveTo(0, 8);
      context.lineTo(-7, 19);
      context.moveTo(0, 8);
      context.lineTo(7, 19);
      context.stroke();
      if (charging) {
        context.fillStyle = `rgba(164, 214, 106, ${0.25 + power * 0.5})`;
        context.beginPath();
        context.arc(0, 4, 8 + power * 7, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });
  }

  function enter(arriving: Body): void {
    body = arriving;
    clouds = makeClouds(body);
    farts = 0;
    hud.farts.textContent = "FARTS 0";
    player.x = W / 2;
    player.y = H / 2;
    player.vx = 0;
    player.vy = 0;
    player.aim = -Math.PI / 2;
    player.lean = 0;
    charge = 0;
    charging = false;
    puffs.length = 0;
    hud.charge.style.width = "0%";
  }

  function press(key: string): void {
    if (key === " ") {
      charging = true;
      charge = 0;
    }
  }

  function release(key: string): void {
    if (key === " ") releaseFart();
  }

  return { enter, update, draw, press, release };
}
