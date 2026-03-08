import { Input } from "./Input";
import { Renderer } from "./Renderer";
import type { Scene } from "./Scene";
import { ProfileStore } from "../model/ProfileStore";
import { MonsterIndexStore } from "../model/MonsterIndexStore";
import { NORMAL_STAGE_ORDER, type Profile, type PlayOutcome, type GrowthStage } from "../model/types";
import { isMillionaireMode, setCurrentTheme } from "../systems/theme";
import { applyOfflineCatchup } from "../systems/metabolism";
import { ProfileSelectScene } from "../scenes/ProfileSelectScene";
import { MainGameScene } from "../scenes/MainGameScene";
import { FeedingMenuScene } from "../scenes/FeedingMenuScene";
import { DentalCareScene } from "../scenes/DentalCareScene";
import { PlayMenuScene } from "../scenes/PlayMenuScene";
import { PlayActivityScene } from "../scenes/PlayActivityScene";
import { BandAidScene } from "../scenes/BandAidScene";
import { DoctorVisitScene } from "../scenes/DoctorVisitScene";
import { DentistVisitScene } from "../scenes/DentistVisitScene";
import { ResetConfirmScene } from "../scenes/ResetConfirmScene";
import { ProfileSettingsScene } from "../scenes/ProfileSettingsScene";
import { DeleteConfirmScene } from "../scenes/DeleteConfirmScene";
import { MonsterIndexScene } from "../scenes/MonsterIndexScene";
import { LeschatScene } from "../scenes/LeschatScene";

type GameState =
  | "profile_select"
  | "main_game"
  | "feeding"
  | "dental_care"
  | "play_menu"
  | "play_activity"
  | "band_aid"
  | "doctor_visit"
  | "dentist_visit"
  | "reset_confirm"
  | "profile_settings"
  | "delete_confirm"
  | "monster_index"
  | "leschat_chat";

export class GameApp {
  private readonly renderer: Renderer;
  private readonly input: Input;
  private isRunning = false;
  private lastTsMs = 0;

  private profileStore = new ProfileStore();
  private monsterIndexStore = new MonsterIndexStore();
  private currentProfile: Profile | null = null;

  private state: GameState = "profile_select";
  private profileSelectScene: ProfileSelectScene;
  private mainGameScene: MainGameScene | null = null;
  private feedingScene: FeedingMenuScene | null = null;
  private dentalScene: DentalCareScene | null = null;
  private playMenuScene: PlayMenuScene | null = null;
  private playActivityScene: PlayActivityScene | null = null;
  private bandAidScene: BandAidScene | null = null;
  private doctorScene: DoctorVisitScene | null = null;
  private dentistScene: DentistVisitScene | null = null;
  private resetConfirmScene: ResetConfirmScene | null = null;
  private profileSettingsScene: ProfileSettingsScene | null = null;
  private deleteConfirmScene: DeleteConfirmScene | null = null;
  private monsterIndexScene: MonsterIndexScene | null = null;
  private leschatScene: LeschatScene | null = null;
  private preIndexState: GameState | null = null;
  private settingsProfile: Profile | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(this.renderer);

    this.profileSelectScene = new ProfileSelectScene({
      profileStore: this.profileStore,
      onProfileSelected: (profile) => this.onProfileSelected(profile),
      onOpenSettings: (profile) => this.onOpenProfileSettings(profile),
    });

