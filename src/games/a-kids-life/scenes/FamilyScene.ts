import { SIMPLE_FONT } from "../constants";
import { drawPortraitChip } from "../graphics/draw";
import type { FamilySave } from "../model/types";
import { getFamilyMembers } from "../systems/family";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";

type PortraitButton = { id: string; x: number; y: number; size: number };

export class FamilyScene implements Scene {
  private readonly backButton = new Button(42, 34, 148, 58, "Back", "cream", () => this.opts.onBack());
  private readonly portraitButtons: PortraitButton[];

  constructor(
    private readonly opts: {
      save: FamilySave;
      onBack: () => void;
      onPick: (personId: string) => void;
    }
  ) {
    const members = getFamilyMembers(opts.save);
    this.portraitButtons = members.map((person, index) => ({
      id: person.id,
      x: 118 + index * 154,
      y: 136,
      size: 78,
    }));
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fff5ee";
    ctx.fillRect(0, 0, 1200, 760);

    ctx.fillStyle = "#6b5365";
    ctx.textAlign = "left";
    ctx.font = `800 48px ${SIMPLE_FONT}`;
    ctx.fillText("Family", 72, 90);
    ctx.font = `700 20px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.74;
    ctx.fillText("Tap a face.", 72, 118);
    ctx.globalAlpha = 1;

    const members = getFamilyMembers(this.opts.save);
    for (const button of this.portraitButtons) {
      const person = members.find((item) => item.id === button.id);
      if (!person) {
        continue;
      }
      drawPortraitChip(ctx, person, button.x, button.y, button.size, person.id === this.opts.save.activePersonId);
      ctx.fillStyle = "#705467";
      ctx.textAlign = "center";
      ctx.font = `700 18px ${SIMPLE_FONT}`;
      ctx.fillText(person.name, button.x, button.y + 66);
    }

    const root = this.opts.save.people[this.opts.save.rootPersonId];
    if (root) {
      this.drawTree(ctx, root.id, 600, 288, 0);
    }

    this.backButton.draw(ctx);
  }

  private drawTree(ctx: CanvasRenderingContext2D, personId: string, x: number, y: number, depth: number): void {
    const person = this.opts.save.people[personId];
    if (!person) {
      return;
    }

    const boxWidth = 170;
    const boxHeight = 74;
    ctx.fillStyle = person.id === this.opts.save.activePersonId ? "#fff0f5" : "#fff";
    ctx.strokeStyle = person.id === this.opts.save.activePersonId ? "#f29ab4" : "#c9b1ba";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6a5163";
    ctx.textAlign = "center";
    ctx.font = `800 24px ${SIMPLE_FONT}`;
    ctx.fillText(person.name, x, y - 4);
    ctx.font = `700 16px ${SIMPLE_FONT}`;
    ctx.fillText(person.lifeStage.toUpperCase(), x, y + 22);

    const childIds = person.childIds;
    if (childIds.length === 0 || depth > 3) {
      return;
    }

    const startX = x - ((childIds.length - 1) * 220) / 2;
    ctx.strokeStyle = "#d7b3bf";
    ctx.lineWidth = 4;
    for (let index = 0; index < childIds.length; index += 1) {
      const childId = childIds[index];
      if (!childId) {
        continue;
      }
      const childX = startX + index * 220;
      const childY = y + 150;
      ctx.beginPath();
      ctx.moveTo(x, y + boxHeight / 2);
      ctx.lineTo(childX, childY - boxHeight / 2);
      ctx.stroke();
      this.drawTree(ctx, childId, childX, childY, depth + 1);
    }
  }

  onPointerMove(x: number, y: number): void {
    this.backButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.backButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.backButton.handlePointerUp(x, y);

    for (const button of this.portraitButtons) {
      const dx = x - button.x;
      const dy = y - button.y;
      if (dx * dx + dy * dy <= (button.size / 2) * (button.size / 2)) {
        this.opts.onPick(button.id);
      }
    }
  }
}
