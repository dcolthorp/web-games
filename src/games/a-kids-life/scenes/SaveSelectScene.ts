import { SIMPLE_FONT } from "../constants";
import { drawPortraitChip } from "../graphics/draw";
import { SaveStore } from "../model/storage";
import type { SaveSummary } from "../model/types";
import { Button } from "../ui/Button";
import type { Scene } from "../app/Scene";

type SaveCard = {
  summary: SaveSummary;
  play: Button;
  rename: Button;
  delete: Button;
};

export class SaveSelectScene implements Scene {
  private summaries: SaveSummary[];
  private cards: SaveCard[] = [];
  private newButton: Button;
  private renameId: string | null = null;
  private renameText = "";
  private saveRenameButton: Button;
  private cancelRenameButton: Button;

  constructor(
    private readonly opts: {
      store: SaveStore;
      onPlay: (id: string) => void;
      onNewSave: () => void;
      onDelete: (id: string) => void;
      onRename: (id: string, title: string) => void;
    }
  ) {
    this.summaries = opts.store.listSummaries();
    this.newButton = new Button(930, 642, 220, 76, "New Save", "mint", () => opts.onNewSave());
    this.saveRenameButton = new Button(660, 536, 150, 62, "Save", "pink", () => this.commitRename());
    this.cancelRenameButton = new Button(494, 536, 150, 62, "Back", "cream", () => this.cancelRename());
    this.buildCards();
  }

  private buildCards(): void {
    this.cards = this.summaries.map((summary, index) => {
      const x = 74 + (index % 2) * 542;
      const y = 150 + Math.floor(index / 2) * 214;
      return {
        summary,
        play: new Button(x + 26, y + 126, 156, 58, "Play", "pink", () => this.opts.onPlay(summary.id)),
        rename: new Button(x + 194, y + 126, 126, 58, "Rename", "sky", () => this.startRename(summary)),
        delete: new Button(x + 332, y + 126, 126, 58, "Delete", "cream", () => this.opts.onDelete(summary.id)),
      };
    });
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fff5ef";
    ctx.fillRect(0, 0, 1200, 760);

    ctx.fillStyle = "#6a5163";
    ctx.textAlign = "left";
    ctx.font = `800 54px ${SIMPLE_FONT}`;
    ctx.fillText("A Kid's Life", 74, 82);
    ctx.font = `700 22px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.76;
    ctx.fillText("Pick a family.", 74, 112);
    ctx.globalAlpha = 1;

    if (this.renameId) {
      this.drawRenamePanel(ctx);
      return;
    }

    for (const card of this.cards) {
      this.drawCard(ctx, card);
    }

    this.newButton.draw(ctx, { icon: "✨" });
  }

  private drawCard(ctx: CanvasRenderingContext2D, card: SaveCard): void {
    const save = this.opts.store.loadSave(card.summary.id);
    const active = save?.people[save.activePersonId];
    const people = save ? Object.values(save.people).slice(0, 3) : [];

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.strokeStyle = "#d2b0b9";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(card.play.x - 26, card.play.y - 94, 474, 188, 30);
    ctx.fill();
    ctx.stroke();

    for (let index = 0; index < people.length; index += 1) {
      const person = people[index];
      if (!person) {
        continue;
      }
      drawPortraitChip(ctx, person, card.play.x + 50 + index * 64, card.play.y - 34, 56, person.id === active?.id);
    }

    ctx.fillStyle = "#674b5d";
    ctx.textAlign = "left";
    ctx.font = `800 30px ${SIMPLE_FONT}`;
    ctx.fillText(card.summary.title, card.play.x + 200, card.play.y - 46);
    ctx.font = `700 20px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.76;
    ctx.fillText(`Gen ${card.summary.currentGeneration}`, card.play.x + 200, card.play.y - 16);
    ctx.fillText(active?.name ?? card.summary.activeChildName, card.play.x + 286, card.play.y - 16);
    ctx.globalAlpha = 1;

    card.play.draw(ctx, { icon: "▶" });
    card.rename.draw(ctx);
    card.delete.draw(ctx);
  }

  private drawRenamePanel(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(96,67,84,0.18)";
    ctx.fillRect(0, 0, 1200, 760);
    ctx.fillStyle = "#fff7ef";
    ctx.strokeStyle = "#c89db0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(390, 208, 420, 400, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6a5163";
    ctx.textAlign = "center";
    ctx.font = `800 42px ${SIMPLE_FONT}`;
    ctx.fillText("Rename", 600, 282);
    ctx.font = `700 20px ${SIMPLE_FONT}`;
    ctx.globalAlpha = 0.76;
    ctx.fillText("Type a home name.", 600, 318);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#c9afbb";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(452, 360, 296, 92, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#7a5f70";
    ctx.font = `800 34px ${SIMPLE_FONT}`;
    ctx.fillText(this.renameText || "HOME", 600, 414);

    this.cancelRenameButton.draw(ctx);
    this.saveRenameButton.draw(ctx);
  }

  onPointerMove(x: number, y: number): void {
    if (this.renameId) {
      this.cancelRenameButton.handlePointerMove(x, y);
      this.saveRenameButton.handlePointerMove(x, y);
      return;
    }

    this.newButton.handlePointerMove(x, y);
    for (const card of this.cards) {
      card.play.handlePointerMove(x, y);
      card.rename.handlePointerMove(x, y);
      card.delete.handlePointerMove(x, y);
    }
  }

  onPointerDown(x: number, y: number): void {
    if (this.renameId) {
      this.cancelRenameButton.handlePointerDown(x, y);
      this.saveRenameButton.handlePointerDown(x, y);
      return;
    }

    this.newButton.handlePointerDown(x, y);
    for (const card of this.cards) {
      card.play.handlePointerDown(x, y);
      card.rename.handlePointerDown(x, y);
      card.delete.handlePointerDown(x, y);
    }
  }

  onPointerUp(x: number, y: number): void {
    if (this.renameId) {
      this.cancelRenameButton.handlePointerUp(x, y);
      this.saveRenameButton.handlePointerUp(x, y);
      return;
    }

    this.newButton.handlePointerUp(x, y);
    for (const card of this.cards) {
      card.play.handlePointerUp(x, y);
      card.rename.handlePointerUp(x, y);
      card.delete.handlePointerUp(x, y);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.renameId) {
      return;
    }

    if (event.key === "Escape") {
      this.cancelRename();
      return;
    }

    if (event.key === "Enter") {
      this.commitRename();
      return;
    }

    if (event.key === "Backspace") {
      this.renameText = this.renameText.slice(0, -1);
      return;
    }

    if (event.key.length === 1 && this.renameText.length < 14 && /^[a-zA-Z0-9 ]$/.test(event.key)) {
      this.renameText += event.key;
    }
  }

  private startRename(summary: SaveSummary): void {
    this.renameId = summary.id;
    this.renameText = summary.title;
  }

  private cancelRename(): void {
    this.renameId = null;
    this.renameText = "";
  }

  private commitRename(): void {
    if (!this.renameId) {
      return;
    }

    this.opts.onRename(this.renameId, this.renameText.trim() || "Happy Home");
  }
}