    this.input.bind({
      onMove: (x, y) => this.getActiveInputScene()?.onPointerMove?.(x, y),
      onDown: (x, y) => this.getActiveInputScene()?.onPointerDown?.(x, y),
      onUp: (x, y) => this.getActiveInputScene()?.onPointerUp?.(x, y),
      onKeyDown: (e) => this.handleKeyDown(e),
    });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTsMs = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.isRunning = false;
    this.input.dispose();
  }

  private getActiveInputScene(): Scene | null {
    switch (this.state) {
      case "profile_select":
        return this.profileSelectScene;
      case "main_game":
        return this.mainGameScene;
      case "feeding":
        return this.feedingScene;
      case "dental_care":
        return this.dentalScene;
      case "play_menu":
        return this.playMenuScene;
      case "play_activity":
        return this.playActivityScene;
      case "band_aid":
        return this.bandAidScene;
      case "doctor_visit":
        return this.doctorScene;
      case "dentist_visit":
        return this.dentistScene;
      case "reset_confirm":
        return this.resetConfirmScene;
      case "profile_settings":
        return this.profileSettingsScene;
      case "delete_confirm":
        return this.deleteConfirmScene;
      case "monster_index":
        return this.monsterIndexScene;
      case "leschat_chat":
        return this.leschatScene;
      default:
        return null;
    }
  }

  private onProfileSelected(profile: Profile): void {
    this.currentProfile = profile;
    setCurrentTheme(profile.colorTheme);
    applyOfflineCatchup(profile.pet);
    this.profileStore.saveProfile(profile);
    this.mainGameScene = new MainGameScene({
      profile,
      profileStore: this.profileStore,
      monsterIndexStore: this.monsterIndexStore,
      onSwitchProfile: () => this.onSwitchProfile(),
      onOpenFeeding: () => this.openFeeding(),
      onOpenDental: () => this.openDental(),
      onOpenPlay: () => this.openPlayMenu(),
      onOpenBandAid: () => this.openBandAid(),
      onOpenDoctor: () => this.openDoctor(),
      onOpenDentist: () => this.openDentist(),
      onOpenLeschatChat: () => this.openLeschatChat(),
      leschatAwakened: this.profileStore.isLeschatAwakened(),
    });
    this.state = "main_game";
  }

  private onSwitchProfile(): void {
    this.profileSelectScene.refreshProfiles();
    this.mainGameScene = null;
    this.leschatScene = null;
    this.currentProfile = null;
    this.state = "profile_select";
  }

  private openFeeding(): void {
    if (!this.mainGameScene) return;
    this.feedingScene = new FeedingMenuScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onFoodSelected: (foodId) => this.mainGameScene?.feedPet(foodId),
      onClose: () => this.closeOverlay(),
    });
    this.state = "feeding";
  }

  private openDental(): void {
    if (!this.mainGameScene) return;
    this.dentalScene = new DentalCareScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onBrushComplete: () => this.mainGameScene?.brushTeeth(),
      onClose: () => this.closeOverlay(),
    });
    this.state = "dental_care";
  }

  private openPlayMenu(): void {
    if (!this.mainGameScene) return;
    this.playMenuScene = new PlayMenuScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onActivitySelected: (activityId) => this.openPlayActivity(activityId),
      onClose: () => this.closeOverlay(),
    });
    this.state = "play_menu";
  }

  private openPlayActivity(activityId: string): void {
    if (!this.mainGameScene) return;
    this.playActivityScene = new PlayActivityScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      activityId,
      onComplete: (outcome: PlayOutcome) => this.onPlayComplete(outcome),
    });
    this.playMenuScene = null;
    this.state = "play_activity";
  }

  private onPlayComplete(outcome: PlayOutcome): void {
    this.mainGameScene?.handlePlayOutcome(outcome);
    this.playActivityScene = null;
    this.state = "main_game";
  }

  private openBandAid(): void {
    if (!this.mainGameScene) return;
    this.bandAidScene = new BandAidScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onComplete: () => this.onBandAidComplete(),
    });
    this.state = "band_aid";
  }

  private onBandAidComplete(): void {
    this.mainGameScene?.applyBandAid();
    this.bandAidScene = null;
    this.state = "main_game";
  }

  private openDoctor(): void {
    if (!this.mainGameScene) return;
    this.doctorScene = new DoctorVisitScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onComplete: () => this.onDoctorComplete(),
    });
    this.state = "doctor_visit";
  }

  private onDoctorComplete(): void {
    this.mainGameScene?.completeDoctorVisit();
    this.doctorScene = null;
    this.state = "main_game";
  }

  private openDentist(): void {
    if (!this.mainGameScene) return;
    this.dentistScene = new DentistVisitScene({
      stage: this.currentProfile?.pet.stage ?? "baby",
      theme: this.currentProfile?.colorTheme ?? "blue",
      onComplete: () => this.onDentistComplete(),
    });
    this.state = "dentist_visit";
  }

  private onDentistComplete(): void {
    this.mainGameScene?.completeDentistVisit();
    this.dentistScene = null;
    this.state = "main_game";
  }

  private closeOverlay(): void {
    this.feedingScene = null;
    this.dentalScene = null;
    this.playMenuScene = null;
    this.playActivityScene = null;
    this.bandAidScene = null;
    this.doctorScene = null;
    this.dentistScene = null;
    this.leschatScene = null;
    this.resetConfirmScene = null;
    this.state = "main_game";
  }

  private openLeschatChat(): void {
    if (!this.currentProfile) return;
    this.leschatScene = new LeschatScene({
      stage: this.currentProfile.pet.stage,
      theme: this.currentProfile.colorTheme,
      onClose: () => this.closeLeschatChat(),
    });
    this.state = "leschat_chat";
  }

  private closeLeschatChat(): void {
    this.leschatScene = null;
    this.state = "main_game";
  }

  private onOpenProfileSettings(profile: Profile): void {
    this.settingsProfile = profile;
    this.profileSettingsScene = new ProfileSettingsScene({
      stage: profile.pet.stage,
      profileName: profile.name,
      onReset: () => this.onProfileResetSelected(),
      onDelete: () => this.onProfileDeleteSelected(),
      onCancel: () => this.onCloseProfileSettings(),
    });
    this.state = "profile_settings";
  }

  private onCloseProfileSettings(): void {
    this.profileSettingsScene = null;
    this.deleteConfirmScene = null;
    this.resetConfirmScene = null;
    this.settingsProfile = null;
    this.state = "profile_select";
  }

  private onProfileResetSelected(): void {
    if (!this.settingsProfile) return;
    this.resetConfirmScene = new ResetConfirmScene({
      stage: this.settingsProfile.pet.stage,
      profileName: this.settingsProfile.name,
      onConfirm: () => this.onResetConfirm(),
      onCancel: () => this.onBackToSettings(),
    });
    this.profileSettingsScene = null;
    this.state = "reset_confirm";
  }

  private onProfileDeleteSelected(): void {
    if (!this.settingsProfile) return;
    this.deleteConfirmScene = new DeleteConfirmScene({
      stage: this.settingsProfile.pet.stage,
      profileName: this.settingsProfile.name,
      onConfirm: () => this.onDeleteConfirm(),
      onCancel: () => this.onBackToSettings(),
    });
    this.profileSettingsScene = null;
    this.state = "delete_confirm";
  }

  private onBackToSettings(): void {
    if (!this.settingsProfile) return;
    this.profileSettingsScene = new ProfileSettingsScene({
      stage: this.settingsProfile.pet.stage,
      profileName: this.settingsProfile.name,
      onReset: () => this.onProfileResetSelected(),
      onDelete: () => this.onProfileDeleteSelected(),
      onCancel: () => this.onCloseProfileSettings(),
    });
    this.resetConfirmScene = null;
    this.deleteConfirmScene = null;
    this.state = "profile_settings";
  }

  private onResetConfirm(): void {
    if (!this.settingsProfile) return;
    this.settingsProfile.pet.stage = "egg";
    this.settingsProfile.pet.hunger = 50;
    this.settingsProfile.pet.dentalHealth = 100;
    this.settingsProfile.pet.carePoints = 0;
    this.settingsProfile.pet.hatchProgress = 0;
    this.settingsProfile.pet.condition = "none";
    this.profileStore.saveProfile(this.settingsProfile);
    this.settingsProfile = null;
    this.profileSelectScene.refreshProfiles();
    this.state = "profile_select";
  }

  private onDeleteConfirm(): void {
    if (!this.settingsProfile) return;
    this.profileStore.deleteProfile(this.settingsProfile.id);
    this.settingsProfile = null;
    this.profileSelectScene.refreshProfiles();
    this.state = "profile_select";
  }

  private openMonsterIndex(): void {
    if (!this.currentProfile) return;
    this.preIndexState = this.state;
    this.monsterIndexScene = new MonsterIndexScene({
      store: this.monsterIndexStore,
      theme: this.currentProfile.colorTheme,
      onClose: () => this.closeMonsterIndex(),
      onTeleport: (stage: GrowthStage) => this.onMonsterTeleport(stage),
    });
    this.state = "monster_index";
  }

  private onMonsterTeleport(stage: GrowthStage): void {
    if (!this.currentProfile) return;
    if (isMillionaireMode(this.currentProfile.colorTheme) && !NORMAL_STAGE_ORDER.includes(stage)) return;
    this.currentProfile.pet.stage = stage;
    this.mainGameScene?.syncStage();
    this.profileStore.saveProfile(this.currentProfile);
  }

  private closeMonsterIndex(): void {
    this.state = this.preIndexState ?? "profile_select";
    this.monsterIndexScene = null;
    this.preIndexState = null;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key.toLowerCase() === "i") {
      if (
        (this.state === "profile_select" && !this.profileSelectScene.isCreatingProfile()) ||
        this.state === "main_game"
      ) {
        this.openMonsterIndex();
        return;
      }
    }
    this.getActiveInputScene()?.onKeyDown?.(e);
  }

  private tick = (tsMs: number): void => {
    if (!this.isRunning) return;
    const dtSeconds = Math.min(0.05, Math.max(0, (tsMs - this.lastTsMs) / 1000));
    this.lastTsMs = tsMs;

    this.update(dtSeconds);

    this.renderer.clear("#000");
    this.renderer.beginLogical();
    this.render(this.renderer.ctx);

    requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    switch (this.state) {
      case "profile_select":
        this.profileSelectScene.update(dt);
        break;
      case "main_game":
        this.mainGameScene?.update(dt);
        break;
      case "feeding":
        this.feedingScene?.update(dt);
        break;
      case "dental_care":
        this.dentalScene?.update(dt);
        break;
      case "play_menu":
        this.playMenuScene?.update(dt);
        break;
      case "play_activity":
        this.playActivityScene?.update(dt);
        break;
      case "band_aid":
        this.bandAidScene?.update(dt);
        break;
      case "doctor_visit":
        this.doctorScene?.update(dt);
        break;
      case "dentist_visit":
        this.dentistScene?.update(dt);
        break;
      case "reset_confirm":
        this.resetConfirmScene?.update(dt);
        break;
      case "profile_settings":
        this.profileSettingsScene?.update(dt);
        break;
      case "delete_confirm":
        this.deleteConfirmScene?.update(dt);
        break;
      case "monster_index":
        this.monsterIndexScene?.update(dt);
        break;
      case "leschat_chat":
        this.leschatScene?.update(dt);
        break;
      default:
        break;
    }
  }

  private render(ctx: CanvasRenderingContext2D): void {
    switch (this.state) {
      case "profile_select":
        this.profileSelectScene.render(ctx);
        break;
      case "main_game":
        this.mainGameScene?.render(ctx);
        break;
      case "feeding":
        this.mainGameScene?.render(ctx);
        this.feedingScene?.render(ctx);
        break;
      case "play_menu":
        this.mainGameScene?.render(ctx);
        this.playMenuScene?.render(ctx);
        break;
      case "dental_care":
        this.dentalScene?.render(ctx);
        break;
      case "play_activity":
        this.playActivityScene?.render(ctx);
        break;
      case "band_aid":
        this.bandAidScene?.render(ctx);
        break;
      case "doctor_visit":
        this.doctorScene?.render(ctx);
        break;
      case "dentist_visit":
        this.dentistScene?.render(ctx);
        break;
      case "reset_confirm":
        this.profileSelectScene.render(ctx);
        this.resetConfirmScene?.render(ctx);
        break;
      case "profile_settings":
        this.profileSelectScene.render(ctx);
        this.profileSettingsScene?.render(ctx);
        break;
      case "delete_confirm":
        this.profileSelectScene.render(ctx);
        this.deleteConfirmScene?.render(ctx);
        break;
      case "monster_index":
        this.monsterIndexScene?.render(ctx);
        break;
      case "leschat_chat":
        this.mainGameScene?.render(ctx);
        this.leschatScene?.render(ctx);
        break;
      default:
        break;
    }
  }
}
