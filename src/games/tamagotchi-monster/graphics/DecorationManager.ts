import type { GrowthStage } from "../model/types";
import { getAccentColor, getDecorationTypes } from "../systems/theme";
import { rgb } from "../systems/utils";

type Decoration = {
  x: number;
  y: number;
  size: number;
  type: string;
  rotation: number;
  alpha: number;
};

export class DecorationManager {
  private decorations: Decoration[] = [];
  private currentStage: GrowthStage = "egg";

  constructor(private width: number, private height: number) {
    this.generate();
  }

  setStage(stage: GrowthStage): void {
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.generate();
    }
  }

  update(dt: number): void {
    for (const dec of this.decorations) {
      dec.y += Math.sin(performance.now() / 1000 + dec.x) * 0.05;
      dec.rotation += dt * 10;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const accent = getAccentColor(this.currentStage);
    for (const dec of this.decorations) {
      ctx.save();
      ctx.globalAlpha = dec.alpha;
      ctx.fillStyle = rgb(accent);
      if (dec.type === "hearts") this.drawHeart(ctx, dec);
      else if (dec.type === "stars") this.drawStar(ctx, dec);
      else if (dec.type === "sparkles") this.drawSparkle(ctx, dec);
      else if (dec.type === "flowers") this.drawFlower(ctx, dec);
      else if (dec.type === "swirls") this.drawSwirl(ctx, dec);
      else if (dec.type === "shadows") this.drawShadow(ctx, dec);
      else if (dec.type === "mist") this.drawMist(ctx, dec);
      else if (dec.type === "cobwebs") this.drawCobweb(ctx, dec);
      else if (dec.type === "bones") this.drawBone(ctx, dec);
      else if (dec.type === "drips") this.drawDrip(ctx, dec);
      else if (dec.type === "floating_eyes") this.drawEye(ctx, dec);
      else if (dec.type === "void_symbols") this.drawVoidSymbol(ctx, dec);
      else if (dec.type === "tendrils") this.drawTendril(ctx, dec);
      else if (dec.type === "coins") this.drawCoin(ctx, dec);
      else if (dec.type === "bills") this.drawBill(ctx, dec);
      else if (dec.type === "diamonds") this.drawDiamond(ctx, dec);
      ctx.restore();
    }
  }

  private generate(): void {
    this.decorations = [];
    const types = getDecorationTypes(this.currentStage);
    if (!types.length) return;
    const count = 12 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i += 1) {
      this.decorations.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: 10 + Math.random() * 25,
        type: types[Math.floor(Math.random() * types.length)] as string,
        rotation: Math.random() * Math.PI * 2,
        alpha: 0.3 + Math.random() * 0.4,
      });
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size;
    const x = dec.x;
    const y = dec.y;
    ctx.beginPath();
    ctx.arc(x - s / 4, y, s / 4, 0, Math.PI * 2);
    ctx.arc(x + s / 4, y, s / 4, 0, Math.PI * 2);
    ctx.moveTo(x - s / 2, y);
    ctx.lineTo(x + s / 2, y);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size;
    const x = dec.x;
    const y = dec.y;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = dec.rotation + (Math.PI / 5) * i;
      const radius = i % 2 === 0 ? s : s * 0.4;
      ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size;
    ctx.beginPath();
    ctx.moveTo(dec.x - s, dec.y);
    ctx.lineTo(dec.x + s, dec.y);
    ctx.moveTo(dec.x, dec.y - s);
    ctx.lineTo(dec.x, dec.y + s);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawFlower(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size;
    for (let i = 0; i < 5; i += 1) {
      const angle = dec.rotation + (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(dec.x + Math.cos(angle) * s * 0.6, dec.y + Math.sin(angle) * s * 0.6, s / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSwirl(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 20; i += 1) {
      const t = (i / 20) * Math.PI * 2;
      const r = dec.size * (1 - i / 30);
      const x = dec.x + Math.cos(t + dec.rotation) * r;
      const y = dec.y + Math.sin(t + dec.rotation) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(dec.x, dec.y, dec.size * 1.5, dec.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMist(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.fillStyle = "rgba(100,100,120,0.25)";
    ctx.beginPath();
    ctx.ellipse(dec.x, dec.y, dec.size * 1.8, dec.size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCobweb(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    const s = dec.size;
    for (let i = 0; i < 6; i += 1) {
      const angle = dec.rotation + (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(dec.x, dec.y);
      ctx.lineTo(dec.x + Math.cos(angle) * s, dec.y + Math.sin(angle) * s);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, s * 0.6, 0, Math.PI);
    ctx.stroke();
  }

  private drawBone(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 4;
    const s = dec.size;
    ctx.beginPath();
    ctx.moveTo(dec.x - s, dec.y);
    ctx.lineTo(dec.x + s, dec.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dec.x - s, dec.y, s / 3, 0, Math.PI * 2);
    ctx.arc(dec.x + s, dec.y, s / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDrip(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const grad = ctx.createLinearGradient(dec.x, dec.y - dec.size / 2, dec.x, dec.y + dec.size);
    grad.addColorStop(0, "rgba(60,60,90,0.2)");
    grad.addColorStop(1, "rgba(20,20,30,0.6)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(dec.x, dec.y + dec.size / 2, dec.size / 4, dec.size / 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, dec.size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.ellipse(dec.x - dec.size / 10, dec.y - dec.size / 6, dec.size / 10, dec.size / 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEye(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const grad = ctx.createRadialGradient(dec.x - dec.size / 4, dec.y - dec.size / 6, 2, dec.x, dec.y, dec.size);
    grad.addColorStop(0, "rgba(255,120,140,0.8)");
    grad.addColorStop(1, "rgba(255,40,60,0.4)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(dec.x, dec.y, dec.size, dec.size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, dec.size / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(dec.x - dec.size / 3, dec.y - dec.size / 6, dec.size / 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawVoidSymbol(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    ctx.strokeStyle = "rgba(80,255,120,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, dec.size / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, dec.size / 3, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dec.x - dec.size / 2, dec.y);
    ctx.lineTo(dec.x + dec.size / 2, dec.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dec.x, dec.y - dec.size / 2);
    ctx.lineTo(dec.x, dec.y + dec.size / 2);
    ctx.stroke();
  }

  private drawTendril(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const time = performance.now() / 1000;
    const edgeLeft = dec.x < this.width * 0.3;
    const edgeRight = dec.x > this.width * 0.7;
    const edgeTop = dec.y < this.height * 0.4;
    let sx = dec.x;
    let sy = dec.y;
    let tx = this.width / 2;
    let ty = this.height / 2;
    if (edgeLeft) sx = 0;
    else if (edgeRight) sx = this.width;
    if (edgeTop) sy = 0;
    else if (!edgeLeft && !edgeRight) sy = this.height;
    const sway = Math.sin(time + dec.rotation) * dec.size * 0.6;
    const cx1 = (sx + tx) / 2 + sway;
    const cy1 = sy + dec.size * 1.2;
    const cx2 = (sx + tx) / 2 - sway;
    const cy2 = ty - dec.size * 1.2;
    ctx.strokeStyle = "rgba(20,20,30,0.6)";
    ctx.lineWidth = dec.size * 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = "rgba(90,255,120,0.2)";
    ctx.lineWidth = dec.size * 0.2;
    ctx.stroke();

    if (dec.size >= 20) {
      ctx.fillStyle = "rgba(255,200,220,0.25)";
      for (let i = 1; i <= 4; i += 1) {
        const t = i / 5;
        const omt = 1 - t;
        const px =
          omt * omt * omt * sx +
          3 * omt * omt * t * cx1 +
          3 * omt * t * t * cx2 +
          t * t * t * tx;
        const py =
          omt * omt * omt * sy +
          3 * omt * omt * t * cy1 +
          3 * omt * t * t * cy2 +
          t * t * t * ty;
        ctx.beginPath();
        ctx.arc(px, py, dec.size * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCoin(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size;
    const grad = ctx.createRadialGradient(dec.x - s / 4, dec.y - s / 4, 2, dec.x, dec.y, s / 2);
    grad.addColorStop(0, "rgba(255,240,170,0.9)");
    grad.addColorStop(0.6, "rgba(220,180,60,0.85)");
    grad.addColorStop(1, "rgba(140,100,30,0.7)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,90,30,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawBill(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const w = dec.size * 1.4;
    const h = dec.size * 0.8;
    ctx.save();
    ctx.translate(dec.x, dec.y);
    ctx.rotate(dec.rotation);
    ctx.fillStyle = "rgba(120,200,140,0.5)";
    ctx.strokeStyle = "rgba(60,140,90,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, h / 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, dec: Decoration): void {
    const s = dec.size * 0.6;
    ctx.save();
    ctx.translate(dec.x, dec.y);
    ctx.rotate(dec.rotation);
    ctx.fillStyle = "rgba(220,255,255,0.7)";
    ctx.strokeStyle = "rgba(120,200,220,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
