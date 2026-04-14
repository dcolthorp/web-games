import { SIMPLE_FONT } from "../constants";
import { drawBackground, drawCharacter } from "../graphics/draw";
import type { FamilySave, Milestone } from "../model/types";
import { renamePerson } from "../systems/family";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";

export class MilestoneScene implements Scene {
  private readonly doneButton = new Button(520, 604, 160, 74, "Yay", "mint", () => this.finish());
  private nameText = "";

  constructor(
    private readonly opts: {
      save: FamilySave;
      milestone: Milestone;
      onDone: () => void;
    }
  ) {
    if (opts.milestone.newBabyId) {
      const baby = opts.save.people[opts.milestone.newBabyId];
      this.nameText = baby?.name ?? "";
    }
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const person = this.opts.save.people[this.opts.milestone.newBabyId ?? this.opts.milestone.personId];
    if (!person) {
      return;
    }

    drawBackground(ctx, person.lifeStage, this.opts.save.homeStyle, 0);
    ctx.fillStyle = "rgba(103,72,89,0.18)";
    ctx.fillRect(0, 0, 1200, 760);

    ctx.fillStyle = "#fffaf1";
    ctx.strokeStyle = "#d8a8b9";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(280, 88, 640, 580, 40);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6a5163";
    ctx.textAlign = "center";
    ctx.font = `800 54px ${SIMPLE_FONT}`;
    ctx.fillText(this.opts.milestone.title, 600, 164);
    ctx.font = `700 24px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.76;
    ctx.fillText(this.opts.milestone.note, 600, 202);
    ctx.globalAlpha = 1;

    drawCharacter(ctx, person, { x: 600, y: 402, size: 190, mood: "yay", highlight: true });

    if (this.opts.milestone.newBabyId) {
      ctx.font = `700 22px ${SIMPLE_FONT}`;
      ctx.fillText("Baby name", 600, 500);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#ccb0bf";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(434, 522, 332, 64, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6a5163";
      ctx.font = `800 30px ${SIMPLE_FONT}`;
      ctx.fillText(this.nameText || "Baby", 600, 564);
    }

    this.doneButton.draw(ctx, { icon: "✨" });
  }

  onPointerMove(x: number, y: number): void {
    this.doneButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.doneButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.doneButton.handlePointerUp(x, y);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.opts.milestone.newBabyId) {
      if (event.key === "Enter" || event.key === "Escape") {
        this.finish();
      }
      return;
    }

    if (event.key === "Enter") {
      this.finish();
      return;
    }

    if (event.key === "Backspace") {
      this.nameText = this.nameText.slice(0, -1);
      return;
    }

    if (event.key.length === 1 && /^[a-zA-Z ]$/.test(event.key) && this.nameText.length < 10) {
      this.nameText += event.key;
    }
  }

  private finish(): void {
    if (this.opts.milestone.newBabyId && this.nameText.trim()) {
      renamePerson(this.opts.save, this.opts.milestone.newBabyId, this.nameText.trim());
    }
    this.opts.onDone();
  }
}
