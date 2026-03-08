import type { GrowthStage } from "../model/types";
import { getAccentColor, getParticleTypes } from "../systems/theme";
import { rgb } from "../systems/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: [number, number, number];
  type: string;
};

export class ParticleSystem {
  private particles: Particle[] = [];

  update(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 10 * dt;
      return p.life < p.ttl;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.ttl;
      if (p.type === "glint") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 6);
        ctx.fillStyle = rgb(p.color, alpha);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "drip") {
        const grad = ctx.createRadialGradient(p.x, p.y - p.size * 0.3, 1, p.x, p.y, p.size);
        grad.addColorStop(0, rgb(p.color, alpha));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.7, p.size * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "void_spark") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 4);
        ctx.strokeStyle = rgb(p.color, alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(p.size, 0);
        ctx.moveTo(0, -p.size);
        ctx.lineTo(0, p.size);
        ctx.moveTo(-p.size * 0.6, -p.size * 0.6);
        ctx.lineTo(p.size * 0.6, p.size * 0.6);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = rgb(p.color, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  spawnSparkles(x: number, y: number, count: number, stage: GrowthStage): void {
    const color = getAccentColor(stage);
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x: x + rand(-20, 20),
        y: y + rand(-20, 20),
        vx: rand(-30, 30),
        vy: rand(-50, -10),
        ttl: rand(0.4, 0.8),
        size: rand(2, 4),
        color,
        type: "sparkle",
      });
    }
  }

  spawnBrushEffect(x: number, y: number, stage: GrowthStage): void {
    const color = getAccentColor(stage);
    for (let i = 0; i < 6; i += 1) {
      this.spawn({
        x: x + rand(-10, 10),
        y: y + rand(-10, 10),
        vx: rand(-20, 20),
        vy: rand(-20, -5),
        ttl: rand(0.3, 0.6),
        size: rand(2, 3),
        color,
        type: "brush",
      });
    }
  }

  spawnEatingEffect(x: number, y: number, stage: GrowthStage): void {
    const color = getAccentColor(stage);
    for (let i = 0; i < 8; i += 1) {
      this.spawn({
        x: x + rand(-15, 15),
        y: y + rand(-10, 10),
        vx: rand(-10, 10),
        vy: rand(-30, -10),
        ttl: rand(0.4, 0.7),
        size: rand(2, 4),
        color,
        type: "eat",
      });
    }
  }

  spawnEvolutionEffect(x: number, y: number, stage: GrowthStage): void {
    const color = getAccentColor(stage);
    for (let i = 0; i < 24; i += 1) {
      this.spawn({
        x: x + rand(-20, 20),
        y: y + rand(-20, 20),
        vx: rand(-60, 60),
        vy: rand(-80, 0),
        ttl: rand(0.6, 1.2),
        size: rand(2, 5),
        color,
        type: "evolve",
      });
    }
  }

  spawnAmbient(stage: GrowthStage): void {
    const types = getParticleTypes(stage);
    if (types.length === 0) return;
    const color = getAccentColor(stage);
    const type = types[Math.floor(Math.random() * types.length)] ?? "sparkle";
    this.spawn({
      x: rand(50, 750),
      y: rand(50, 550),
      vx: rand(-10, 10),
      vy: rand(-10, 5),
      ttl: rand(0.8, 1.6),
      size: rand(1, 3),
      color,
      type,
    });
  }

  private spawn(p: Omit<Particle, "life">): void {
    this.particles.push({ ...p, life: 0 });
  }
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
