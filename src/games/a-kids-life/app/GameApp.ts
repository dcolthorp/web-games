import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../constants";
import { SaveStore } from "../model/storage";
import type { ActivityId, FamilySave, Milestone } from "../model/types";
import { applyOfflineCatchup, applyNeedDecay } from "../systems/needs";
import { ActivityScene } from "../scenes/ActivityScene";
import { FamilyScene } from "../scenes/FamilyScene";
import { HomeScene } from "../scenes/HomeScene";
import { MilestoneScene } from "../scenes/MilestoneScene";
import { NewSaveScene } from "../scenes/NewSaveScene";
import { SaveSelectScene } from "../scenes/SaveSelectScene";
import { Input } from "./Input";
import { Renderer } from "./Renderer";
import type { Scene } from "./Scene";

type GameMode = "save-select" | "new-save" | "home" | "activity" | "family" | "milestone";

export class GameApp {
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly store = new SaveStore();

  private currentScene: Scene | null = null;
  private currentSave: FamilySave | null = null;
  private mode: GameMode = "save-select";
  private lastTs = 0;
  private lastAutoSave = 0;
  private activityScene: ActivityScene | null = null;
  private milestoneScene: MilestoneScene | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(this.renderer, canvas);
    this.input.bind({
      onMove: (x, y) => this.currentScene?.onPointerMove?.(x, y),
      onDown: (x, y) => this.currentScene?.onPointerDown?.(x, y),
      onUp: (x, y) => this.currentScene?.onPointerUp?.(x, y),
      onKeyDown: (event) => this.currentScene?.onKeyDown?.(event),
    });

    this.openSaveSelect();
  }

  start(): void {
    this.lastTs = performance.now();
    requestAnimationFrame(this.tick);
  }

  markRandomPersonMissingFromRandomFamily(): boolean {
    const saves = this.store
      .listSummaries()
      .map((summary) => this.store.loadSave(summary.id))
      .filter((save): save is FamilySave => Boolean(save));

    if (saves.length === 0) {
      return false;
    }

    const savesWithMissingCandidates = saves.filter((save) =>
      Object.values(save.people).some((person) => !person.isMissing)
    );

    if (savesWithMissingCandidates.length === 0) {
      return true;
    }

    const pickedSave = savesWithMissingCandidates[Math.floor(Math.random() * savesWithMissingCandidates.length)];
    if (!pickedSave) {
      return false;
    }

    const saveToUpdate = this.currentSave?.id === pickedSave.id ? this.currentSave : pickedSave;
    const candidates = Object.values(saveToUpdate.people).filter((person) => !person.isMissing);
    const pickedPerson = candidates[Math.floor(Math.random() * candidates.length)];
    if (!pickedPerson) {
      return false;
    }

    pickedPerson.isMissing = true;
    this.store.save(saveToUpdate);
    return saves.every((save) => Object.values(save.people).every((person) => person.isMissing));
  }

  private tick = (ts: number): void => {
    const dtSeconds = Math.min(1 / 15, (ts - this.lastTs) / 1000);
    this.lastTs = ts;

    if (this.currentSave && this.mode !== "save-select" && this.mode !== "new-save") {
      for (const person of Object.values(this.currentSave.people)) {
        applyNeedDecay(person, dtSeconds * 0.28);
      }
      this.lastAutoSave += dtSeconds;
      if (this.lastAutoSave >= 3) {
        this.store.save(this.currentSave);
        this.lastAutoSave = 0;
      }
    }

    this.currentScene?.update(dtSeconds);

    this.renderer.clear("#f1d5cf");
    this.renderer.begin();
    const ctx = this.renderer.ctx;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.currentScene?.render(ctx);

    requestAnimationFrame(this.tick);
  };

  private openSaveSelect(): void {
    this.mode = "save-select";
    this.currentScene = new SaveSelectScene({
      store: this.store,
      onPlay: (id) => this.playSave(id),
      onNewSave: () => this.openNewSave(),
      onDelete: (id) => {
        this.store.deleteSave(id);
        this.openSaveSelect();
      },
      onRename: (id, title) => {
        this.store.renameSave(id, title);
        this.openSaveSelect();
      },
    });
  }

  private openNewSave(): void {
    this.mode = "new-save";
    this.currentScene = new NewSaveScene({
      store: this.store,
      onCancel: () => this.openSaveSelect(),
      onCreate: (save) => {
        this.currentSave = save;
        this.openHome();
      },
    });
  }

  private playSave(id: string): void {
    const save = this.store.loadSave(id);
    if (!save) {
      this.openSaveSelect();
      return;
    }

    applyOfflineCatchup(save);
    this.currentSave = save;
    this.openHome();
  }

  private openHome(): void {
    if (!this.currentSave) {
      this.openSaveSelect();
      return;
    }

    this.mode = "home";
    this.currentScene = new HomeScene({
      save: this.currentSave,
      onOpenActivity: (id) => this.openActivity(id),
      onOpenFamily: () => this.openFamily(),
      onOpenSaveSelect: () => {
        if (this.currentSave) {
          this.store.save(this.currentSave);
        }
        this.openSaveSelect();
      },
      onOpenRoom: () => {
        if (this.currentSave) {
          const order: FamilySave["homeStyle"][] = ["sunny", "peach", "mint"];
          const index = order.indexOf(this.currentSave.homeStyle);
          this.currentSave.homeStyle = order[(index + 1) % order.length] ?? "sunny";
          this.store.save(this.currentSave);
        }
      },
    });
  }

  private openActivity(activityId: ActivityId): void {
    if (!this.currentSave) {
      return;
    }

    this.mode = "activity";
    this.activityScene = new ActivityScene({
      save: this.currentSave,
      activityId,
      onDone: (milestone) => this.finishActivity(milestone),
      onCancel: () => this.openHome(),
    });
    this.currentScene = this.activityScene;
  }

  private finishActivity(milestone: Milestone | null): void {
    if (!this.currentSave) {
      this.openSaveSelect();
      return;
    }

    this.store.save(this.currentSave);

    if (milestone) {
      this.openMilestone(milestone);
      return;
    }

    this.openHome();
  }

  private openFamily(): void {
    if (!this.currentSave) {
      return;
    }

    this.mode = "family";
    this.currentScene = new FamilyScene({
      save: this.currentSave,
      onBack: () => this.openHome(),
      onPick: (personId) => {
        if (!this.currentSave) {
          return;
        }
        this.currentSave.activePersonId = personId;
        this.store.save(this.currentSave);
        this.openHome();
      },
    });
  }

  private openMilestone(milestone: Milestone): void {
    if (!this.currentSave) {
      return;
    }

    this.mode = "milestone";
    this.milestoneScene = new MilestoneScene({
      save: this.currentSave,
      milestone,
      onDone: () => {
        if (this.currentSave) {
          this.store.save(this.currentSave);
        }
        this.openHome();
      },
    });
    this.currentScene = this.milestoneScene;
  }
}
