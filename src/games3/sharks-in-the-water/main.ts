import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { NIGHTMARE_TOAST_KEY, TOAST_ON_GAMES3_KEY } from "../../shared/glitchedToast";
import { Peer, type DataConnection } from "peerjs";
import recoveredSaveOne from "./recovered-save-1.json";

installOofShortcut();
installForceRefreshHotkey();

type Direction = "up" | "down" | "left" | "right";
type GameMode = "ready" | "playing" | "paused" | "gameOver";
type CrateKind = "supply" | "wooden" | "technology" | "blood" | "rainbow" | "super" | "hacker";
type GameKind = "survival" | "creative";
// Hacker saves keep an effective GameKind so every existing creative/survival
// check keeps working; isHacker just adds the owner-only toolkit on top.
type SaveKind = GameKind | "hacker";
type HackerTool = "none" | "copy" | "delete" | "gui";

interface MaterialDrop {
  name: string;
  amount: number;
  color: string;
}

interface FloatingCrate {
  x: number;
  y: number;
  kind: CrateKind;
  material?: MaterialDrop;
  landedAt: number;
  bobOffset: number;
  deliveredByCargoShip?: boolean;
}

interface CargoShip {
  x: number;
  y: number;
  state: "docked" | "collecting" | "returning";
  target: FloatingCrate | null;
  cargo: FloatingCrate | null;
  bobOffset: number;
}

interface CollectorDrop {
  x: number;
  y: number;
  healing: 1 | 99;
  count: number;
  source: "coconut" | "blood-orange" | "cow" | "sheep";
  onCompartment: boolean;
}

interface CollectorBot {
  x: number;
  y: number;
  state: "idle" | "outbound" | "harvesting" | "returning";
  targetIslandIndex: number;
  waypoints: Array<{ x: number; y: number }>;
  waypointIndex: number;
  cargo: { healing: 1 | 99; count: number; source: CollectorDrop["source"] } | null;
  harvestUntil: number;
  stepOffset: number;
}

interface SharkEntity {
  x: number;
  y: number;
  angle: number;
  biteCooldownUntil: number;
}

interface SunkenRaft {
  x: number;
  y: number;
  width: number;
  height: number;
  raisedAt: number;
  bridgeBuilt: boolean;
  bridgeSourceKind?: "main" | "raft" | "island";
  bridgeSourceIndex?: number;
  bobOffset: number;
}

interface TimeSnapshot {
  elapsed: number;
  playerX: number;
  playerY: number;
  hearts: number;
  raftLevel: number;
  expansionCount: number;
  endgameUnlocked: boolean;
  bridgesBuilt: number;
  sunkenRafts: SunkenRaft[];
  crates: FloatingCrate[];
  carriedCrates: FloatingCrate[];
  shark: SharkEntity;
  extraSharks: SharkEntity[];
  nextSupplyAt: number;
  nextRandomAt: number;
}

interface PastSelfEcho {
  path: Array<{ time: number; x: number; y: number }>;
  fallbackX: number;
  fallbackY: number;
  expiresAt: number;
}

interface MultiplayerMessage {
  room: string;
  sender: string;
  player: 1 | 2;
  type: "join" | "welcome" | "position" | "state" | "notice" | "start" | "world" | "take";
  payload?: unknown;
}

interface RemotePlayerState {
  x: number;
  y: number;
  player: 1 | 2;
  updatedAt: number;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Island {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  name: string;
  kind: "coconut" | "cow" | "sheep";
  requiredExpansions: number;
}

interface SaveData {
  version: 1;
  saveFileName?: string;
  raftName?: string;
  gameKind: GameKind;
  isHacker?: boolean;
  sharkDeleted?: boolean;
  homeRaftDeleted?: boolean;
  shopkeeperDeleted?: boolean;
  hudDeleted?: boolean;
  oceanDeleted?: boolean;
  playerDeleted?: boolean;
  deletedIslands?: number[];
  deletedGuiSelectors?: string[];
  elapsed: number;
  nextSupplyIn: number;
  nextRandomIn: number;
  progressionIndex: number;
  crates: FloatingCrate[];
  carriedCrates: FloatingCrate[];
  inventory: [string, number][];
  foodHealing: number[];
  hearts: number;
  hasCraftingTable: boolean;
  craftingTableLevel: number;
  hasCargoDock: boolean;
  cargoShipCount: number;
  cargoShipCargo: FloatingCrate[];
  hasScoldBot: boolean;
  hasSuperScoldBot: boolean;
  nextScoldIn: number;
  hasStorageCompartment: boolean;
  collectorBotCount: number;
  collectorBots: CollectorBot[];
  collectorDrops: CollectorDrop[];
  nextCollectorRunIn: number;
  raftLevel: number;
  expansionCount: number;
  endgameUnlocked: boolean;
  bridgesBuilt: number;
  coconutReadyIn: number[];
  playerX: number;
  playerY: number;
  sharkX: number;
  sharkY: number;
  sharkAngle: number;
  hasHuntingSpear: boolean;
  spearDurability: number;
  animalReadyIn: number[];
  chestCount: number;
  chestInventory: [string, number][];
  chestFoodHealing: number[];
  sharkFleeIn: number;
  maxHearts: number;
  nextShopkeeperIn: number;
  shopkeeperRemaining: number;
  hasFishingRod: boolean;
  hasFisherBot?: boolean;
  nextAutoFishIn?: number;
  fisherBotCatches?: string[];
  hasTimeWarper: boolean;
  cosmicTimeYears: number;
  fishCollection: [string, number][];
  terrainGenerators: number;
  terrainLevel: number;
  sunkenRafts: SunkenRaft[];
  extraSharks: SharkEntity[];
}

interface ChangelogEntry {
  title: string;
  detail: string;
}

type NamingAction =
  | { kind: "create"; slot: number; saveKind: SaveKind }
  | { kind: "stored"; slot: number }
  | { kind: "current" };

type HackerBuild = "chest" | "crafting-table" | "storage" | "cargo-dock" | "cargo-ship" | "collector-bot" | "scold-bot" | "fisher-bot" | "time-warper";

type HackerClipboard =
  | { kind: "crate"; crate: FloatingCrate }
  | { kind: "raft"; width: number; height: number }
  | { kind: "shark" }
  | { kind: "build"; build: HackerBuild; label: string };

interface FishCatch {
  name: string;
  weight: number;
  color: string;
  description: string;
  reward: "snack" | "snacks" | "meal" | "king" | "duck" | "god" | "glitched";
}

const canvasElement = document.getElementById("game");
if (!(canvasElement instanceof HTMLCanvasElement)) throw new Error("Missing game canvas");
const canvas = canvasElement;
const context = canvas.getContext("2d");
if (!(context instanceof CanvasRenderingContext2D)) throw new Error("Missing game context");
const ctx = context;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const SUPPLY_INTERVAL = 60;
const STACK_LIMIT = 100;
const CHEST_CAPACITY = 300;
const MAX_HEARTS = 10;
const SHOPKEEPER_INTERVAL = 180;
const SHOPKEEPER_VISIT_LENGTH = 60;
const SPEAR_MAX_DURABILITY = 5;
const SHARK_EDGE_PADDING = 16;
const FISHING_ROD_COST = 12;
const TECHNO_CRAFTING_LEVEL = 12;
const MAX_CARGO_SHIPS = 6;
const MAX_COLLECTOR_BOTS = 6;
const COLLECTOR_INTERVAL = 12;
const FISHER_BOT_INTERVAL = 20;
const SCOLD_BOT_INTERVAL = 10;
const SUPER_SCOLD_BOT_INTERVAL = 7;
const RAFTS_PER_TERRAIN_GENERATOR = 3;
const MAX_SUNKEN_RAFTS = 18;
const SUNKEN_RAFT_SURVIVAL_TIME = 180;
const SUNKEN_RAFT_CREATIVE_TIME = 5;
const TIME_WARPER_ACTIVATION_COST = 10;
const TIME_HISTORY_SECONDS = 185;
const PRESENT_UNIVERSE_AGE = 13_800_000_000;
const BIG_CRUNCH_YEAR = 100_000_000_000;
const BILLION_YEARS = 1_000_000_000;
const STORAGE_COMPARTMENT_CAPACITY = 1000;
const BRIDGE_DECK_HALF_WIDTH = 34;
const BRIDGE_SAFE_HALF_WIDTH = 44;
const LEGACY_SAVE_KEY = "sharks-in-the-water-autosave-v1";
const SAVE_KEY_PREFIX = "sharks-in-the-water-save-v1-slot-";
const SAVE_BACKUP_KEY_PREFIX = "sharks-in-the-water-save-v1-backup-slot-";
const RECOVERED_SAVE_ONE_FLAG = "sharks-in-the-water-save-1-recovered-2026-08-05";
const RAFT = { x: 352, y: 218, width: 256, height: 164 };
const ISLANDS: Island[] = [
  { x: 850, y: 465, radiusX: 112, radiusY: 76, name: "COCONUT CAY", kind: "coconut", requiredExpansions: 3 },
  { x: 845, y: 170, radiusX: 104, radiusY: 70, name: "PALM POINT", kind: "coconut", requiredExpansions: 3 },
  { x: 112, y: 455, radiusX: 100, radiusY: 70, name: "COW PASTURE", kind: "cow", requiredExpansions: 4 },
  { x: 115, y: 165, radiusX: 96, radiusY: 66, name: "SHEEP SHORE", kind: "sheep", requiredExpansions: 4 },
];
const materialProgression: MaterialDrop[] = [
  { name: "Wood", amount: 8, color: "#b8793d" },
  { name: "Stone", amount: 7, color: "#9da4a7" },
  { name: "Iron", amount: 6, color: "#c4d1d4" },
  { name: "Steel", amount: 5, color: "#8098a5" },
  { name: "Gold", amount: 4, color: "#ffd84e" },
  { name: "Crystal", amount: 4, color: "#73f3ff" },
  { name: "Diamond", amount: 3, color: "#b9ffff" },
  { name: "Plasma", amount: 3, color: "#e878ff" },
  { name: "Star Material", amount: 2, color: "#fff3a1" },
  { name: "God Material", amount: 1, color: "#ffffff" },
];
const endlessMaterials: MaterialDrop[] = [
  ...materialProgression,
  { name: "Infernal Material", amount: 2, color: "#ff5738" },
];
const endlessMaterialWeights = [24, 20, 16, 13, 10, 8, 6, 5, 4, 2, 1];
const craftingTableUpgradeMaterials = [
  "Stone",
  "Iron",
  "Steel",
  "Gold",
  "Crystal",
  "Diamond",
  "Plasma",
  "Star Material",
  "God Material",
  "Infernal Material",
  "Technology Shards",
] as const;
const fishCatches: FishCatch[] = [
  { name: "Common Cod", weight: 40, color: "#a9c6cf", description: "So ordinary that it files taxes early just for excitement.", reward: "snack" },
  { name: "Tiny Sardine", weight: 34, color: "#b5d1da", description: "Small fish, enormous confidence, absolutely no indoor voice.", reward: "snack" },
  { name: "Blue Mackerel", weight: 20, color: "#6fb5d4", description: "Blue because it remembered tomorrow is Monday.", reward: "snacks" },
  { name: "Tuna", weight: 18, color: "#668da3", description: "Believes every conversation should be about sandwiches.", reward: "snacks" },
  { name: "Clownfish", weight: 16, color: "#ff9851", description: "Tells the same reef joke every night. The coral still laughs.", reward: "snacks" },
  { name: "Pufferfish", weight: 12, color: "#e7c66d", description: "Ninety percent puff, ten percent deeply offended.", reward: "snacks" },
  { name: "Goldfish", weight: 15, color: "#ffd34f", description: "Forgot why it was caught before it reached the raft.", reward: "snacks" },
  { name: "Diamondfish", weight: 10, color: "#a9ffff", description: "Extremely shiny and legally required to wear sunglasses.", reward: "meal" },
  { name: "Swordfish", weight: 8, color: "#93c5da", description: "Brought a sword to a fishing-rod fight and somehow lost.", reward: "meal" },
  { name: "Anglerfish", weight: 7, color: "#71838e", description: "Its headlamp is bright. Its ideas are still a little dim.", reward: "meal" },
  { name: "Jellyfish", weight: 6, color: "#ef9cff", description: "Not actually a fish, but neither is the duck, so here we are.", reward: "snacks" },
  { name: "Old Boot", weight: 6, color: "#8b654b", description: "The rare left-footed bootfish. Smells like adventure and socks.", reward: "snack" },
  { name: "Kingfish", weight: 6, color: "#caa7ff", description: "Its crown is waterproof. Its royal speeches are not.", reward: "king" },
  { name: "Rubber Duck", weight: 5, color: "#ffe84f", description: "Insists it is a fish. Nobody has won the argument yet.", reward: "duck" },
  { name: "Pirate Fish", weight: 5, color: "#dc6f64", description: "Buried its treasure, then forgot that the ocean has no landmarks.", reward: "king" },
  { name: "Icefish", weight: 4, color: "#b9efff", description: "Keeps asking everyone to chill. Everyone is already underwater.", reward: "meal" },
  { name: "Lavafish", weight: 4, color: "#ff7045", description: "Scientifically proven to make every fish tank a hot tub.", reward: "meal" },
  { name: "Godfish", weight: 3, color: "#ffffff", description: "Created the ocean, then immediately got caught in it.", reward: "god" },
  { name: "Moonfish", weight: 3, color: "#c8d0ff", description: "Only comes out at night, except when the fishing code says otherwise.", reward: "meal" },
  { name: "Sunfish", weight: 3, color: "#ffc85b", description: "Basically a dinner plate that learned how to swim sideways.", reward: "meal" },
  { name: "Ghostfish", weight: 2, color: "#d9f5ef", description: "Says boo underwater. It mostly comes out as blub.", reward: "king" },
  { name: "Robot Fish", weight: 2, color: "#93aeb9", description: "Runs on two batteries and an unreasonable amount of seaweed.", reward: "duck" },
  { name: "Voidfish", weight: 1, color: "#6c55b7", description: "Stare into the Voidfish and it asks why you are staring.", reward: "god" },
  { name: "Glitched Fish", weight: 1, color: "#ff55dc", description: "Swims through walls and occasionally becomes a toaster.", reward: "glitched" },
];
const changelogEntries: ChangelogEntry[] = [
  { title: "1. Birth of the Game", detail: "Began as an ocean arcade prototype with an A-shaped shark." },
  { title: "2. Sharks in the Water", detail: "Received its final name, menus, ocean artwork, and normal title lettering." },
  { title: "3. Raft Survival", detail: "Rebuilt around timed supply drops, a safe raft, materials, crafting, and shark attacks." },
  { title: "4. Food & Fairness", detail: "Every crate gained food; snacks heal one heart, meals heal all hearts, and the shark slowed down." },
  { title: "5. Pause Update", detail: "Added full-game pausing with the Pause button, P key, and Escape key." },
  { title: "6. Risky Cargo", detail: "Crates became carried cargo. A shark bite loses the cargo and calls in replacement drops." },
  { title: "7. Raft Expansion", detail: "Added doubling expansion costs. Three expansions prepare the horizon for new islands." },
  { title: "8. Endless Islands", detail: "God Material unlocked endless drops, Infernal crates, bridges, coconut islands, and autosaving." },
  { title: "9. Material Balance", detail: "Earlier materials became more common, making Wood, Stone, expansions, and bridges easier." },
  { title: "10. Changelog", detail: "Added this complete update history to the pause screen." },
  { title: "11. Wooden Crate Odds", detail: "Random special drops became an even 50% wooden crate and 50% technology crate." },
  { title: "12. Animal Islands", detail: "A fourth expansion revealed cow and sheep islands, hunting weapons, and full-heal food." },
  { title: "13. Complete Material HUD", detail: "The top-right HUD now always shows every material, including resources with a zero amount." },
  { title: "14. Cascading Crate Bonuses", detail: "Most higher-tier crates now include some of the material directly below their tier." },
  { title: "15. Chest Storage", detail: "Personal stacks became limited to 100. Craftable chests now store and retrieve overflow supplies." },
  { title: "16. Fight Back", detail: "The hunting spear can now strike the shark and force it to flee for 10–30 seconds." },
  { title: "17. Golden Heart Shop", detail: "A traveling shopkeeper now visits every five minutes to trade food for permanent golden hearts." },
  { title: "18. Shopkeeper Counter", detail: "The space below the controls now shows exactly when the shopkeeper arrives or leaves." },
  { title: "19. Exact Chest Deposits", detail: "Chest storage gained a form for choosing an item and typing the exact amount to deposit." },
  { title: "20. Coconut Stockpiles", detail: "Palm trees now visibly grow and display up to 100 harvestable coconuts, each worth two snacks." },
  { title: "21. Scrollable Changelog", detail: "Rebuilt the update history as one spacious, readable list that scrolls smoothly from oldest to newest." },
  { title: "22. Cheaper Bridges", detail: "Cut every island bridge recipe in half, starting at 6 Wood and 2 Stone." },
  { title: "23. Safe Bridge Crossing", detail: "Sharks now swim visibly beneath bridges and cannot bite players standing on the planks." },
  { title: "24. Fixed Bridge Price", detail: "Bridge prices no longer double. Every island bridge always costs 6 Wood and 2 Stone." },
  { title: "25. Breakable Spears", detail: "Hunting spears now last for five successful strikes or hunts before breaking and needing to be crafted again." },
  { title: "26. Bigger Traveling Shop", detail: "The shopkeeper now sells wood, stone, technology shards, and hunting spears alongside golden hearts." },
  { title: "27. Slimmer Sharks", detail: "Sharks became slimmer and can now navigate narrow water channels beside rafts, islands, bridges, and screen edges." },
  { title: "28. Save Files & Creative Mode", detail: "Added three independent save slots. Creative saves have infinite health, supplies, food, crafting, and expansions." },
  { title: "29. Speed Boost", detail: "Holding the spacebar while moving now gives the player a burst of extra speed." },
  { title: "30. Continuous Crafting", detail: "Successful recipes no longer close the crafting table, making repeated crafting fast and convenient." },
  { title: "31. Fishing Collection", detail: "The shop now sells fishing rods. Cast from safe ground to collect fish ranging from Common Cod to the Glitched Fish." },
  { title: "32. Creative Fishing Luck", detail: "Creative Mode fishing now guarantees a Goldfish, Diamondfish, Kingfish, Godfish, or Glitched Fish on every cast." },
  { title: "33. Fish Index", detail: "The pause menu gained a collectible fish index with silly descriptions and an upward-swimming fish in its title." },
  { title: "34. Fish Portraits", detail: "Every Fish Index entry gained unique artwork, including the crowned Kingfish and blocky, corrupted Glitched Fish." },
  { title: "35. Much More Fish", detail: "Expanded the fishing collection from 8 to 24 strange, silly, elemental, spooky, and mechanical catches." },
  { title: "36. Toaster Glitch", detail: "The Glitched Fish portrait now flickers unpredictably and occasionally transforms into a toaster." },
  { title: "37. Glitched Toast", detail: "Added draggable bread to the Fish Index that can be toasted when the Glitched Fish becomes a toaster." },
  { title: "38. Toast Escape", detail: "Spam-clicking Glitched Toast now ejects it into Games 3, beginning a secret delivery for Penelope's cat." },
  { title: "39. Cat or Dog Mood", detail: "Completing the toast quest now unlocks a permanent button for switching Penelope's pet between cat and dog." },
  { title: "40. Pet Type Carousel", detail: "Clicking Penelope's pet now cycles dog breeds or every cat skin available in Cat Math." },
  { title: "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0", detail: "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0" },
  { title: "50. Techno Cargo Fleet", detail: "Crafting tables can now upgrade through every material tier. The Techno Crafting Table unlocks docks and cargo ships that collect crates and unload them for pickup." },
  { title: "51. Bottom Cargo Harbor", detail: "The cargo dock now extends from the bottom of the raft. Bigger container ships unload crates safely on top of its wide pickup platform." },
  { title: "52. Retrieve Last", detail: "Every save slot now offers a Retrieve Last button whenever a previous valid autosave is available. Retrieving swaps the saves so it can be undone." },
  { title: "53. One Connected Raft", detail: "The cargo pickup, built bridges, and unlocked islands now count as part of the raft for unloading crates, opening chests, trading, fishing, movement, and shark safety." },
  { title: "54. Collector Bots", detail: "Techno tables can now build Collector Bots and a Storage Compartment. Bots gather island fruit and animals automatically, stacking food on the compartment or scattering it on safe ground until picked up." },
  { title: "55. Walking Workers", detail: "Collector Bots now physically leave the raft, walk across built bridges, harvest on the islands, carry food on their backs, and walk home before unloading." },
  { title: "56. Harvest Pickup Fix", detail: "Bot harvest piles now have a larger walk-over pickup area, can be clicked directly, explain when storage is full, and gain 1,000 extra spaces from the Storage Compartment." },
  { title: "57. Metal Pack", detail: "The traveling shop now sells a Metal Pack containing 50 Iron and 50 Steel for 25 Food." },
  { title: "58. Storage Mini Raft", detail: "The Storage Compartment now sits on its own planked mini raft above the main raft, joined by a safe walkway where bots can park and players can stand." },
  { title: "59. Terrain Generator", detail: "The shop now sells one-shard Terrain Generators. Each activation scans the ocean, expands the camera, reveals outer reefs, and attracts two additional sharks." },
  { title: "60. Storage That Stores", detail: "Bot harvests now merge into organized piles inside the Storage Compartment, with its front wall holding everything visibly in the bin." },
  { title: "61. Wider Bridges", detail: "Every island bridge is now almost twice as wide and has an extra forgiving safe edge, making crossings easier without accidentally entering the water." },
  { title: "62. Scold Bot", detail: "Moved cargo docks and ships into the Automation page and added a Scold Bot that attacks sharks with stern words, speech bubbles, and regular fear pulses." },
  { title: "63. Super Scold Bot", detail: "The Scold Bot can now gain a giant megaphone that blasts every shark away from the raft at once, followed by a three-second cooldown after its fear effect ends." },
  { title: "64. Sunken Raft Expanse", detail: "Terrain Generators now zoom far out and reveal groups of sunken rafts instead of attracting sharks. Rafts surface after three minutes in Survival or five seconds in Creative, then accept bridges from the main raft." },
  { title: "65. Follow Camera & Map", detail: "Normal play now stays closely centered on the player. The pause menu gained a full-map view for checking islands, surfaced rafts, wreck timers, and bridges." },
  { title: "66. Time Warper", detail: "The Technology Merchant now visits every three minutes and sells a permanent Time Warper. Ten-shard trips can advance wreck timers into the future or restore recorded versions of the player, raft, bridges, crates, and ocean from up to three minutes ago." },
  { title: "67. Raft Network", detail: "Resurfaced rafts now form branching bridge networks instead of every bridge radiating from the main raft. Rafts chain to nearby rafts, while regular branches connect back through built island bridges." },
  { title: "68. Cosmic Time", detail: "The Time Warper now crosses the entire lifetime of the universe. Repeatable billion-year jumps travel between the Big Bang and Big Crunch, alongside direct endpoint buttons, a return-to-present control, and the original short raft-history jumps." },
  { title: "69. Past You", detail: "Backward Time Warper trips now keep the traveler at the departure point while a glowing Past You replays the recorded movement from the restored moment. An arrow points toward echoes outside the camera." },
  { title: "70. Rainbow & Super Crates", detail: "One-percent Rainbow Crates contain 50 of every material, 50 full-heal foods, and 50 Terrain Generators. Rarest of all, 0.2-percent Super Crates contain 100 of everything and bypass ordinary stack limits." },
  { title: "71. Creative Crate Spawner", detail: "Creative Mode gained a K-key crate menu and touch button for spawning Supply, Wooden, Technology, Blood, Rainbow, or Super Crates near the player." },
  { title: "72. Clear Mode Labels", detail: "The HUD now always identifies Survival or Creative Mode, and the controls line only advertises the K-key Crate Spawner when the current save is actually Creative." },
  { title: "73. Named Voyages", detail: "New voyages can name both their save file and main raft. Names appear in the save menu, HUD, and painted across the raft, and can be changed from the pause menu." },
  { title: "74. Roll for a Name", detail: "The voyage naming panel now has dice buttons that invent random save-file and raft names whenever inspiration runs dry." },
  { title: "75. Survival Crate Shop", detail: "The K-key Crate Spawner now opens in Survival too. Supply, Wooden, Technology, Blood, Rainbow, and Super Crates cost increasing amounts of Food, while Creative spawning stays free." },
  { title: "76. The Emo Shark Phase", detail: "Every shark now has charcoal coloring, black side-swept hair, heavy eyeliner, a gloomy expression, and complete emotional immunity to Scold Bots. Spears still work." },
  { title: "77. Automatic Fisher Bot", detail: "The Automation page gained a Fisher Bot that works from the raft while you explore, catches a fish every twenty seconds, and prioritizes undiscovered species to fill the Fish Index." },
  { title: "78. Fisher Bot Catch Box", detail: "The Fisher Bot now drops its catches into a wooden box on the raft. Miniature versions of the Fish Index artwork are visibly piled inside." },
  { title: "79. Internet Two-Player Rooms", detail: "The save-file screen gained internet-capable short-code multiplayer rooms. Both players share supplies, catches, purchases, automation, crates, coconuts, and generated terrain, with numbered player announcements." },
];

const keys = new Set<Direction>();
const player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 15, hearts: 3, invincibleUntil: 0 };
const shark: SharkEntity = { x: 110, y: 120, angle: 0, biteCooldownUntil: 0 };
const inventory = new Map<string, number>();
const foodHealing: number[] = [];
const chestInventory = new Map<string, number>();
const chestFoodHealing: number[] = [];

let mode: GameMode = "ready";
let elapsed = 0;
let lastTimestamp = performance.now();
let nextSupplyAt = 0;
let nextRandomAt = 28;
let progressionIndex = 0;
let crates: FloatingCrate[] = [];
let carriedCrates: FloatingCrate[] = [];
let bubbles = createBubbles(38);
let particles: Particle[] = [];
let message = "";
let messageUntil = 0;
let hasCraftingTable = false;
let craftingTableLevel = 0;
let hasCargoDock = false;
let cargoShipCount = 0;
let cargoShips: CargoShip[] = [];
let hasScoldBot = false;
let hasSuperScoldBot = false;
let nextScoldAt = 0;
let scoldBubbleUntil = 0;
let scoldBeamUntil = 0;
let scoldMessage = "";
let scoldTarget: SharkEntity | null = null;
let hasStorageCompartment = false;
let collectorBotCount = 0;
let collectorBots: CollectorBot[] = [];
let collectorDrops: CollectorDrop[] = [];
let nextCollectorRunAt = 0;
let craftingOpen = false;
let craftingAutomationPage = false;
let sharkDecoyUntil = 0;
let shieldUntil = 0;
let raftLevel = 1;
let expansionCount = 0;
let endgameUnlocked = false;
let bridgesBuilt = 0;
let coconutReadyAt = ISLANDS.map(() => 0);
let savingIndicatorUntil = 0;
let restoredAutosave = false;
let changelogOpen = false;
let hasHuntingSpear = false;
let spearDurability = 0;
let animalReadyAt = ISLANDS.map(() => 0);
let chestCount = 0;
let storageOpen = false;
let sharkFleeUntil = 0;
let maxHearts = 3;
let nextShopkeeperAt = SHOPKEEPER_INTERVAL;
let shopkeeperUntil = 0;
let shopOpen = false;
let currentSaveSlot = 1;
let gameKind: GameKind = "survival";
let isHacker = false;
let sharkDeleted = false;
let homeRaftDeleted = false;
let shopkeeperDeleted = false;
let hudDeleted = false;
let oceanDeleted = false;
let playerDeleted = false;
let sinkVelocity = 0;
// Deliberately not saved: deleting the whole game lasts until a refresh.
let gameDeleted = false;
const deletedIslands = new Set<number>();
const deletedGuiSelectors = new Set<string>();
let hackerPanelOpen = false;
let hackerTool: HackerTool = "none";
let hackerClipboard: HackerClipboard | null = null;
let saveSelected = false;
let saveFileName = "Save 1";
let raftName = "Home Raft";
let pendingNamingAction: NamingAction | null = null;
let speedBoostHeld = false;
let hasFishingRod = false;
let hasFisherBot = false;
let nextAutoFishAt = 0;
let fisherBotCatches: string[] = [];
let hasTimeWarper = false;
let timeWarperOpen = false;
let timeSnapshots: TimeSnapshot[] = [];
let nextTimeSnapshotAt = 0;
let cosmicTimeYears = PRESENT_UNIVERSE_AGE;
let pastSelfEcho: PastSelfEcho | null = null;
let creativeCrateMenuOpen = false;
let fishingUntil = 0;
let fishingBobber = { x: 0, y: 0 };
const fishCollection = new Map<string, number>();
let fishIndexOpen = false;
let mapOpen = false;
let terrainGenerators = 0;
let terrainLevel = 0;
let terrainAnimationUntil = 0;
let sunkenRafts: SunkenRaft[] = [];
let extraSharks: SharkEntity[] = [];
const multiplayerSenderId = crypto.randomUUID();
let multiplayerRoomCode = "";
let multiplayerPlayerNumber: 1 | 2 = 1;
let multiplayerIsHost = false;
let multiplayerConnected = false;
let remotePlayerState: RemotePlayerState | null = null;
let pendingMultiplayerState: Partial<SaveData> | null = null;
let lastMultiplayerPositionAt = 0;
let lastWorldSyncAt = 0;
// Last shark pose the host sent, with the speed it was travelling at, so the
// guest can keep animating between updates instead of teleporting.
let sharkNetPose: { x: number; y: number; angle: number; speed: number; at: number } | null = null;

interface WorldSyncPayload {
  shark: { x: number; y: number; angle: number; speed: number };
  extraSharks: Array<{ x: number; y: number; angle: number }>;
  crates: FloatingCrate[];
  sharkDeleted: boolean;
}

// The host owns the world: it spawns crates and runs shark AI. Guests render
// what they are told, so the two sides can never fight over the same entities.
function isWorldAuthority(): boolean {
  return !multiplayerConnected || multiplayerIsHost;
}
let multiplayerBroadcastChannel: BroadcastChannel | null = null;
let multiplayerPeer: Peer | null = null;
let multiplayerConnection: DataConnection | null = null;

interface ViteHotChannel {
  send(event: string, data: unknown): void;
  on(event: string, callback: (data: unknown) => void): void;
}
const multiplayerHotChannel = (import.meta as ImportMeta & { hot?: ViteHotChannel }).hot;

window.setInterval(() => {
  for (const picture of document.querySelectorAll<HTMLElement>(".fish-glitched-fish:not(.locked-picture)")) {
    if (Math.random() < (isNightmareLevel() ? 0.7 : 0.32)) {
      picture.classList.add("glitch-flicker");
      window.setTimeout(() => picture.classList.remove("glitch-flicker"), 180 + Math.random() * 260);
    }
    if (!picture.classList.contains("toaster-mode") && Math.random() < (isNightmareLevel() ? 0.22 : 0.09)) {
      picture.classList.add("toaster-mode");
      window.setTimeout(() => {
        if (!picture.classList.contains("toasting-bread")) picture.classList.remove("toaster-mode");
      }, 2500 + Math.random() * 1500);
    }
  }
}, 650);

document.getElementById("fish-index-bread")?.addEventListener("dragstart", (event) => {
  if (!(event instanceof DragEvent) || !event.dataTransfer) return;
  event.dataTransfer.setData("text/plain", "fish-index-bread");
  event.dataTransfer.effectAllowed = "copy";
});

window.addEventListener("keydown", (event) => {
  const devLockDialog = document.getElementById("dev-lock-dialog");
  if (devLockDialog && !devLockDialog.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDevLockDialog();
    }
    return;
  }
  const namingDialog = document.getElementById("naming-dialog");
  if (namingDialog && !namingDialog.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeNamingDialog();
    }
    return;
  }
  if (!saveSelected) return;
  if (event.key === "Escape" && (hackerPanelOpen || hackerTool !== "none")) {
    event.preventDefault();
    hackerTool = "none";
    closeHackerPanel();
    return;
  }
  if (timeWarperOpen && event.key === "Escape") {
    event.preventDefault();
    toggleTimeWarper();
    return;
  }
  if (creativeCrateMenuOpen && event.key === "Escape") {
    event.preventDefault();
    toggleCreativeCrateMenu();
    return;
  }
  if (shopOpen && event.key === "Escape") {
    event.preventDefault();
    shopOpen = false;
    updateShopkeeperButton();
    return;
  }
  if ((event.key.toLowerCase() === "p" || event.key === "Escape") && (mode === "playing" || mode === "paused")) {
    event.preventDefault();
    togglePause();
    return;
  }

  if (mode === "paused" && event.key.toLowerCase() === "m") {
    event.preventDefault();
    toggleMap();
    return;
  }

  if (mode === "paused") return;

  if (event.key.toLowerCase() === "k" && mode === "playing") {
    event.preventDefault();
    toggleCreativeCrateMenu();
    return;
  }

  const direction = keyToDirection(event.key);
  if (direction) {
    event.preventDefault();
    keys.add(direction);
    if (mode === "ready") startGame();
  }

  if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault();
    if (mode !== "playing") startGame();
    else if (event.code === "Space") speedBoostHeld = true;
  }

  if (event.key.toLowerCase() === "c" && mode === "playing") {
    event.preventDefault();
    toggleCrafting();
  }

  if (event.key.toLowerCase() === "e" && mode === "playing") {
    event.preventDefault();
    eatFood();
  }

  if (event.key.toLowerCase() === "f" && mode === "playing") {
    event.preventDefault();
    harvestCoconuts();
  }

  if (event.key.toLowerCase() === "h" && mode === "playing") {
    event.preventDefault();
    huntAnimal();
  }

  if (event.key.toLowerCase() === "b" && mode === "playing") {
    event.preventDefault();
    toggleStorage();
  }

  if (event.key.toLowerCase() === "j" && mode === "playing") {
    event.preventDefault();
    toggleShop();
  }

  if (event.key.toLowerCase() === "r" && mode === "playing") {
    event.preventDefault();
    startFishing();
  }

  if (event.key.toLowerCase() === "g" && mode === "playing") {
    event.preventDefault();
    useTerrainGenerator();
  }

  if (craftingOpen && event.key === "Tab") {
    event.preventDefault();
    toggleCraftingPage();
  } else if (craftingOpen && /^[1-9]$/.test(event.key)) {
    const recipe = Number(event.key);
    if (!craftingAutomationPage && recipe <= 7) craftRecipe(recipe);
    else if (craftingAutomationPage && recipe <= 7) craftRecipe(recipe + 7);
  }
  if (timeWarperOpen && /^[1-9]$/.test(event.key)) useTimeWarper(Number(event.key));
  if (creativeCrateMenuOpen && /^[1-6]$/.test(event.key)) spawnCreativeCrate(Number(event.key));
  if (storageOpen && event.key.toLowerCase() === "s") storeAllInChest();
  if (storageOpen && event.key.toLowerCase() === "t") takeAllFromChest();
  if (shopOpen && /^[1-9]$/.test(event.key)) buyShopOffer(Number(event.key));
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") speedBoostHeld = false;
  const direction = keyToDirection(event.key);
  if (direction) keys.delete(direction);
});

window.addEventListener("blur", () => {
  speedBoostHeld = false;
  keys.clear();
});

canvas.addEventListener("pointerdown", (event) => {
  if (!saveSelected) return;
  canvas.focus();
  if (mode === "paused" && mapOpen) toggleMap();
  else if (mode === "paused" && fishIndexOpen) toggleFishIndex();
  else if (mode === "paused" && changelogOpen) toggleChangelog();
  else if (mode === "paused") togglePause();
  else if (craftingOpen) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    if (x >= 775 && x <= 930 && y >= 92 && y <= 142) {
      toggleCraftingPage();
      return;
    }
    const recipe = getCraftRecipeAt(x, y);
    if (recipe > 0) craftRecipe(recipe);
  }
  else if (timeWarperOpen) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const choice = getTimeWarperChoiceAt(x, y);
    if (choice > 0) useTimeWarper(choice);
  }
  else if (creativeCrateMenuOpen) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const choice = getCreativeCrateChoiceAt(x, y);
    if (choice > 0) spawnCreativeCrate(choice);
  }
  else if (shopOpen) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const offer = getShopOfferAt(x, y);
    if (offer > 0) buyShopOffer(offer);
  }
  else if (mode === "playing") {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const zoom = getCameraZoom();
    const camera = getCameraCenter();
    const worldX = camera.x + (x - WIDTH / 2) / zoom;
    const worldY = camera.y + (y - HEIGHT / 2) / zoom;
    if (useHackerToolAt(worldX, worldY)) return;
    collectCollectorDrops(worldX, worldY, 30 / zoom);
  }
  else startGame();
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-direction]")) {
  const direction = button.dataset["direction"] as Direction | undefined;
  if (!direction) continue;
  const press = (event: PointerEvent): void => {
    event.preventDefault();
    if (!saveSelected) return;
    button.setPointerCapture(event.pointerId);
    keys.add(direction);
    if (mode === "ready") startGame();
  };
  const release = (event: PointerEvent): void => {
    event.preventDefault();
    keys.delete(direction);
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

document.querySelector<HTMLButtonElement>("[data-action='craft']")?.addEventListener("click", toggleCrafting);
document.querySelector<HTMLButtonElement>("[data-action='eat']")?.addEventListener("click", eatFood);
document.querySelector<HTMLButtonElement>("[data-action='pause']")?.addEventListener("click", togglePause);
document.querySelector<HTMLButtonElement>("[data-action='map']")?.addEventListener("click", toggleMap);
document.querySelector<HTMLButtonElement>("[data-action='rename']")?.addEventListener("click", renameCurrentVoyage);
document.querySelector<HTMLButtonElement>("[data-action='cancel-naming']")?.addEventListener("click", closeNamingDialog);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-random-name]")) {
  button.addEventListener("click", () => randomizeVoyageName(button.dataset["randomName"] === "raft" ? "raft" : "save"));
}
document.getElementById("naming-dialog")?.addEventListener("submit", (event) => {
  event.preventDefault();
  finishNamingVoyage();
});
document.getElementById("dev-lock-dialog")?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitDevLockAnswer();
});
document.querySelector<HTMLButtonElement>("[data-action='cancel-dev-lock']")?.addEventListener("click", closeDevLockDialog);
document.querySelector<HTMLButtonElement>("[data-action='multiplayer']")?.addEventListener("click", openMultiplayerDialog);
document.querySelector<HTMLButtonElement>("[data-action='create-room']")?.addEventListener("click", createMultiplayerRoom);
document.querySelector<HTMLButtonElement>("[data-action='join-room']")?.addEventListener("click", joinMultiplayerRoom);
document.querySelector<HTMLButtonElement>("[data-action='start-multiplayer']")?.addEventListener("click", startMultiplayerGame);
document.querySelector<HTMLButtonElement>("[data-action='close-multiplayer']")?.addEventListener("click", closeMultiplayerDialog);
document.querySelector<HTMLButtonElement>("[data-action='harvest']")?.addEventListener("click", harvestCoconuts);
document.querySelector<HTMLButtonElement>("[data-action='changelog']")?.addEventListener("click", toggleChangelog);
document.querySelector<HTMLButtonElement>("[data-action='fish-index']")?.addEventListener("click", toggleFishIndex);
document.querySelector<HTMLButtonElement>("[data-action='save-files']")?.addEventListener("click", openSaveSelector);
document.querySelector<HTMLButtonElement>("[data-action='hunt']")?.addEventListener("click", huntAnimal);
document.querySelector<HTMLButtonElement>("[data-action='fish']")?.addEventListener("click", startFishing);
document.querySelector<HTMLButtonElement>("[data-action='chest']")?.addEventListener("click", toggleStorage);
document.querySelector<HTMLButtonElement>("[data-action='shop']")?.addEventListener("click", handleShopButton);
document.querySelector<HTMLButtonElement>("[data-action='deposit']")?.addEventListener("click", openDepositDialog);
document.querySelector<HTMLButtonElement>("[data-action='terrain']")?.addEventListener("click", useTerrainGenerator);
document.querySelector<HTMLButtonElement>("[data-action='time-warper']")?.addEventListener("click", toggleTimeWarper);
document.querySelector<HTMLButtonElement>("[data-action='crate-spawner']")?.addEventListener("click", toggleCreativeCrateMenu);
document.querySelector<HTMLButtonElement>("[data-action='hacker']")?.addEventListener("click", toggleHackerPanel);
document.querySelector<HTMLButtonElement>("[data-action='close-hacker']")?.addEventListener("click", closeHackerPanel);
document.querySelector<HTMLButtonElement>("[data-action='hacker-swap-mode']")?.addEventListener("click", swapHackerMode);
document.querySelector<HTMLButtonElement>("[data-action='hacker-crate']")?.addEventListener("click", spawnHackerCrate);
document.querySelector<HTMLButtonElement>("[data-action='hacker-nuke-shop']")?.addEventListener("click", nukeShopkeeper);
document.querySelector<HTMLButtonElement>("[data-action='hacker-dupe-raft']")?.addEventListener("click", duplicateRaft);
document.querySelector<HTMLButtonElement>("[data-action='hacker-copy']")?.addEventListener("click", () => setHackerTool("copy"));
document.querySelector<HTMLButtonElement>("[data-action='hacker-paste']")?.addEventListener("click", pasteHackerClipboard);
document.querySelector<HTMLButtonElement>("[data-action='hacker-delete']")?.addEventListener("click", () => setHackerTool("delete"));
document.querySelector<HTMLButtonElement>("[data-action='hacker-gui']")?.addEventListener("click", () => setHackerTool("gui"));
document.querySelector<HTMLButtonElement>("[data-action='hacker-restore']")?.addEventListener("click", restoreDeletedAssets);
document.querySelector<HTMLButtonElement>("[data-action='hacker-delete-game']")?.addEventListener("click", deleteWholeGame);
installGuiDeleteHandler();
document.querySelector<HTMLButtonElement>("[data-action='cancel-deposit']")?.addEventListener("click", closeDepositDialog);
document.getElementById("deposit-item")?.addEventListener("change", updateDepositAmountLimit);
document.getElementById("deposit-dialog")?.addEventListener("submit", (event) => {
  event.preventDefault();
  depositSelectedItems();
});

multiplayerHotChannel?.on("sharks:room-message", (data) => handleMultiplayerMessage(data));

const changelogList = document.getElementById("changelog-list");
if (changelogList) {
  for (const entry of changelogEntries) {
    const item = document.createElement("li");
    const title = document.createElement("h3");
    const detail = document.createElement("p");
    title.textContent = entry.title;
    detail.textContent = entry.detail;
    item.append(title, detail);
    changelogList.append(item);
  }
}

function openMultiplayerDialog(): void {
  const dialog = document.getElementById("multiplayer-dialog");
  if (dialog) dialog.hidden = false;
  updateMultiplayerStatus();
}

function closeMultiplayerDialog(): void {
  const dialog = document.getElementById("multiplayer-dialog");
  if (dialog) dialog.hidden = true;
}

function createMultiplayerRoom(): void {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  multiplayerRoomCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? "X").join("");
  multiplayerPlayerNumber = 1;
  multiplayerIsHost = true;
  multiplayerConnected = false;
  remotePlayerState = null;
  initializeMultiplayerTransport();
  startInternetRoomHost();
  const codeDisplay = document.getElementById("room-code-display");
  const codeValue = document.getElementById("room-code-value");
  if (codeDisplay) codeDisplay.hidden = false;
  if (codeValue) codeValue.textContent = multiplayerRoomCode;
  updateMultiplayerStatus("Room created. Waiting for Player 2…");
}

function joinMultiplayerRoom(): void {
  const input = document.getElementById("join-room-code");
  if (!(input instanceof HTMLInputElement)) return;
  const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length !== 6) {
    updateMultiplayerStatus("Enter the complete six-character room code.");
    return;
  }
  multiplayerRoomCode = code;
  multiplayerPlayerNumber = 2;
  multiplayerIsHost = false;
  multiplayerConnected = false;
  remotePlayerState = null;
  initializeMultiplayerTransport();
  const codeDisplay = document.getElementById("room-code-display");
  const codeValue = document.getElementById("room-code-value");
  if (codeDisplay) codeDisplay.hidden = false;
  if (codeValue) codeValue.textContent = code;
  updateMultiplayerStatus("Looking for Player 1…");
  connectInternetRoomGuest();
}

function initializeMultiplayerTransport(): void {
  if (multiplayerHotChannel || multiplayerBroadcastChannel || typeof BroadcastChannel === "undefined") return;
  multiplayerBroadcastChannel = new BroadcastChannel("sharks-in-the-water-multiplayer");
  multiplayerBroadcastChannel.addEventListener("message", (event: MessageEvent<unknown>) => handleMultiplayerMessage(event.data));
}

function resetInternetRoomConnection(): void {
  multiplayerConnection?.close();
  multiplayerPeer?.destroy();
  multiplayerConnection = null;
  multiplayerPeer = null;
}

function getInternetPeerId(code: string): string {
  return `sharks-water-${code.toLowerCase()}`;
}

function startInternetRoomHost(): void {
  resetInternetRoomConnection();
  updateMultiplayerStatus("Opening an internet room…");
  const peer = new Peer(getInternetPeerId(multiplayerRoomCode));
  multiplayerPeer = peer;
  peer.on("open", () => updateMultiplayerStatus("Room is online. Waiting for Player 2…"));
  peer.on("connection", (connection) => wireInternetConnection(connection));
  peer.on("error", (error) => {
    const message = error.type === "unavailable-id"
      ? "That code is already being used. Create another room."
      : "Could not reach the internet room service. Check the connection and try again.";
    updateMultiplayerStatus(message);
  });
}

function connectInternetRoomGuest(): void {
  resetInternetRoomConnection();
  const peer = new Peer();
  multiplayerPeer = peer;
  peer.on("open", () => {
    const connection = peer.connect(getInternetPeerId(multiplayerRoomCode), { reliable: true, serialization: "json" });
    wireInternetConnection(connection);
  });
  peer.on("error", () => updateMultiplayerStatus("Room not found yet. Check the code and make sure Player 1 is online."));
}

function wireInternetConnection(connection: DataConnection): void {
  multiplayerConnection?.close();
  multiplayerConnection = connection;
  connection.on("data", (data) => handleMultiplayerMessage(data));
  connection.on("open", () => {
    multiplayerConnected = true;
    updateMultiplayerStatus(`Connected as Player ${multiplayerPlayerNumber} in ${multiplayerRoomCode}`);
    if (multiplayerPlayerNumber === 2) sendMultiplayerMessage("join");
  });
  connection.on("close", () => {
    multiplayerConnected = false;
    remotePlayerState = null;
    updateMultiplayerStatus("The other player disconnected. The room can be joined again.");
  });
  connection.on("error", () => updateMultiplayerStatus("The player-to-player connection failed. Try joining again."));
}

function sendMultiplayerMessage(type: MultiplayerMessage["type"], payload?: unknown): void {
  if (!multiplayerRoomCode) return;
  const message: MultiplayerMessage = {
    room: multiplayerRoomCode,
    sender: multiplayerSenderId,
    player: multiplayerPlayerNumber,
    type,
    payload,
  };
  if (multiplayerConnection?.open) multiplayerConnection.send(message);
  else if (multiplayerHotChannel) multiplayerHotChannel.send("sharks:room-message", message);
  else multiplayerBroadcastChannel?.postMessage(message);
}

function isMultiplayerMessage(value: unknown): value is MultiplayerMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<MultiplayerMessage>;
  return typeof message.room === "string"
    && typeof message.sender === "string"
    && (message.player === 1 || message.player === 2)
    && ["join", "welcome", "position", "state", "notice", "start", "world", "take"].includes(message.type ?? "");
}

function handleMultiplayerMessage(value: unknown): void {
  if (!isMultiplayerMessage(value) || value.room !== multiplayerRoomCode || value.sender === multiplayerSenderId) return;
  if (value.type === "join" && multiplayerIsHost) {
    multiplayerConnected = true;
    updateMultiplayerStatus("Player 2 joined! Choose or continue a save to play.");
    if (saveSelected) saveGame();
    const raw = saveSelected ? localStorage.getItem(getSaveKey(currentSaveSlot)) : null;
    sendMultiplayerMessage("welcome", parseSave(raw));
    return;
  }
  if (value.type === "welcome" && !multiplayerIsHost) {
    multiplayerConnected = true;
    updateMultiplayerStatus("Connected as Player 2! Choose a save to enter the shared raft.");
    const state = value.payload && typeof value.payload === "object" ? value.payload as Partial<SaveData> : null;
    if (state) {
      pendingMultiplayerState = state;
      if (saveSelected) applyMultiplayerState(state);
    }
    return;
  }
  if (value.type === "position") {
    const position = value.payload as Partial<RemotePlayerState> | undefined;
    if (typeof position?.x === "number" && typeof position.y === "number") {
      multiplayerConnected = true;
      remotePlayerState = { x: position.x, y: position.y, player: value.player, updatedAt: performance.now() };
    }
    return;
  }
  if (value.type === "state") {
    const state = value.payload && typeof value.payload === "object" ? value.payload as Partial<SaveData> : null;
    if (state) {
      pendingMultiplayerState = state;
      if (saveSelected) applyMultiplayerState(state);
    }
    return;
  }
  if (value.type === "world") {
    if (multiplayerIsHost) return;
    multiplayerConnected = true;
    const payload = value.payload as WorldSyncPayload | undefined;
    if (payload && Array.isArray(payload.crates) && payload.shark) applyWorldSync(payload);
    return;
  }
  if (value.type === "take") {
    // A guest grabbed a crate; the host is the one that owns the list.
    if (!multiplayerIsHost) return;
    const spot = value.payload as { x?: number; y?: number } | undefined;
    if (typeof spot?.x !== "number" || typeof spot.y !== "number") return;
    const index = crates.findIndex((crate) => distance(crate.x, crate.y, spot.x as number, spot.y as number) < 40);
    if (index >= 0) crates.splice(index, 1);
    return;
  }
  if (value.type === "start") {
    multiplayerConnected = true;
    beginMultiplayerSession();
    return;
  }
  if (value.type === "notice" && typeof value.payload === "string") {
    showMessage(`PLAYER ${value.player}: ${value.payload}`, 5);
  }
}

function updateMultiplayerStatus(text?: string): void {
  const status = document.getElementById("multiplayer-status");
  if (!status) return;
  status.textContent = text ?? (multiplayerRoomCode
    ? multiplayerConnected ? `Connected as Player ${multiplayerPlayerNumber} in ${multiplayerRoomCode}` : `Room ${multiplayerRoomCode} is waiting…`
    : "Not connected");
  updateMultiplayerStartButton();
}

// The Start button only exists once both players are actually linked.
function updateMultiplayerStartButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='start-multiplayer']");
  if (!button) return;
  button.hidden = !multiplayerConnected;
  button.textContent = "Start Game";
}

// Either player can press Start; both are taken in together.
function startMultiplayerGame(): void {
  if (!multiplayerConnected) return;
  sendMultiplayerMessage("start");
  beginMultiplayerSession();
}

// Start drops both players straight into a brand new survival voyage — no save
// picking, no naming dialog.
function beginMultiplayerSession(): void {
  closeMultiplayerDialog();
  closeNamingDialog();

  const slot = findEmptySaveSlot();
  if (slot === null) {
    // Every slot is taken, and silently overwriting someone's voyage would be
    // worse than asking. Fall back to the save screen.
    const selector = document.getElementById("save-selector");
    if (selector) selector.hidden = false;
    renderSaveSlots();
    updateMultiplayerStatus("All three saves are full — free one or pick a save to play.");
    return;
  }

  currentSaveSlot = slot;
  isHacker = false;
  gameKind = "survival";
  saveFileName = `Save ${slot}`;
  raftName = "Home Raft";
  saveSelected = true;
  document.getElementById("save-selector")?.setAttribute("hidden", "");
  startGame();
  showMessage("BOTH PLAYERS ARE IN — NEW SURVIVAL, GO!", 4);
}

function findEmptySaveSlot(): number | null {
  for (let slot = 1; slot <= 3; slot += 1) {
    if (!localStorage.getItem(getSaveKey(slot))) return slot;
  }
  return null;
}

function broadcastMultiplayerNotice(text: string): void {
  if (multiplayerConnected) sendMultiplayerMessage("notice", text);
}

function applyMultiplayerState(data: Partial<SaveData>): void {
  if (Array.isArray(data.inventory)) {
    inventory.clear();
    for (const [name, amount] of data.inventory) inventory.set(name, Math.max(0, Math.floor(amount)));
  }
  if (Array.isArray(data.foodHealing)) {
    foodHealing.splice(0, foodHealing.length, ...data.foodHealing.filter((value) => value === 1 || value === 99));
    inventory.set("Food", foodHealing.length);
  }
  if (Array.isArray(data.crates)) crates = data.crates.map((crate) => ({ ...crate }));
  // Carried crates are personal cargo, not shared world state — copying the
  // other player's would hand you their crates and lose your own.
  if (!multiplayerConnected && Array.isArray(data.carriedCrates)) {
    carriedCrates = data.carriedCrates.map((crate) => ({ ...crate }));
  }
  if (Array.isArray(data.chestInventory)) {
    chestInventory.clear();
    for (const [name, amount] of data.chestInventory) chestInventory.set(name, Math.max(0, Math.floor(amount)));
  }
  if (Array.isArray(data.chestFoodHealing)) chestFoodHealing.splice(0, chestFoodHealing.length, ...data.chestFoodHealing);
  if (typeof data.raftLevel === "number") raftLevel = Math.max(1, Math.floor(data.raftLevel));
  if (typeof data.expansionCount === "number") expansionCount = Math.max(0, Math.floor(data.expansionCount));
  if (typeof data.bridgesBuilt === "number") bridgesBuilt = Math.max(0, Math.floor(data.bridgesBuilt));
  if (typeof data.endgameUnlocked === "boolean") endgameUnlocked = data.endgameUnlocked;
  if (typeof data.hasCraftingTable === "boolean") hasCraftingTable = data.hasCraftingTable;
  if (typeof data.craftingTableLevel === "number") craftingTableLevel = data.craftingTableLevel;
  if (typeof data.hasCargoDock === "boolean") hasCargoDock = data.hasCargoDock;
  if (typeof data.cargoShipCount === "number") cargoShipCount = data.cargoShipCount;
  if (typeof data.hasStorageCompartment === "boolean") hasStorageCompartment = data.hasStorageCompartment;
  if (typeof data.collectorBotCount === "number") collectorBotCount = data.collectorBotCount;
  if (Array.isArray(data.collectorBots)) collectorBots = data.collectorBots.map((bot) => ({ ...bot, waypoints: [...bot.waypoints] }));
  if (Array.isArray(data.collectorDrops)) collectorDrops = data.collectorDrops.map((drop) => ({ ...drop }));
  if (typeof data.hasScoldBot === "boolean") hasScoldBot = data.hasScoldBot;
  if (typeof data.hasSuperScoldBot === "boolean") hasSuperScoldBot = data.hasSuperScoldBot;
  if (typeof data.chestCount === "number") chestCount = Math.max(0, Math.floor(data.chestCount));
  if (typeof data.hasHuntingSpear === "boolean") hasHuntingSpear = data.hasHuntingSpear;
  if (typeof data.spearDurability === "number") spearDurability = data.spearDurability;
  if (typeof data.maxHearts === "number") maxHearts = data.maxHearts;
  if (typeof data.hasFishingRod === "boolean") hasFishingRod = data.hasFishingRod;
  if (typeof data.hasFisherBot === "boolean") hasFisherBot = data.hasFisherBot;
  if (typeof data.nextAutoFishIn === "number") nextAutoFishAt = elapsed + Math.max(0, data.nextAutoFishIn);
  if (Array.isArray(data.fisherBotCatches)) fisherBotCatches = [...data.fisherBotCatches];
  if (typeof data.hasTimeWarper === "boolean") hasTimeWarper = data.hasTimeWarper;
  if (typeof data.cosmicTimeYears === "number") cosmicTimeYears = data.cosmicTimeYears;
  if (typeof data.nextShopkeeperIn === "number") nextShopkeeperAt = elapsed + Math.max(0, data.nextShopkeeperIn);
  if (typeof data.shopkeeperRemaining === "number") shopkeeperUntil = elapsed + Math.max(0, data.shopkeeperRemaining);
  if (typeof data.terrainGenerators === "number") terrainGenerators = data.terrainGenerators;
  if (typeof data.terrainLevel === "number") terrainLevel = data.terrainLevel;
  if (Array.isArray(data.sunkenRafts)) sunkenRafts = data.sunkenRafts.map((wreck) => ({ ...wreck }));
  if (Array.isArray(data.coconutReadyIn)) coconutReadyAt = ISLANDS.map((_, index) => elapsed + (data.coconutReadyIn?.[index] ?? 0));
  if (Array.isArray(data.animalReadyIn)) animalReadyAt = ISLANDS.map((_, index) => elapsed + (data.animalReadyIn?.[index] ?? 0));
  if (Array.isArray(data.fishCollection)) {
    fishCollection.clear();
    for (const [name, amount] of data.fishCollection) fishCollection.set(name, amount);
  }
  syncCargoShips();
  if (Array.isArray(data.cargoShipCargo)) {
    data.cargoShipCargo.slice(0, cargoShips.length).forEach((cargo, index) => {
      const ship = cargoShips[index];
      if (!ship) return;
      ship.cargo = { ...cargo };
      ship.state = "returning";
    });
  }
  syncCollectorBots();
  updateTerrainButton();
  updateShopkeeperButton();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
  pendingMultiplayerState = null;
}

function getSaveKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

function getBackupSaveKey(slot: number): string {
  return `${SAVE_BACKUP_KEY_PREFIX}${slot}`;
}

function parseSave(raw: string | null): Partial<SaveData> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    return data.version === 1 && typeof data.elapsed === "number" && Array.isArray(data.inventory) ? data : null;
  } catch {
    return null;
  }
}

function restoreRecoveredSaveOne(): void {
  if (localStorage.getItem(RECOVERED_SAVE_ONE_FLAG)) return;
  const currentRaw = localStorage.getItem(getSaveKey(1));
  const current = parseSave(currentRaw);
  if (!current || (current.elapsed ?? 0) < recoveredSaveOne.elapsed) {
    if (currentRaw && current) localStorage.setItem(getBackupSaveKey(1), currentRaw);
    localStorage.setItem(getSaveKey(1), JSON.stringify(recoveredSaveOne));
  }
  localStorage.setItem(RECOVERED_SAVE_ONE_FLAG, "true");
}

function migrateLegacySave(): void {
  const legacySave = localStorage.getItem(LEGACY_SAVE_KEY);
  if (!legacySave || localStorage.getItem(getSaveKey(1))) return;
  try {
    const data = JSON.parse(legacySave) as Partial<SaveData>;
    localStorage.setItem(getSaveKey(1), JSON.stringify({ ...data, gameKind: "survival" }));
  } catch {}
}

function renderSaveSlots(): void {
  const list = document.getElementById("save-slot-list");
  if (!list) return;
  list.replaceChildren();
  for (let slot = 1; slot <= 3; slot += 1) {
    const raw = localStorage.getItem(getSaveKey(slot));
    const data = parseSave(raw);
    const backupData = parseSave(localStorage.getItem(getBackupSaveKey(slot)));
    const card = document.createElement("article");
    const title = document.createElement("h3");
    const modeLabel = document.createElement("p");
    const detail = document.createElement("p");
    card.className = `save-slot${data?.isHacker ? " hacker" : data?.gameKind === "creative" ? " creative" : ""}`;
    title.textContent = sanitizeName(data?.saveFileName, `Save ${slot}`);
    modeLabel.className = "slot-mode";
    modeLabel.textContent = data
      ? data.isHacker ? "Hacker Mode" : data.gameKind === "creative" ? "Creative Mode" : "Survival Mode"
      : backupData ? "Backup Available" : "Empty Slot";
    detail.className = "slot-detail";
    detail.textContent = data
      ? `${sanitizeName(data.raftName, "Home Raft")} • Raft level ${Math.max(1, Math.floor(data.raftLevel ?? 1))} • ${formatTime(Math.floor(data.elapsed ?? 0))} played`
      : backupData
        ? `Retrieve ${sanitizeName(backupData.raftName, "Home Raft")} • Raft level ${Math.max(1, Math.floor(backupData.raftLevel ?? 1))} • ${formatTime(Math.floor(backupData.elapsed ?? 0))} played`
        : "Start a normal survival voyage or an unlimited creative voyage.";
    card.append(title, modeLabel, detail);
    if (data) {
      card.append(createSlotButton("Continue", () => continueSave(slot)));
      card.append(createSlotButton("Rename", () => renameStoredVoyage(slot)));
      if (backupData) {
        const retrieveButton = createSlotButton("Retrieve Last", () => retrieveLastSave(slot));
        retrieveButton.dataset["action"] = "retrieve-last";
        card.append(retrieveButton);
      }
      const deleteButton = createSlotButton("Delete Save", () => deleteSave(slot));
      deleteButton.dataset["action"] = "delete-slot";
      card.append(deleteButton);
    } else {
      if (backupData) {
        const retrieveButton = createSlotButton("Retrieve Last", () => retrieveLastSave(slot));
        retrieveButton.dataset["action"] = "retrieve-last";
        card.append(retrieveButton);
      }
      const survivalButton = createSlotButton("New Survival", () => createSave(slot, "survival"));
      survivalButton.dataset["mode"] = "survival";
      const creativeButton = createSlotButton("New Creative", () => createSave(slot, "creative"));
      creativeButton.dataset["mode"] = "creative";
      card.append(survivalButton, creativeButton, createDevLockButton(slot));
    }
    list.append(card);
  }
}

const DEV_LOCK_KEY = "sharks-in-the-water-dev-lock";
const DEV_LOCK_ANSWER = "dev.0";

function isDevLockUnlocked(): boolean {
  return localStorage.getItem(DEV_LOCK_KEY) === "true";
}

function createDevLockButton(slot: number): HTMLButtonElement {
  if (isDevLockUnlocked()) {
    const hackerButton = createSlotButton("New Hacker", () => createSave(slot, "hacker"));
    hackerButton.dataset["mode"] = "hacker";
    return hackerButton;
  }

  const lockButton = createSlotButton("\u{1F512}", openDevLockDialog);
  lockButton.dataset["action"] = "dev-lock";
  lockButton.setAttribute("aria-label", "Locked developer option");
  return lockButton;
}

function openDevLockDialog(): void {
  const dialog = document.getElementById("dev-lock-dialog");
  const input = document.getElementById("dev-lock-input");
  const error = document.getElementById("dev-lock-error");
  if (!(dialog instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;
  input.value = "";
  if (error) error.hidden = true;
  dialog.hidden = false;
  window.setTimeout(() => input.focus(), 0);
}

function closeDevLockDialog(): void {
  const dialog = document.getElementById("dev-lock-dialog");
  if (dialog) dialog.hidden = true;
}

function submitDevLockAnswer(): void {
  const input = document.getElementById("dev-lock-input");
  const error = document.getElementById("dev-lock-error");
  if (!(input instanceof HTMLInputElement)) return;

  if (input.value.trim().toLowerCase() !== DEV_LOCK_ANSWER) {
    // Every other name — including "Oscar" — is refused.
    if (error) error.hidden = false;
    input.value = "";
    input.focus();
    return;
  }

  localStorage.setItem(DEV_LOCK_KEY, "true");
  closeDevLockDialog();
  renderSaveSlots();
}

function createSlotButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function createSave(slot: number, kind: SaveKind): void {
  openNamingDialog({ kind: "create", slot, saveKind: kind }, `Save ${slot}`, "Home Raft");
}

function sanitizeName(value: string | null | undefined, fallback: string): string {
  const cleaned = value?.replace(/\s+/g, " ").trim().slice(0, 24);
  return cleaned || fallback;
}

const randomSaveNames = [
  "Shark Watch", "Ocean Quest", "Stormy Voyage", "Deep Blue Adventure", "Crate Hunter",
  "Sunken Secrets", "The Long Float", "Reef Expedition", "Snack Run", "Beyond the Horizon",
];
const randomRaftNames = [
  "The Unsinkable", "Planky", "Shark Botherer", "The Wobbly Deck", "Crate Magnet",
  "Coconut Cruiser", "The Salty Splinter", "Rafty McRaftface", "Sea Pancake", "The Brave Board",
];

function openNamingDialog(action: NamingAction, initialSaveName: string, initialRaftName: string): void {
  pendingNamingAction = action;
  const dialog = document.getElementById("naming-dialog");
  const saveInput = document.getElementById("save-name-input");
  const raftInput = document.getElementById("raft-name-input");
  if (!(dialog instanceof HTMLFormElement) || !(saveInput instanceof HTMLInputElement) || !(raftInput instanceof HTMLInputElement)) return;
  saveInput.value = initialSaveName;
  raftInput.value = initialRaftName;
  dialog.hidden = false;
  window.setTimeout(() => saveInput.select(), 0);
}

function closeNamingDialog(): void {
  pendingNamingAction = null;
  const dialog = document.getElementById("naming-dialog");
  if (dialog) dialog.hidden = true;
}

function randomizeVoyageName(target: "save" | "raft"): void {
  const choices = target === "save" ? randomSaveNames : randomRaftNames;
  const input = document.getElementById(target === "save" ? "save-name-input" : "raft-name-input");
  if (!(input instanceof HTMLInputElement)) return;
  let nextName = choices[Math.floor(Math.random() * choices.length)] ?? (target === "save" ? "Ocean Quest" : "The Unsinkable");
  if (choices.length > 1 && nextName === input.value) {
    const currentIndex = choices.indexOf(nextName);
    nextName = choices[(currentIndex + 1) % choices.length] ?? nextName;
  }
  input.value = nextName;
  input.focus();
}

function finishNamingVoyage(): void {
  const action = pendingNamingAction;
  const saveInput = document.getElementById("save-name-input");
  const raftInput = document.getElementById("raft-name-input");
  if (!action || !(saveInput instanceof HTMLInputElement) || !(raftInput instanceof HTMLInputElement)) return;
  const fallbackSaveName = action.kind === "create" ? `Save ${action.slot}` : saveFileName;
  const nextSaveName = sanitizeName(saveInput.value, fallbackSaveName);
  const nextRaftName = sanitizeName(raftInput.value, "Home Raft");
  closeNamingDialog();

  if (action.kind === "create") {
    currentSaveSlot = action.slot;
    isHacker = action.saveKind === "hacker";
    // Hacker voyages open in creative and can be flipped to survival any time.
    gameKind = action.saveKind === "survival" ? "survival" : "creative";
    saveFileName = nextSaveName;
    raftName = nextRaftName;
    saveSelected = true;
    document.getElementById("save-selector")?.setAttribute("hidden", "");
    startGame();
    return;
  }
  if (action.kind === "stored") {
    const saveKey = getSaveKey(action.slot);
    const data = parseSave(localStorage.getItem(saveKey));
    if (data) localStorage.setItem(saveKey, JSON.stringify({ ...data, saveFileName: nextSaveName, raftName: nextRaftName }));
    renderSaveSlots();
    return;
  }
  saveFileName = nextSaveName;
  raftName = nextRaftName;
  saveGame();
  showMessage(`NOW SAILING: ${raftName.toUpperCase()}`, 3);
}

function renameStoredVoyage(slot: number): void {
  const saveKey = getSaveKey(slot);
  const raw = localStorage.getItem(saveKey);
  const data = parseSave(raw);
  if (!data) return;
  const currentSaveName = sanitizeName(data.saveFileName, `Save ${slot}`);
  const currentRaftName = sanitizeName(data.raftName, "Home Raft");
  openNamingDialog({ kind: "stored", slot }, currentSaveName, currentRaftName);
}

function renameCurrentVoyage(): void {
  if (mode !== "paused" || !saveSelected) return;
  openNamingDialog({ kind: "current" }, saveFileName, raftName);
}

function continueSave(slot: number): void {
  currentSaveSlot = slot;
  saveSelected = true;
  document.getElementById("save-selector")?.setAttribute("hidden", "");
  restoreAutosave();
}

function deleteSave(slot: number): void {
  localStorage.removeItem(getSaveKey(slot));
  localStorage.removeItem(getBackupSaveKey(slot));
  renderSaveSlots();
}

function retrieveLastSave(slot: number): void {
  const saveKey = getSaveKey(slot);
  const backupKey = getBackupSaveKey(slot);
  const currentRaw = localStorage.getItem(saveKey);
  const backupRaw = localStorage.getItem(backupKey);
  if (!backupRaw || !parseSave(backupRaw)) return;
  localStorage.setItem(saveKey, backupRaw);
  if (currentRaw && parseSave(currentRaw)) localStorage.setItem(backupKey, currentRaw);
  renderSaveSlots();
}

function openSaveSelector(): void {
  if (!saveSelected) return;
  saveGame();
  mode = "paused";
  saveSelected = false;
  changelogOpen = false;
  fishIndexOpen = false;
  mapOpen = false;
  craftingOpen = false;
  storageOpen = false;
  shopOpen = false;
  timeWarperOpen = false;
  creativeCrateMenuOpen = false;
  fishingUntil = 0;
  keys.clear();
  renderSaveSlots();
  const selector = document.getElementById("save-selector");
  if (selector) selector.hidden = false;
  updatePauseButton();
  updateShopkeeperButton();
  updateTerrainButton();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
}

function keyToDirection(key: string): Direction | null {
  const normalized = key.toLowerCase();
  if (normalized === "arrowup" || normalized === "w") return "up";
  if (normalized === "arrowdown" || normalized === "s") return "down";
  if (normalized === "arrowleft" || normalized === "a") return "left";
  if (normalized === "arrowright" || normalized === "d") return "right";
  return null;
}

function startGame(): void {
  mode = "playing";
  elapsed = 0;
  nextSupplyAt = 0;
  nextRandomAt = 25 + Math.random() * 15;
  progressionIndex = 0;
  crates = [];
  carriedCrates = [];
  particles = [];
  speedBoostHeld = false;
  inventory.clear();
  chestInventory.clear();
  chestFoodHealing.length = 0;
  foodHealing.length = 0;
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.hearts = gameKind === "creative" ? MAX_HEARTS : 3;
  maxHearts = gameKind === "creative" ? MAX_HEARTS : 3;
  player.invincibleUntil = 0;
  shark.x = 110;
  shark.y = 120;
  shark.biteCooldownUntil = 0;
  sharkDeleted = false;
  homeRaftDeleted = false;
  shopkeeperDeleted = false;
  hudDeleted = false;
  oceanDeleted = false;
  playerDeleted = false;
  sinkVelocity = 0;
  deletedIslands.clear();
  for (const selector of deletedGuiSelectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) element.style.removeProperty("display");
  }
  deletedGuiSelectors.clear();
  hasCraftingTable = gameKind === "creative";
  craftingTableLevel = gameKind === "creative" ? TECHNO_CRAFTING_LEVEL : 0;
  hasCargoDock = false;
  cargoShipCount = 0;
  cargoShips = [];
  hasScoldBot = false;
  hasSuperScoldBot = false;
  nextScoldAt = SCOLD_BOT_INTERVAL;
  scoldBubbleUntil = 0;
  scoldBeamUntil = 0;
  scoldMessage = "";
  scoldTarget = null;
  hasStorageCompartment = false;
  collectorBotCount = 0;
  collectorBots = [];
  collectorDrops = [];
  nextCollectorRunAt = COLLECTOR_INTERVAL;
  craftingOpen = false;
  craftingAutomationPage = false;
  sharkDecoyUntil = 0;
  shieldUntil = 0;
  raftLevel = 1;
  expansionCount = 0;
  endgameUnlocked = gameKind === "creative";
  bridgesBuilt = 0;
  coconutReadyAt = ISLANDS.map(() => 0);
  restoredAutosave = false;
  changelogOpen = false;
  fishIndexOpen = false;
  mapOpen = false;
  hasHuntingSpear = false;
  spearDurability = 0;
  hasFishingRod = false;
  hasFisherBot = false;
  nextAutoFishAt = FISHER_BOT_INTERVAL;
  fisherBotCatches = [];
  hasTimeWarper = false;
  timeWarperOpen = false;
  timeSnapshots = [];
  nextTimeSnapshotAt = 0;
  cosmicTimeYears = PRESENT_UNIVERSE_AGE;
  pastSelfEcho = null;
  creativeCrateMenuOpen = false;
  fishCollection.clear();
  fishingUntil = 0;
  terrainGenerators = 0;
  terrainLevel = 0;
  terrainAnimationUntil = 0;
  sunkenRafts = [];
  extraSharks = [];
  animalReadyAt = ISLANDS.map(() => 0);
  chestCount = 0;
  storageOpen = false;
  sharkFleeUntil = 0;
  nextShopkeeperAt = SHOPKEEPER_INTERVAL;
  shopkeeperUntil = 0;
  shopOpen = false;
  showMessage("WOOD SUPPLY DROP! Swim out and get it.", 4);
  spawnSupplyCrate();
  if (pendingMultiplayerState) applyMultiplayerState(pendingMultiplayerState);
  updatePauseButton();
  updateShopkeeperButton();
  updateTerrainButton();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
  updateStorageControls();
  if (multiplayerConnected && multiplayerIsHost) saveGame();
}

function togglePause(): void {
  if (mode === "playing") {
    mode = "paused";
    keys.clear();
    speedBoostHeld = false;
    fishingUntil = 0;
    craftingOpen = false;
    storageOpen = false;
    shopOpen = false;
    timeWarperOpen = false;
    creativeCrateMenuOpen = false;
    updateStorageControls();
  } else if (mode === "paused") {
    mode = "playing";
    changelogOpen = false;
    fishIndexOpen = false;
    mapOpen = false;
  } else {
    return;
  }
  updatePauseButton();
  updateShopkeeperButton();
  updateTerrainButton();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
}

function updatePauseButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='pause']");
  if (!button) return;
  button.textContent = mode === "paused" ? "Resume" : "Pause";
  button.setAttribute("aria-label", mode === "paused" ? "Resume game" : "Pause game");
  const changelogButton = document.querySelector<HTMLButtonElement>("[data-action='changelog']");
  if (changelogButton) {
    changelogButton.hidden = mode !== "paused";
    changelogButton.textContent = changelogOpen ? "Close History" : "Changelog";
    changelogButton.setAttribute("aria-label", changelogOpen ? "Close changelog" : "Open changelog");
  }
  const changelogPanel = document.getElementById("changelog-panel");
  if (changelogPanel) changelogPanel.hidden = mode !== "paused" || !changelogOpen;
  const fishIndexButton = document.querySelector<HTMLButtonElement>("[data-action='fish-index']");
  if (fishIndexButton) {
    fishIndexButton.hidden = mode !== "paused";
    fishIndexButton.textContent = fishIndexOpen ? "Close Index" : isNightmareLevel() ? "Drowned Index" : "Fish Index";
    fishIndexButton.setAttribute("aria-label", fishIndexOpen ? "Close fish index" : "Open fish index");
  }
  const fishIndexPanel = document.getElementById("fish-index-panel");
  if (fishIndexPanel) fishIndexPanel.hidden = mode !== "paused" || !fishIndexOpen;
  const mapButton = document.querySelector<HTMLButtonElement>("[data-action='map']");
  if (mapButton) {
    mapButton.hidden = mode !== "paused";
    mapButton.textContent = mapOpen ? "Close Map" : "View Map";
    mapButton.setAttribute("aria-label", mapOpen ? "Close full map" : "View full map");
  }
  const renameButton = document.querySelector<HTMLButtonElement>("[data-action='rename']");
  if (renameButton) renameButton.hidden = mode !== "paused" || !saveSelected;
  const saveFilesButton = document.querySelector<HTMLButtonElement>("[data-action='save-files']");
  if (saveFilesButton) saveFilesButton.hidden = mode !== "paused" || !saveSelected;
}

function toggleChangelog(): void {
  if (mode !== "paused") return;
  changelogOpen = !changelogOpen;
  if (changelogOpen) {
    fishIndexOpen = false;
    mapOpen = false;
  }
  updatePauseButton();
}

function toggleFishIndex(): void {
  if (mode !== "paused") return;
  fishIndexOpen = !fishIndexOpen;
  if (fishIndexOpen) {
    changelogOpen = false;
    mapOpen = false;
    renderFishIndex();
  }
  updatePauseButton();
}

function toggleMap(): void {
  if (mode !== "paused") return;
  mapOpen = !mapOpen;
  if (mapOpen) {
    changelogOpen = false;
    fishIndexOpen = false;
  }
  updatePauseButton();
}

function renderFishIndex(): void {
  const list = document.getElementById("fish-index-list");
  const progress = document.getElementById("fish-index-progress");
  if (!list) return;
  list.replaceChildren();
  let unlockedSpecies = 0;
  for (const fish of fishCatches) {
    const count = fishCollection.get(fish.name) ?? 0;
    const unlocked = gameKind === "creative" || count > 0;
    if (unlocked) unlockedSpecies += 1;
    const item = document.createElement("li");
    const picture = createFishPicture(fish, unlocked);
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const countLabel = document.createElement("span");
    item.className = `fish-index-card${unlocked ? "" : " locked"}`;
    item.style.setProperty("--fish-color", fish.color);
    title.textContent = unlocked ? fish.name : "??? Undiscovered ???";
    description.textContent = unlocked
      ? isNightmareLevel()
        ? getNightmareFishDescription(fish.name)
        : fish.description
      : isNightmareLevel()
        ? "It has not shown its face yet. It knows you are looking."
        : "This mysterious water resident refuses to provide a biography.";
    countLabel.className = "fish-count";
    countLabel.textContent = isNightmareLevel()
      ? count === 0 ? "It is already in the index" : `Taken from the water ×${count}`
      : gameKind === "creative" && count === 0 ? "Unlocked by Creative Mode" : `Caught ×${count}`;
    item.append(picture, title, description, countLabel);
    list.append(item);
  }
  if (progress) {
    progress.textContent = isNightmareLevel()
      ? `The Drowned Index remembers all ${fishCatches.length} names. Some are still moving.`
      : gameKind === "creative"
      ? `Creative collection complete — all ${fishCatches.length} species unlocked!`
      : `${unlockedSpecies}/${fishCatches.length} species discovered • ${getTotalFishCaught()} total catches`;
  }
}

function createFishPicture(fish: FishCatch, unlocked: boolean): HTMLDivElement {
  const picture = document.createElement("div");
  const slug = fish.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
  picture.className = `fish-picture fish-${slug}${unlocked ? "" : " locked-picture"}`;
  picture.setAttribute("role", "img");
  picture.setAttribute("aria-label", unlocked ? `Picture of ${fish.name}` : "Silhouette of an undiscovered fish");
  for (const className of ["fish-tail", "fish-body", "fish-eye", "fish-ornament", "fish-pixel fish-pixel-one", "fish-pixel fish-pixel-two", "fish-pixel fish-pixel-three"]) {
    const part = document.createElement("span");
    part.className = className;
    picture.append(part);
  }
  if (fish.name === "Glitched Fish" && unlocked) {
    picture.addEventListener("dragover", (event) => {
      if (!picture.classList.contains("toaster-mode")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      picture.classList.add("bread-drop-ready");
    });
    picture.addEventListener("dragleave", () => picture.classList.remove("bread-drop-ready"));
    picture.addEventListener("drop", (event) => {
      if (!picture.classList.contains("toaster-mode") || event.dataTransfer?.getData("text/plain") !== "fish-index-bread") return;
      event.preventDefault();
      picture.classList.remove("bread-drop-ready", "toast-popped");
      picture.classList.add("toasting-bread", "toaster-mode");
      const progress = document.getElementById("fish-index-progress");
      if (progress) progress.textContent = isNightmareLevel() ? "The toothed machine is chewing. Do not interrupt it." : "The Glitched Toaster is processing the bread... probably safely.";
      window.setTimeout(() => {
        picture.classList.remove("toasting-bread");
        picture.classList.add("toast-popped");
        picture.dataset["toastClicks"] = "0";
        if (progress) progress.textContent = isNightmareLevel() ? "It came back wrong. Strike it 10 times before it notices you." : "Toast complete! Spam-click it 10 times before it escapes!";
      }, 1400);
    });
    picture.addEventListener("click", () => {
      if (!picture.classList.contains("toast-popped")) return;
      const clicks = Math.min(10, Number(picture.dataset["toastClicks"] ?? 0) + 1);
      picture.dataset["toastClicks"] = String(clicks);
      picture.classList.remove("toast-clicked");
      void picture.offsetWidth;
      picture.classList.add("toast-clicked");
      const progress = document.getElementById("fish-index-progress");
      if (progress) progress.textContent = `GLITCHED TOAST CLICKS: ${clicks}/10`;
      if (clicks >= 10) {
        localStorage.setItem(TOAST_ON_GAMES3_KEY, "true");
        if (isNightmareLevel()) localStorage.setItem(NIGHTMARE_TOAST_KEY, "true");
        else localStorage.removeItem(NIGHTMARE_TOAST_KEY);
        if (progress) progress.textContent = isNightmareLevel() ? "THE TOAST OPENED THE DOOR BEHIND YOU." : "THE TOAST KICKED YOU OUT OF THE GAME!";
        window.setTimeout(() => {
          window.location.href = "../index.html";
        }, 450);
      }
    });
  }
  return picture;
}

function getNightmareFishDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Common Cod": "It looks ordinary until every eye on its body opens at once.",
    "Tiny Sardine": "Something much larger keeps knocking from inside it.",
    "Blue Mackerel": "Its stripes move even when the fish does not.",
    Tuna: "It whispers your save-file number through clenched teeth.",
    Clownfish: "Its smile keeps widening after the joke has ended.",
    Pufferfish: "It is not full of air anymore.",
    Goldfish: "It remembers every player who failed to return to the raft.",
    Diamondfish: "Each crystal face reflects a different empty ocean.",
    Swordfish: "The blade is warm. The water around it is not.",
    Anglerfish: "The light above its head is signaling to something below.",
    Jellyfish: "Its transparent bell contains a shadow that is not its own.",
    "Old Boot": "There is still a footstep inside it.",
    Kingfish: "The crown chose it after the previous king disappeared.",
    "Rubber Duck": "It squeaks once for every heartbeat it hears.",
    "Pirate Fish": "Its missing eye is watching from somewhere else.",
    Icefish: "It freezes the water into shapes that resemble hands.",
    Lavafish: "Cracks in its scales glow like a door left open underground.",
    Godfish: "It created this red ocean and refuses to explain why.",
    Moonfish: "A second moon follows behind it, just beneath the surface.",
    Sunfish: "Its light casts shadows that point toward you.",
    Ghostfish: "It is the memory of a fish that never existed.",
    "Robot Fish": "Its final instruction is your name.",
    Voidfish: "The space inside it is getting closer.",
    "Glitched Fish": "It became a toaster because the other shape was worse.",
  };
  return descriptions[name] ?? "It should not be here.";
}

function renderFishIndexProgress(): void {
  const progress = document.getElementById("fish-index-progress");
  if (!progress) return;
  let unlockedSpecies = 0;
  for (const fish of fishCatches) {
    if (gameKind === "creative" || (fishCollection.get(fish.name) ?? 0) > 0) unlockedSpecies += 1;
  }
  progress.textContent = isNightmareLevel()
    ? `The Drowned Index remembers all ${fishCatches.length} names. Some are still moving.`
    : gameKind === "creative"
    ? `Creative collection complete — all ${fishCatches.length} species unlocked!`
    : `${unlockedSpecies}/${fishCatches.length} species discovered • ${getTotalFishCaught()} total catches`;
}

function updateShopkeeper(): void {
  if (gameKind === "creative") return;
  if (shopkeeperUntil > 0 && elapsed >= shopkeeperUntil) {
    shopkeeperUntil = 0;
    shopOpen = false;
    showMessage("THE TECHNOLOGY MERCHANT SAILS AWAY. BACK IN THREE MINUTES!", 4);
    updateShopkeeperButton();
    saveGame();
  }
  if (shopkeeperUntil === 0 && elapsed >= nextShopkeeperAt) {
    shopkeeperUntil = elapsed + SHOPKEEPER_VISIT_LENGTH;
    nextShopkeeperAt = elapsed + SHOPKEEPER_INTERVAL;
    showMessage("THE TECHNOLOGY MERCHANT HAS DOCKED FOR ONE MINUTE!", 5);
    updateShopkeeperButton();
    saveGame();
  }
}

function isShopkeeperHere(): boolean {
  if (shopkeeperDeleted) return false;
  return gameKind === "creative" || shopkeeperUntil > elapsed;
}

function toggleShop(): void {
  if (mode !== "playing") return;
  if (!isShopkeeperHere()) {
    showMessage(`The shopkeeper arrives in ${formatTime(Math.max(0, Math.ceil(nextShopkeeperAt - elapsed)))}.`, 3);
    return;
  }
  if (!isOnRaftNetwork(player.x, player.y)) {
    showMessage("Stand on the raft, cargo pickup, a bridge, or an island to trade.", 3);
    return;
  }
  shopOpen = !shopOpen;
  craftingOpen = false;
  storageOpen = false;
  timeWarperOpen = false;
  creativeCrateMenuOpen = false;
  keys.clear();
  updateShopkeeperButton();
  updateStorageControls();
}

function handleShopButton(): void {
  toggleShop();
}

function updateShopkeeperButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='shop']");
  if (!button) return;
  button.hidden = mode !== "playing" || !isShopkeeperHere();
  button.textContent = shopOpen ? "Close Shop" : "Shop";
  button.setAttribute("aria-label", shopOpen ? "Close traveling shop" : "Open traveling shop");
}

function getGoldenHeartCost(): number {
  return (maxHearts - 2) * 10;
}

function getTotalFoodCount(): number {
  return gameKind === "creative" ? Number.POSITIVE_INFINITY : foodHealing.length + chestFoodHealing.length;
}

function buyGoldenHeart(): void {
  if (!shopOpen || !isShopkeeperHere()) return;
  if (maxHearts >= MAX_HEARTS) {
    showMessage("You already have the maximum of 10 hearts.", 3);
    return;
  }
  const cost = getGoldenHeartCost();
  if (getTotalFoodCount() < cost) {
    showMessage(`You need ${cost} pieces of food for the next golden heart.`, 3);
    return;
  }
  consumeFoodPieces(cost);
  maxHearts += 1;
  player.hearts = Math.min(maxHearts, player.hearts + 1);
  showMessage(`GOLDEN HEART BOUGHT! MAX HEARTS: ${maxHearts}`, 4);
  saveGame();
}

function buyShopOffer(offer: number): void {
  if (!shopOpen || !isShopkeeperHere()) return;
  const beforePurchase = JSON.stringify({
    food: getTotalFoodCount(),
    inventory: [...inventory],
    maxHearts,
    hasHuntingSpear,
    hasFishingRod,
    terrainGenerators,
    hasTimeWarper,
  });
  if (offer === 1) {
    buyGoldenHeart();
  } else if (offer === 2) buyMaterialPack("Wood", 10, 5);
  else if (offer === 3) buyMaterialPack("Stone", 8, 5);
  else if (offer === 4) buyMaterialPack("Technology Shards", 5, 10);
  else if (offer === 5) buyShopSpear();
  else if (offer === 6) buyFishingRod();
  else if (offer === 7) buyMetalPack();
  else if (offer === 8) buyTerrainGenerator();
  else if (offer === 9) buyTimeWarper();
  const afterPurchase = JSON.stringify({
    food: getTotalFoodCount(),
    inventory: [...inventory],
    maxHearts,
    hasHuntingSpear,
    hasFishingRod,
    terrainGenerators,
    hasTimeWarper,
  });
  const offerNames = ["GOLDEN HEART", "WOOD PACK", "STONE PACK", "TECH PACK", "HUNTING SPEAR", "FISHING ROD", "METAL PACK", "TERRAIN GENERATOR", "TIME WARPER"];
  if (beforePurchase !== afterPurchase) broadcastMultiplayerNotice(`BOUGHT ${offerNames[offer - 1] ?? "SHOP SUPPLIES"}!`);
}

function buyTimeWarper(): void {
  if (hasTimeWarper) {
    showMessage("The Time Warper is already installed on your raft.", 3);
    return;
  }
  if (!spendItem("Technology Shards", 20)) {
    showMessage("The Time Warper machine costs 20 Technology Shards.", 3);
    return;
  }
  hasTimeWarper = true;
  updateTimeWarperButton();
  showMessage("TIME WARPER INSTALLED! EACH TRIP COSTS 10 TECHNOLOGY SHARDS.", 5);
  saveGame();
}

function buyTerrainGenerator(): void {
  if (!spendItem("Technology Shards", 1)) {
    showMessage("You need 1 Technology Shard for a Terrain Generator.", 3);
    return;
  }
  terrainGenerators += 1;
  updateTerrainButton();
  showMessage("TERRAIN GENERATOR BOUGHT! PRESS G OR USE THE BUTTON TO ACTIVATE IT.", 4);
  saveGame();
}

function useTerrainGenerator(): void {
  if (mode !== "playing" || craftingOpen || storageOpen || shopOpen || timeWarperOpen || creativeCrateMenuOpen) return;
  if (gameKind !== "creative" && terrainGenerators <= 0) {
    showMessage("Buy a Terrain Generator from the traveling shop first.", 3);
    return;
  }
  if (gameKind !== "creative") terrainGenerators -= 1;
  terrainLevel += 1;
  terrainAnimationUntil = elapsed + 3.2;
  extraSharks = [];
  const unsinkTime = gameKind === "creative" ? SUNKEN_RAFT_CREATIVE_TIME : SUNKEN_RAFT_SURVIVAL_TIME;
  for (let count = 0; count < RAFTS_PER_TERRAIN_GENERATOR && sunkenRafts.length < MAX_SUNKEN_RAFTS; count += 1) {
    sunkenRafts.push(createSunkenRaft(sunkenRafts.length, elapsed + unsinkTime));
  }
  updateTerrainButton();
  showMessage(
    `TERRAIN GENERATED! ${sunkenRafts.length} RAFTS DETECTED — SURFACING IN ${gameKind === "creative" ? "5 SECONDS" : "3 MINUTES"}.`,
    5
  );
  burst(WIDTH / 2, HEIGHT / 2, "#72f5ff", 60);
  saveGame();
  broadcastMultiplayerNotice("USED A TERRAIN GENERATOR!");
}

function createSunkenRaft(index: number, raisedAt: number): SunkenRaft {
  const ring = Math.floor(index / 6);
  const angle = (index % 6) * Math.PI / 3 + 0.28 + ring * 0.31;
  return {
    x: WIDTH / 2 + Math.cos(angle) * (620 + ring * 230),
    y: HEIGHT / 2 + Math.sin(angle) * (400 + ring * 145),
    width: 132 + (index % 3) * 16,
    height: 82 + (index % 2) * 12,
    raisedAt,
    bridgeBuilt: false,
    bobOffset: index * 1.7,
  };
}

function toggleTimeWarper(): void {
  if (mode !== "playing" || !hasTimeWarper) return;
  if (!timeWarperOpen && !isOnRaft(player.x, player.y)) {
    showMessage("Stand on your main raft to use the Time Warper machine.", 3);
    return;
  }
  timeWarperOpen = !timeWarperOpen;
  creativeCrateMenuOpen = false;
  craftingOpen = false;
  storageOpen = false;
  shopOpen = false;
  keys.clear();
  updateShopkeeperButton();
  updateStorageControls();
  updateTimeWarperButton();
}

function updateTimeWarperButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='time-warper']");
  if (!button) return;
  button.hidden = mode !== "playing" || !hasTimeWarper;
  button.textContent = timeWarperOpen ? "Close Warper" : "Time Warper";
}

function useTimeWarper(choice: number): void {
  if (!timeWarperOpen || choice < 1 || choice > 9) return;
  if (!spendItem("Technology Shards", TIME_WARPER_ACTIVATION_COST)) {
    showMessage("A time trip costs 10 Technology Shards.", 3);
    return;
  }
  const shortSeconds = choice === 3 ? -180 : choice === 4 ? -10 : choice === 5 ? 10 : choice === 6 ? 180 : 0;
  if (shortSeconds >= 0) pastSelfEcho = null;
  if (shortSeconds < 0) {
    const departure = { x: player.x, y: player.y };
    const targetTime = Math.max(0, elapsed + shortSeconds);
    const snapshot = [...timeSnapshots].reverse().find((entry) => entry.elapsed <= targetTime);
    if (!snapshot) {
      addItem("Technology Shards", TIME_WARPER_ACTIVATION_COST);
      showMessage("That moment is not in the Time Warper's recorded history yet.", 4);
      return;
    }
    const echoPath = timeSnapshots
      .filter((entry) => entry.elapsed >= snapshot.elapsed && entry.elapsed <= snapshot.elapsed + 12)
      .map((entry) => ({ time: entry.elapsed, x: entry.playerX, y: entry.playerY }));
    applyTimeSnapshot(snapshot);
    player.x = departure.x;
    player.y = departure.y;
    pastSelfEcho = {
      path: echoPath,
      fallbackX: snapshot.playerX,
      fallbackY: snapshot.playerY,
      expiresAt: elapsed + 18,
    };
    timeSnapshots = timeSnapshots.filter((entry) => entry.elapsed <= elapsed);
    showMessage(`REWOUND ${formatTime(Math.abs(shortSeconds))}! FOLLOW THE ARROW TO FIND PAST YOU.`, 6);
  } else if (shortSeconds > 0) {
    elapsed += shortSeconds;
    showMessage(`JUMPED ${formatTime(shortSeconds)} INTO THE FUTURE! TIMERS HAVE ADVANCED.`, 5);
  } else if (choice === 1) {
    cosmicTimeYears = 0;
    showMessage("DESTINATION: THE BIG BANG — THE FIRST MOMENT OF EVERYTHING!", 6);
  } else if (choice === 2) {
    cosmicTimeYears = Math.max(0, cosmicTimeYears - BILLION_YEARS);
    showMessage(`TRAVELED ONE BILLION YEARS INTO THE PAST — ${formatCosmicAge(cosmicTimeYears)}.`, 5);
  } else if (choice === 7) {
    cosmicTimeYears = Math.min(BIG_CRUNCH_YEAR, cosmicTimeYears + BILLION_YEARS);
    for (const wreck of sunkenRafts) wreck.raisedAt = Math.min(wreck.raisedAt, elapsed);
    showMessage(`TRAVELED ONE BILLION YEARS INTO THE FUTURE — ${formatCosmicAge(cosmicTimeYears)}.`, 5);
  } else if (choice === 8) {
    cosmicTimeYears = PRESENT_UNIVERSE_AGE;
    showMessage("RETURNED TO THE PRESENT UNIVERSE.", 5);
  } else if (choice === 9) {
    cosmicTimeYears = BIG_CRUNCH_YEAR;
    for (const wreck of sunkenRafts) wreck.raisedAt = Math.min(wreck.raisedAt, elapsed);
    showMessage("DESTINATION: THE BIG CRUNCH — THE LAST MOMENT OF EVERYTHING!", 6);
  }
  timeWarperOpen = false;
  nextTimeSnapshotAt = elapsed;
  recordTimeSnapshot(true);
  updateTimeWarperButton();
  saveGame();
}

function recordTimeSnapshot(force = false): void {
  if (!force && elapsed < nextTimeSnapshotAt) return;
  nextTimeSnapshotAt = elapsed + 1;
  timeSnapshots.push({
    elapsed,
    playerX: player.x,
    playerY: player.y,
    hearts: player.hearts,
    raftLevel,
    expansionCount,
    endgameUnlocked,
    bridgesBuilt,
    sunkenRafts: sunkenRafts.map((wreck) => ({ ...wreck })),
    crates: crates.map((crate) => ({ ...crate, material: crate.material ? { ...crate.material } : undefined })),
    carriedCrates: carriedCrates.map((crate) => ({ ...crate, material: crate.material ? { ...crate.material } : undefined })),
    shark: { ...shark },
    extraSharks: extraSharks.map((hunter) => ({ ...hunter })),
    nextSupplyAt,
    nextRandomAt,
  });
  const oldestAllowed = elapsed - TIME_HISTORY_SECONDS;
  timeSnapshots = timeSnapshots.filter((entry) => entry.elapsed >= oldestAllowed);
}

function applyTimeSnapshot(snapshot: TimeSnapshot): void {
  elapsed = snapshot.elapsed;
  player.x = snapshot.playerX;
  player.y = snapshot.playerY;
  player.hearts = snapshot.hearts;
  raftLevel = snapshot.raftLevel;
  expansionCount = snapshot.expansionCount;
  endgameUnlocked = snapshot.endgameUnlocked;
  bridgesBuilt = snapshot.bridgesBuilt;
  sunkenRafts = snapshot.sunkenRafts.map((wreck) => ({ ...wreck }));
  crates = snapshot.crates.map((crate) => ({ ...crate, material: crate.material ? { ...crate.material } : undefined }));
  carriedCrates = snapshot.carriedCrates.map((crate) => ({ ...crate, material: crate.material ? { ...crate.material } : undefined }));
  Object.assign(shark, snapshot.shark);
  extraSharks = snapshot.extraSharks.map((hunter) => ({ ...hunter }));
  nextSupplyAt = snapshot.nextSupplyAt;
  nextRandomAt = snapshot.nextRandomAt;
}

function getTimeWarperChoiceAt(x: number, y: number): number {
  const columns = [85, 355, 625];
  const rows = [190, 300, 410];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const left = columns[column] ?? 0;
      const top = rows[row] ?? 0;
      if (x >= left && x <= left + 250 && y >= top && y <= top + 82) return row * 3 + column + 1;
    }
  }
  return 0;
}

function formatCosmicAge(years: number): string {
  if (years <= 0) return "BIG BANG";
  if (years >= BIG_CRUNCH_YEAR) return "BIG CRUNCH";
  return `${(years / BILLION_YEARS).toFixed(1)} BILLION YEARS OLD`;
}

function updateTerrainButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='terrain']");
  if (!button) return;
  button.hidden = mode !== "playing" || (gameKind !== "creative" && terrainGenerators <= 0);
  button.textContent = gameKind === "creative" ? "Use Generator ∞" : `Use Generator ×${terrainGenerators}`;
}

function buyMetalPack(): void {
  const foodCost = 25;
  if (getTotalFoodCount() < foodCost) {
    showMessage(`You need ${foodCost} food for the Metal Pack.`, 3);
    return;
  }
  const personalRoom = Math.max(0, STACK_LIMIT - (inventory.get("Iron") ?? 0))
    + Math.max(0, STACK_LIMIT - (inventory.get("Steel") ?? 0));
  const chestRoom = Math.max(0, getChestCapacity() - getChestUsed());
  if (gameKind !== "creative" && personalRoom + chestRoom < 100) {
    showMessage("Make room for 50 Iron and 50 Steel before buying the Metal Pack.", 4);
    return;
  }
  consumeFoodPieces(foodCost);
  addItem("Iron", 50);
  addItem("Steel", 50);
  showMessage("METAL PACK BOUGHT! +50 IRON AND +50 STEEL!", 4);
  saveGame();
}

function buyMaterialPack(name: string, amount: number, foodCost: number): void {
  if (getTotalFoodCount() < foodCost) {
    showMessage(`You need ${foodCost} food for the ${name} pack.`, 3);
    return;
  }
  const personalRoom = Math.max(0, STACK_LIMIT - (inventory.get(name) ?? 0));
  const chestRoom = Math.max(0, getChestCapacity() - getChestUsed());
  if (gameKind !== "creative" && personalRoom + chestRoom < amount) {
    showMessage(`Make room in your inventory or chests for ${amount} ${name}.`, 3);
    return;
  }
  consumeFoodPieces(foodCost);
  addItem(name, amount);
  showMessage(`BOUGHT ${amount} ${name.toUpperCase()} FOR ${foodCost} FOOD!`, 3.5);
  saveGame();
}

function buyShopSpear(): void {
  const foodCost = 15;
  if (hasHuntingSpear && spearDurability >= SPEAR_MAX_DURABILITY) {
    showMessage("Your hunting spear is already at full durability.", 3);
    return;
  }
  if (getTotalFoodCount() < foodCost) {
    showMessage(`You need ${foodCost} food for a hunting spear.`, 3);
    return;
  }
  consumeFoodPieces(foodCost);
  hasHuntingSpear = true;
  spearDurability = SPEAR_MAX_DURABILITY;
  showMessage(`HUNTING SPEAR READY! ${SPEAR_MAX_DURABILITY} USES AVAILABLE.`, 3.5);
  saveGame();
}

function buyFishingRod(): void {
  if (hasFishingRod) {
    showMessage("You already own a fishing rod.", 3);
    return;
  }
  if (getTotalFoodCount() < FISHING_ROD_COST) {
    showMessage(`You need ${FISHING_ROD_COST} food for a fishing rod.`, 3);
    return;
  }
  consumeFoodPieces(FISHING_ROD_COST);
  hasFishingRod = true;
  showMessage("FISHING ROD BOUGHT! STAND SOMEWHERE SAFE AND PRESS R.", 4);
  saveGame();
}

function getShopOfferAt(x: number, y: number): number {
  const cards = [
    { offer: 1, x: 85, y: 190 },
    { offer: 2, x: 355, y: 190 },
    { offer: 3, x: 625, y: 190 },
    { offer: 4, x: 85, y: 300 },
    { offer: 5, x: 355, y: 300 },
    { offer: 6, x: 625, y: 300 },
    { offer: 7, x: 85, y: 410 },
    { offer: 8, x: 355, y: 410 },
    { offer: 9, x: 625, y: 410 },
  ];
  return cards.find((card) => x >= card.x && x <= card.x + 250 && y >= card.y && y <= card.y + 95)?.offer ?? 0;
}

function consumeFoodPieces(amount: number): void {
  if (gameKind === "creative") return;
  let remaining = amount;
  while (remaining > 0 && foodHealing.length > 0) {
    foodHealing.pop();
    remaining -= 1;
  }
  while (remaining > 0 && chestFoodHealing.length > 0) {
    chestFoodHealing.pop();
    remaining -= 1;
  }
  inventory.set("Food", foodHealing.length);
}

function startFishing(): void {
  if (mode !== "playing") return;
  if (craftingOpen || storageOpen || shopOpen || timeWarperOpen || creativeCrateMenuOpen) {
    showMessage("Close the current screen before fishing.", 2.5);
    return;
  }
  if (!hasFishingRod) {
    showMessage("Buy a fishing rod from the traveling shop first.", 3);
    return;
  }
  if (fishingUntil > elapsed) {
    showMessage(`Your line is already cast — ${Math.ceil(fishingUntil - elapsed)} seconds left.`, 2.5);
    return;
  }
  if (!isInSafeZone(player.x, player.y)) {
    showMessage("Stand on the raft, a bridge, or an island to fish safely.", 3);
    return;
  }
  fishingBobber = findFishingWater();
  fishingUntil = elapsed + 3;
  speedBoostHeld = false;
  keys.clear();
  showMessage("LINE CAST! WAIT FOR A BITE...", 3);
}

function findFishingWater(): { x: number; y: number } {
  for (let radius = 55; radius <= 260; radius += 25) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      const x = clamp(player.x + Math.cos(angle) * radius, 24, WIDTH - 24);
      const y = clamp(player.y + Math.sin(angle) * radius, 96, HEIGHT - 24);
      if (!isInSafeZone(x, y)) return { x, y };
    }
  }
  return { x: clamp(player.x + 70, 24, WIDTH - 24), y: clamp(player.y + 50, 96, HEIGHT - 24) };
}

function finishFishing(): void {
  fishingUntil = 0;
  const creativeFishNames = new Set(["Goldfish", "Diamondfish", "Kingfish", "Godfish", "Glitched Fish"]);
  const creativePool = fishCatches.filter((fish) => creativeFishNames.has(fish.name));
  let caught: FishCatch | undefined;
  if (gameKind === "creative") {
    caught = creativePool[Math.floor(Math.random() * creativePool.length)];
  } else {
    const totalWeight = fishCatches.reduce((sum, fish) => sum + fish.weight, 0);
    let roll = Math.random() * totalWeight;
    caught = fishCatches.find((fish) => {
      roll -= fish.weight;
      return roll <= 0;
    }) ?? fishCatches[0];
  }
  if (!caught) return;
  fishCollection.set(caught.name, (fishCollection.get(caught.name) ?? 0) + 1);
  fisherBotCatches.push(caught.name);

  let rewardMessage = "+1 snack";
  if (caught.reward === "snack") addFood(1, 1);
  if (caught.reward === "snacks") {
    const snacks = caught.name === "Goldfish" ? 3 : 2;
    addFood(1, snacks);
    rewardMessage = `+${snacks} snacks`;
  }
  if (caught.reward === "meal") {
    addFood(99, 1);
    rewardMessage = "+1 full-heal meal";
  }
  if (caught.reward === "king") {
    addFood(99, 1);
    addItem("Gold", 2);
    rewardMessage = "+1 meal and +2 Gold";
  }
  if (caught.reward === "duck") {
    addItem("Technology Shards", 3);
    rewardMessage = "+3 Technology Shards";
  }
  if (caught.reward === "god") {
    addFood(99, 2);
    addItem("God Material", 1);
    rewardMessage = "+2 meals and +1 God Material";
  }
  if (caught.reward === "glitched") {
    addFood(99, 1);
    addItem("Infernal Material", 2);
    addItem("Technology Shards", 5);
    rewardMessage = "+1 meal, +2 Infernal, and +5 Tech";
  }
  showMessage(`CAUGHT: ${caught.name.toUpperCase()}! ${rewardMessage}`, 5);
  burst(fishingBobber.x, fishingBobber.y, caught.color, 24);
  saveGame();
}

function getTotalFishCaught(): number {
  let total = 0;
  for (const amount of fishCollection.values()) total += amount;
  return total;
}

function update(dt: number): void {
  if (mode === "paused") return;
  updateWater(dt);
  updateParticles(dt);
  if (mode !== "playing") return;

  elapsed += dt;
  recordTimeSnapshot();
  if (gameKind === "creative") player.hearts = maxHearts;
  updateShopkeeper();
  if (fishingUntil > 0 && elapsed >= fishingUntil) finishFishing();
  if (!craftingOpen && !storageOpen && !shopOpen && !timeWarperOpen && !creativeCrateMenuOpen && fishingUntil <= elapsed) updatePlayer(dt);
  if (multiplayerRoomCode && elapsed >= lastMultiplayerPositionAt + 0.1) {
    lastMultiplayerPositionAt = elapsed;
    sendMultiplayerMessage("position", { x: player.x, y: player.y });
  }
  depositCarriedCrates();
  updateScoldBot();
  updateFisherBot();
  if (isWorldAuthority()) {
    updateShark(dt);
    updateExtraSharks(dt);
    if (elapsed >= nextSupplyAt) {
      spawnSupplyCrate();
    }
    if (elapsed >= nextRandomAt) {
      spawnRandomCrate();
      nextRandomAt = elapsed + 32 + Math.random() * 28;
    }
    broadcastWorldSync();
  } else {
    followSyncedShark(dt);
  }

  updateCargoShips(dt);
  updateCollectorBots(dt);
  collectCrates();
  collectCollectorDrops();
}

function updateScoldBot(): void {
  if (!hasScoldBot || elapsed < nextScoldAt) return;
  const hunters = [shark, ...extraSharks];
  const bot = getScoldBotPosition();
  scoldTarget = hunters.sort(
    (a, b) => distance(bot.x, bot.y, a.x, a.y) - distance(bot.x, bot.y, b.x, b.y)
  )[0] ?? shark;
  const scoldings = isNightmareLevel()
    ? hasSuperScoldBot
      ? ["THE OCEAN REJECTS YOU ALL.", "EVERY HUNGER WILL RETREAT.", "SILENCE, ABYSS."]
      : ["BACK TO THE DEEP.", "YOU ARE NOT WELCOME.", "BE STILL, HUNGER."]
    : hasSuperScoldBot
      ? ["ALL OF YOU: OCEAN TIME-OUT!", "203 SHARKS? ABSOLUTELY NOT!", "EVERYBODY SHOO! RIGHT NOW!", "MEGAPHONE SAYS: NO BITING!"]
      : ["BAD SHARK! GO AWAY!", "NO BITING!", "LEAVE MY HUMAN ALONE!", "SHOO! OCEAN TIME-OUT!"];
  scoldMessage = scoldings[Math.floor(Math.random() * scoldings.length)] ?? "BAD SHARK!";
  scoldBubbleUntil = elapsed + 3.5;
  scoldBeamUntil = elapsed + (hasSuperScoldBot ? 0.9 : 0.45);
  // Emo sharks consider stern words painfully mainstream. The beam and speech bubble
  // still fire, but they no longer flee, move, or pause their attacks for either bot.
  burst(scoldTarget.x, scoldTarget.y, isNightmareLevel() ? "#681020" : "#272334", 12);
  nextScoldAt = elapsed + (hasSuperScoldBot ? SUPER_SCOLD_BOT_INTERVAL : SCOLD_BOT_INTERVAL);
}

function syncCargoShips(): void {
  if (!hasCargoDock) {
    cargoShips = [];
    return;
  }
  while (cargoShips.length < cargoShipCount) {
    const index = cargoShips.length;
    const slot = getCargoShipDockSlot(index, cargoShipCount);
    cargoShips.push({
      x: slot.x,
      y: slot.y,
      state: "docked",
      target: null,
      cargo: null,
      bobOffset: Math.random() * 10,
    });
  }
  if (cargoShips.length > cargoShipCount) cargoShips.length = cargoShipCount;
}

function updateCargoShips(dt: number): void {
  if (!hasCargoDock || cargoShipCount === 0) return;
  syncCargoShips();
  const claimed = new Set(cargoShips.map((ship) => ship.target).filter((crate): crate is FloatingCrate => crate !== null));
  const dock = getCargoDockPosition();
  cargoShips.forEach((ship, shipIndex) => {
    const slot = getCargoShipDockSlot(shipIndex, cargoShips.length);
    if (ship.state === "docked") {
      const target = crates
        .filter((crate) => !crate.deliveredByCargoShip && !claimed.has(crate))
        .sort((a, b) => distance(ship.x, ship.y, a.x, a.y) - distance(ship.x, ship.y, b.x, b.y))[0];
      if (target) {
        ship.target = target;
        ship.state = "collecting";
        claimed.add(target);
      } else {
        moveCargoShipToward(ship, slot.x, slot.y, dt, 65);
      }
      return;
    }
    if (ship.state === "collecting") {
      const target = ship.target;
      if (!target || !crates.includes(target)) {
        ship.target = null;
        ship.state = "docked";
        return;
      }
      if (moveCargoShipToward(ship, target.x, target.y, dt, 105)) {
        const crateIndex = crates.indexOf(target);
        if (crateIndex >= 0) crates.splice(crateIndex, 1);
        ship.cargo = target;
        ship.target = null;
        ship.state = "returning";
        burst(ship.x, ship.y, crateColor(target), 10);
        saveGame();
      }
      return;
    }
    if (moveCargoShipToward(ship, slot.x, slot.y, dt, 90)) {
      const cargo = ship.cargo;
      if (cargo) {
        const deliveredCount = crates.filter((crate) => crate.deliveredByCargoShip).length;
        const dockStackPosition = deliveredCount % 10;
        crates.push({
          ...cargo,
          x: dock.x - 54 + (dockStackPosition % 5) * 27,
          y: dock.y - 13 + Math.floor(dockStackPosition / 5) * 25,
          deliveredByCargoShip: true,
          landedAt: elapsed - 3,
          bobOffset: 0,
        });
        burst(dock.x, dock.y, crateColor(cargo), 14);
        showMessage(isNightmareLevel() ? "A HOLLOW SHIP LEFT SOMETHING AT THE BLACK DOCK." : "CARGO SHIP DELIVERED A CRATE TO THE DOCK!", 3.5);
        saveGame();
      }
      ship.cargo = null;
      ship.state = "docked";
    }
  });
}

function moveCargoShipToward(ship: CargoShip, targetX: number, targetY: number, dt: number, speed: number): boolean {
  const dx = targetX - ship.x;
  const dy = targetY - ship.y;
  const remaining = Math.hypot(dx, dy);
  if (remaining <= Math.max(4, speed * dt)) {
    ship.x = targetX;
    ship.y = targetY;
    return true;
  }
  ship.x += (dx / remaining) * speed * dt;
  ship.y += (dy / remaining) * speed * dt;
  return false;
}

function updateWater(dt: number): void {
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(bubble.y * 0.02) * 5 * dt;
    if (bubble.y < -10) {
      bubble.y = HEIGHT + 10;
      bubble.x = Math.random() * WIDTH;
    }
  }
}

function updateParticles(dt: number): void {
  particles = particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 45 * dt;
    particle.life -= dt;
    return particle.life > 0;
  });
}

function updatePlayer(dt: number): void {
  let dx = Number(keys.has("right")) - Number(keys.has("left"));
  let dy = Number(keys.has("down")) - Number(keys.has("up"));
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  const normalSpeed = isInSafeZone(player.x, player.y) ? 190 : 128;
  const speed = normalSpeed * (speedBoostHeld ? 1.75 : 1);
  const terrainMargin = terrainLevel > 0 ? Math.min(900, 500 + terrainLevel * 120) : 0;
  const rightBoundary = (isIslandUnlocked() ? WIDTH - 20 : 720) + terrainMargin;
  player.x = clamp(player.x + dx * speed * dt, 20 - terrainMargin, rightBoundary);

  if (oceanDeleted && !isInSafeZone(player.x, player.y)) {
    // With the water deleted there is nothing holding you up.
    sinkVelocity += 950 * dt;
    player.y += dy * speed * dt + sinkVelocity * dt;
    if (player.y > HEIGHT + 160) fallIntoTheVoid();
    return;
  }

  sinkVelocity = 0;
  player.y = clamp(player.y + dy * speed * dt, 78 - terrainMargin, HEIGHT - 20 + terrainMargin);
}

function fallIntoTheVoid(): void {
  sinkVelocity = 0;
  const lostCrates = loseCarriedCrates();
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.invincibleUntil = elapsed + 1.5;
  burst(player.x, player.y, "#8ff9f5", 34);
  if (gameKind === "creative") {
    showMessage("YOU FELL THROUGH THE MISSING WATER!", 3.8);
    return;
  }
  player.hearts -= 1;
  showMessage(
    lostCrates > 0
      ? `YOU FELL THROUGH THE MISSING WATER! LOST ${lostCrates} CRATE${lostCrates === 1 ? "" : "S"}!`
      : "YOU FELL THROUGH THE MISSING WATER!",
    3.8
  );
  if (player.hearts <= 0) {
    mode = "gameOver";
    saveGame();
  }
}

const WORLD_SYNC_INTERVAL = 0.12;

// Small, frequent packets: just the shark poses and the crate list. The heavy
// full-save snapshot still goes out on saves, but rarely.
function broadcastWorldSync(): void {
  if (!multiplayerConnected || elapsed < lastWorldSyncAt + WORLD_SYNC_INTERVAL) return;
  lastWorldSyncAt = elapsed;
  const payload: WorldSyncPayload = {
    shark: { x: shark.x, y: shark.y, angle: shark.angle, speed: getSharkSpeed() },
    extraSharks: extraSharks.map((hunter) => ({ x: hunter.x, y: hunter.y, angle: hunter.angle })),
    crates: crates.map((crate) => ({ ...crate })),
    sharkDeleted,
  };
  sendMultiplayerMessage("world", payload);
}

function applyWorldSync(payload: WorldSyncPayload): void {
  sharkDeleted = payload.sharkDeleted;
  sharkNetPose = { ...payload.shark, at: elapsed };

  // Extra sharks are cheap and rarely numerous, so they just snap into place.
  extraSharks = payload.extraSharks.map((hunter) => ({ ...hunter, biteCooldownUntil: 0 }));

  // Crates are host-owned. Anything this player is already carrying stays
  // carried — it is no longer in the world list.
  crates = payload.crates.map((crate) => ({ ...crate }));
}

// Guest-side shark motion: keep swimming along the last known heading, and
// ease toward where the host says it should be. No teleporting, no stutter.
function followSyncedShark(dt: number): void {
  if (sharkDeleted || !sharkNetPose) return;
  // Only ever predict a short way ahead. Without this cap a delayed or dropped
  // update makes the guess run away and the shark shoots off the map.
  const since = clamp(elapsed - sharkNetPose.at, 0, WORLD_SYNC_INTERVAL * 3);
  const predictedX = sharkNetPose.x + Math.cos(sharkNetPose.angle) * sharkNetPose.speed * since;
  const predictedY = sharkNetPose.y + Math.sin(sharkNetPose.angle) * sharkNetPose.speed * since;
  const blend = Math.min(1, dt * 9);
  shark.x += (predictedX - shark.x) * blend;
  shark.y += (predictedY - shark.y) * blend;
  shark.angle += normalizeAngle(sharkNetPose.angle - shark.angle) * blend;
}

function getSharkSpeed(): number {
  const playerInWater = !isInSafeZone(player.x, player.y);
  return elapsed < sharkFleeUntil ? 145 : playerInWater && elapsed >= sharkDecoyUntil ? 84 + progressionIndex * 2 : 54;
}

function updateShark(dt: number): void {
  // A deleted shark stops thinking entirely and stays parked far outside the
  // arena, so it can never swim back into view.
  if (sharkDeleted) {
    shark.x = DELETED_ASSET_X;
    shark.y = DELETED_ASSET_Y;
    return;
  }
  let targetX: number;
  let targetY: number;
  const playerOnBridge = isOnBridge(player.x, player.y);
  const playerInWater = !isInSafeZone(player.x, player.y);

  if (elapsed < sharkFleeUntil) {
    targetX = shark.x < player.x ? 22 : WIDTH - 22;
    targetY = shark.y < player.y ? 88 : HEIGHT - 22;
  } else if (elapsed < sharkDecoyUntil) {
    targetX = 75;
    targetY = HEIGHT - 75;
  } else if (playerInWater) {
    targetX = player.x;
    targetY = player.y;
  } else {
    const orbit = elapsed * 0.55;
    targetX = WIDTH / 2 + Math.cos(orbit) * 300;
    targetY = HEIGHT / 2 + Math.sin(orbit) * 205;
  }

  const angle = Math.atan2(targetY - shark.y, targetX - shark.x);
  const turn = normalizeAngle(angle - shark.angle);
  shark.angle += clamp(turn, -2.8 * dt, 2.8 * dt);
  const speed = elapsed < sharkFleeUntil ? 145 : playerInWater && elapsed >= sharkDecoyUntil ? 84 + progressionIndex * 2 : 54;
  shark.x += Math.cos(shark.angle) * speed * dt;
  shark.y += Math.sin(shark.angle) * speed * dt;
  shark.x = clamp(shark.x, SHARK_EDGE_PADDING, isIslandUnlocked() ? WIDTH - SHARK_EDGE_PADDING : 730);
  shark.y = clamp(shark.y, 78 + SHARK_EDGE_PADDING, HEIGHT - SHARK_EDGE_PADDING);
  keepSharkOutOfRaft();
  keepSharkOutOfIsland();

  if (
    playerInWater &&
    !playerOnBridge &&
    distance(player.x, player.y, shark.x, shark.y) < 38 &&
    elapsed >= shark.biteCooldownUntil &&
    elapsed >= player.invincibleUntil &&
    elapsed >= sharkFleeUntil
  ) {
    handleSharkBite(shark);
  }
}

function updateExtraSharks(dt: number): void {
  const playerInWater = !isInSafeZone(player.x, player.y);
  extraSharks.forEach((hunter, index) => {
    const orbit = elapsed * (0.35 + index * 0.015) + index * 1.7;
    const fleeing = elapsed < sharkFleeUntil;
    const targetX = fleeing
      ? (hunter.x < player.x ? 20 : WIDTH - 20)
      : playerInWater ? player.x : WIDTH / 2 + Math.cos(orbit) * (260 + (index % 3) * 34);
    const targetY = fleeing
      ? (hunter.y < player.y ? 90 : HEIGHT - 20)
      : playerInWater ? player.y : HEIGHT / 2 + Math.sin(orbit) * (175 + (index % 2) * 24);
    const targetAngle = Math.atan2(targetY - hunter.y, targetX - hunter.x);
    hunter.angle += clamp(normalizeAngle(targetAngle - hunter.angle), -2.5 * dt, 2.5 * dt);
    const speed = fleeing ? 140 : playerInWater ? 70 + terrainLevel * 5 : 48 + (index % 3) * 4;
    hunter.x = clamp(hunter.x + Math.cos(hunter.angle) * speed * dt, SHARK_EDGE_PADDING, WIDTH - SHARK_EDGE_PADDING);
    hunter.y = clamp(hunter.y + Math.sin(hunter.angle) * speed * dt, 78 + SHARK_EDGE_PADDING, HEIGHT - SHARK_EDGE_PADDING);
    keepSharkOutOfRaft(hunter);
    keepSharkOutOfIsland(hunter);
    if (
      playerInWater
      && distance(player.x, player.y, hunter.x, hunter.y) < 38
      && elapsed >= hunter.biteCooldownUntil
      && elapsed >= player.invincibleUntil
      && elapsed >= sharkFleeUntil
    ) handleSharkBite(hunter);
  });
}

function handleSharkBite(attacker: SharkEntity): void {
  attacker.biteCooldownUntil = elapsed + 2.2;
  if (gameKind === "creative") {
    player.hearts = maxHearts;
    player.invincibleUntil = elapsed + 1.5;
    showMessage("CREATIVE MODE: THE SHARKS CANNOT HURT YOU!", 2.5);
    burst(attacker.x, attacker.y, "#d091ff", 18);
    return;
  }
  if (elapsed < shieldUntil) {
    shieldUntil = 0;
    showMessage("THE TECH SHIELD BLOCKED THE SHARK!", 2.4);
    burst(attacker.x, attacker.y, "#6ffaff", 20);
    return;
  }
  const lostCrates = loseCarriedCrates();
  player.hearts -= 1;
  player.invincibleUntil = elapsed + 1.5;
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  burst(attacker.x, attacker.y, "#ff7890", 20);
  showMessage(lostCrates > 0 ? `CHOMP! LOST ${lostCrates} CRATE${lostCrates === 1 ? "" : "S"}!` : "CHOMP! You scrambled back onto the raft.", 3.8);
  if (player.hearts <= 0) {
    mode = "gameOver";
    keys.clear();
  } else saveGame();
}

function spawnSupplyCrate(): void {
  if (isNightmareLevel()) {
    spawnBloodCrate();
    nextSupplyAt = elapsed + SUPPLY_INTERVAL;
    showMessage("A BLOOD CRATE HAS RISEN FROM THE WATER.", 4);
    return;
  }
  const scriptedMaterial = materialProgression[progressionIndex];
  const material =
    scriptedMaterial ??
    (endgameUnlocked
      ? chooseEndlessMaterial()
      : materialProgression[materialProgression.length - 1]);
  if (!material) return;
  const position = randomWaterPosition();
  crates.push({ x: position.x, y: position.y, kind: "supply", material, landedAt: elapsed, bobOffset: Math.random() * 10 });
  if (scriptedMaterial) progressionIndex += 1;
  nextSupplyAt = elapsed + SUPPLY_INTERVAL;
  if (progressionIndex > 1 || endgameUnlocked) showMessage(`${material.name.toUpperCase()} SUPPLY DROP!`, 3);
}

function chooseEndlessMaterial(): MaterialDrop | undefined {
  const totalWeight = endlessMaterialWeights.reduce((total, weight) => total + weight, 0);
  let roll = Math.random() * totalWeight;
  for (let index = 0; index < endlessMaterials.length; index += 1) {
    roll -= endlessMaterialWeights[index] ?? 0;
    if (roll < 0) return endlessMaterials[index];
  }
  return endlessMaterials[0];
}

function spawnRandomCrate(): void {
  if (isNightmareLevel()) {
    spawnBloodCrate();
    showMessage("ANOTHER BLOOD CRATE IS WATCHING YOU.", 4);
    return;
  }
  const roll = Math.random();
  const kind: CrateKind = roll < 0.002 ? "super" : roll < 0.012 ? "rainbow" : roll < 0.506 ? "wooden" : "technology";
  const position = randomWaterPosition();
  crates.push({ x: position.x, y: position.y, kind, landedAt: elapsed, bobOffset: Math.random() * 10 });
  showMessage(
    kind === "super"
      ? "THE RAREST SUPER CRATE HAS APPEARED!"
      : kind === "rainbow"
        ? "A RAINBOW CRATE IS SHINING IN THE WATER!"
        : kind === "wooden" ? "RANDOM WOODEN CRATE SPOTTED!" : "TECHNOLOGY CRATE SPOTTED!",
    kind === "super" || kind === "rainbow" ? 6 : 3
  );
}

function toggleCreativeCrateMenu(): void {
  if (mode !== "playing") return;
  creativeCrateMenuOpen = !creativeCrateMenuOpen;
  craftingOpen = false;
  storageOpen = false;
  shopOpen = false;
  timeWarperOpen = false;
  keys.clear();
  updateShopkeeperButton();
  updateStorageControls();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
}

function updateCreativeCrateSpawnerButton(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='crate-spawner']");
  if (!button) return;
  updateHackerUi();
  button.hidden = mode !== "playing";
  button.textContent = creativeCrateMenuOpen ? "Close Crates" : gameKind === "creative" ? "Crate Spawner" : "Crate Shop";
  button.setAttribute("aria-label", creativeCrateMenuOpen ? "Close crate menu" : gameKind === "creative" ? "Open crate spawner" : "Open survival crate shop");
}

function spawnCreativeCrate(choice: number): void {
  if (!creativeCrateMenuOpen) return;
  const kinds: CrateKind[] = ["supply", "wooden", "technology", "blood", "rainbow", "super"];
  const survivalCosts = [5, 10, 20, 35, 50, 100];
  const kind = kinds[choice - 1];
  if (!kind) return;
  const cost = survivalCosts[choice - 1] ?? 0;
  if (gameKind !== "creative") {
    if (getTotalFoodCount() < cost) {
      showMessage(`YOU NEED ${cost} FOOD FOR A ${kind.toUpperCase()} CRATE.`, 3);
      return;
    }
    consumeFoodPieces(cost);
  }
  const position = nearbyCreativeCratePosition();
  const material = kind === "supply"
    ? materialProgression[Math.min(progressionIndex, materialProgression.length - 1)] ?? chooseEndlessMaterial()
    : undefined;
  crates.push({
    x: position.x,
    y: position.y,
    kind,
    ...(material ? { material } : {}),
    landedAt: elapsed,
    bobOffset: Math.random() * 10,
  });
  showMessage(
    gameKind === "creative"
      ? `CREATIVE ${kind.toUpperCase()} CRATE SPAWNED NEAR YOU!`
      : `${kind.toUpperCase()} CRATE BOUGHT FOR ${cost} FOOD!`,
    3
  );
  saveGame();
}

function nearbyCreativeCratePosition(): { x: number; y: number } {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = attempt * Math.PI * 2 / 12 + elapsed;
    const candidate = { x: player.x + Math.cos(angle) * 115, y: player.y + Math.sin(angle) * 115 };
    if (!isInSafeZone(candidate.x, candidate.y)) return candidate;
  }
  return { x: player.x + 115, y: player.y };
}

function getCreativeCrateChoiceAt(x: number, y: number): number {
  const columns = [85, 355, 625];
  const rows = [220, 355];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const left = columns[column] ?? 0;
      const top = rows[row] ?? 0;
      if (x >= left && x <= left + 250 && y >= top && y <= top + 95) return row * 3 + column + 1;
    }
  }
  return 0;
}

const HACKER_STACK = 999999;
// Far outside the arena and outside every clamp, so a deleted asset is gone for good.
const DELETED_ASSET_X = -999999;
const DELETED_ASSET_Y = -999999;

function toggleHackerPanel(): void {
  if (!isHacker || mode !== "playing") return;
  hackerPanelOpen = !hackerPanelOpen;
  craftingOpen = false;
  storageOpen = false;
  shopOpen = false;
  timeWarperOpen = false;
  creativeCrateMenuOpen = false;
  keys.clear();
  updateShopkeeperButton();
  updateStorageControls();
  updateTimeWarperButton();
  updateCreativeCrateSpawnerButton();
  updateHackerUi();
}

function closeHackerPanel(): void {
  // An armed tool survives closing the panel — you have to close it to reach
  // the world you are about to tap.
  hackerPanelOpen = false;
  updateHackerUi();
}

function updateHackerUi(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='hacker']");
  if (button) {
    button.hidden = !isHacker || mode !== "playing";
    button.textContent = hackerPanelOpen
      ? "Close Hacker"
      : hackerTool === "copy"
        ? "Copying…"
        : hackerTool === "delete"
          ? "Deleting…"
          : hackerTool === "gui"
            ? "Deleting GUI…"
            : "Hacker";
    button.classList.toggle("is-armed", hackerTool !== "none");
  }

  const panel = document.getElementById("hacker-panel");
  if (panel) panel.hidden = !hackerPanelOpen;

  const modeNote = document.getElementById("hacker-mode-note");
  if (modeNote) modeNote.textContent = `Currently: ${gameKind === "creative" ? "Creative" : "Survival"}`;

  const swapButton = document.querySelector<HTMLButtonElement>("[data-action='hacker-swap-mode']");
  if (swapButton) swapButton.textContent = gameKind === "creative" ? "Switch to Survival" : "Switch to Creative";

  const copyButton = document.querySelector<HTMLButtonElement>("[data-action='hacker-copy']");
  if (copyButton) copyButton.textContent = hackerTool === "copy" ? "Copy Tool — TAP A THING" : "Copy Tool";

  const deleteButton = document.querySelector<HTMLButtonElement>("[data-action='hacker-delete']");
  if (deleteButton) deleteButton.textContent = hackerTool === "delete" ? "Delete Tool — TAP A THING" : "Delete Tool";

  const guiButton = document.querySelector<HTMLButtonElement>("[data-action='hacker-gui']");
  if (guiButton) guiButton.textContent = hackerTool === "gui" ? "Delete GUI — TAP A BUTTON" : "Delete GUI Tool";

  const clipboardNote = document.getElementById("hacker-clipboard-note");
  if (clipboardNote) clipboardNote.textContent = describeHackerClipboard();
}

function describeHackerClipboard(): string {
  if (!hackerClipboard) return "Clipboard is empty.";
  if (hackerClipboard.kind === "crate") return `Copied: ${hackerClipboard.crate.kind} crate.`;
  if (hackerClipboard.kind === "raft") return "Copied: a raft platform.";
  if (hackerClipboard.kind === "build") return `Copied: ${hackerClipboard.label.toLowerCase()}.`;
  return "Copied: a shark.";
}

function swapHackerMode(): void {
  if (!isHacker) return;
  gameKind = gameKind === "creative" ? "survival" : "creative";
  if (gameKind === "creative") {
    maxHearts = MAX_HEARTS;
    player.hearts = MAX_HEARTS;
    endgameUnlocked = true;
    hasCraftingTable = true;
    craftingTableLevel = TECHNO_CRAFTING_LEVEL;
  }
  showMessage(`HACKER: SWITCHED TO ${gameKind.toUpperCase()} MODE!`, 3);
  updateHackerUi();
  updateTerrainButton();
  updateShopkeeperButton();
  updateCreativeCrateSpawnerButton();
  saveGame();
}

function spawnHackerCrate(): void {
  if (!isHacker) return;
  const position = nearbyCreativeCratePosition();
  crates.push({ x: position.x, y: position.y, kind: "hacker", landedAt: elapsed, bobOffset: Math.random() * 10 });
  showMessage("HACKER CRATE SPAWNED — OWNER ONLY!", 3);
  saveGame();
}

function grantHackerCrate(): void {
  const materialNames = new Set(endlessMaterials.map((material) => material.name));
  materialNames.add("Technology Shards");
  for (const name of materialNames) inventory.set(name, HACKER_STACK);
  // foodHealing is a real array, so the stack stays sane while FOOD still reads as endless.
  while (foodHealing.length < 500) foodHealing.push(99);
  inventory.set("Food", foodHealing.length);
  terrainGenerators = HACKER_STACK;
  maxHearts = MAX_HEARTS;
  player.hearts = MAX_HEARTS;
  hasCraftingTable = true;
  craftingTableLevel = TECHNO_CRAFTING_LEVEL;
  endgameUnlocked = true;
}

function nukeShopkeeper(): void {
  if (!isHacker) return;
  if (shopkeeperDeleted) {
    showMessage("THE SHOPKEEPER IS ALREADY GONE.", 3);
    return;
  }
  // Zeroing the visit timer alone does nothing in Creative, where the shop is
  // always open — the nuke has to take the shopkeeper out for good.
  shopkeeperDeleted = true;
  shopkeeperUntil = 0;
  nextShopkeeperAt = elapsed + SHOPKEEPER_INTERVAL;
  shopOpen = false;
  burst(690, 320, "#ff5738", 90);
  burst(690, 300, "#ffd65c", 60);
  showMessage("HACKER: SHOPKEEPER NUKED!", 4);
  updateShopkeeperButton();
  saveGame();
}

function duplicateRaft(): void {
  if (!isHacker) return;
  if (sunkenRafts.length >= MAX_SUNKEN_RAFTS) {
    showMessage("NO ROOM FOR ANOTHER RAFT COPY.", 3);
    return;
  }
  pushHackerRaft(120 + Math.min(70, expansionCount * 14), 90 + Math.min(70, expansionCount * 14));
  showMessage("HACKER: RAFT DUPLICATED!", 3);
  saveGame();
}

function pushHackerRaft(width: number, height: number): void {
  sunkenRafts.push({
    x: clamp(player.x + 150, 90, WIDTH - 90),
    y: clamp(player.y, 130, HEIGHT - 110),
    width,
    height,
    raisedAt: elapsed,
    bridgeBuilt: true,
    bridgeSourceKind: "main",
    bobOffset: Math.random() * 10,
  });
}

function setHackerTool(tool: HackerTool): void {
  if (!isHacker) return;
  hackerTool = hackerTool === tool ? "none" : tool;
  // Picking a tool gets the panel out of the way so the world is tappable.
  if (hackerTool !== "none") hackerPanelOpen = false;
  showMessage(
    hackerTool === "none"
      ? "HACKER TOOL OFF."
      : hackerTool === "copy"
        ? "COPY TOOL ON — TAP ANYTHING."
        : hackerTool === "gui"
          ? "GUI TOOL ON — TAP ANY BUTTON OR THE HUD."
          : "DELETE TOOL ON — TAP ANYTHING.",
    3
  );
  updateHackerUi();
}

function pasteHackerClipboard(): void {
  if (!isHacker) return;
  if (!hackerClipboard) {
    showMessage("CLIPBOARD IS EMPTY — COPY SOMETHING FIRST.", 3);
    return;
  }
  if (hackerClipboard.kind === "crate") {
    const position = nearbyCreativeCratePosition();
    const source = hackerClipboard.crate;
    crates.push({
      x: position.x,
      y: position.y,
      kind: source.kind,
      ...(source.material ? { material: source.material } : {}),
      landedAt: elapsed,
      bobOffset: Math.random() * 10,
    });
    showMessage(`PASTED A ${source.kind.toUpperCase()} CRATE!`, 3);
  } else if (hackerClipboard.kind === "raft") {
    if (sunkenRafts.length >= MAX_SUNKEN_RAFTS) {
      showMessage("NO ROOM FOR ANOTHER RAFT COPY.", 3);
      return;
    }
    pushHackerRaft(hackerClipboard.width, hackerClipboard.height);
    showMessage("PASTED A RAFT PLATFORM!", 3);
  } else if (hackerClipboard.kind === "shark") {
    extraSharks.push({
      x: clamp(player.x + 170, 60, WIDTH - 60),
      y: clamp(player.y - 60, 110, HEIGHT - 70),
      angle: 0,
      biteCooldownUntil: 0,
    });
    showMessage("PASTED A SHARK. GOOD LUCK.", 3);
  } else {
    pasteHackerBuild(hackerClipboard.build);
    showMessage(`PASTED A ${hackerClipboard.label}!`, 3);
  }
  saveGame();
}

function pasteHackerBuild(build: HackerBuild): void {
  if (build === "chest") chestCount += 1;
  else if (build === "crafting-table") {
    hasCraftingTable = true;
    craftingTableLevel = Math.max(1, craftingTableLevel);
  } else if (build === "storage") hasStorageCompartment = true;
  else if (build === "cargo-dock") hasCargoDock = true;
  else if (build === "cargo-ship") {
    hasCargoDock = true;
    if (cargoShipCount < MAX_CARGO_SHIPS) {
      cargoShipCount += 1;
      const dock = getCargoDockPosition();
      cargoShips.push({ x: dock.x, y: dock.y, state: "docked", target: null, cargo: null, bobOffset: Math.random() * 10 });
    }
  } else if (build === "collector-bot") {
    if (collectorBotCount < MAX_COLLECTOR_BOTS) {
      collectorBotCount += 1;
      const home = getCollectorBotHome(collectorBotCount - 1, collectorBotCount);
      collectorBots.push({
        x: home.x,
        y: home.y,
        state: "idle",
        targetIslandIndex: -1,
        waypoints: [],
        waypointIndex: 0,
        cargo: null,
        harvestUntil: 0,
        stepOffset: Math.random() * 10,
      });
    }
  } else if (build === "scold-bot") hasScoldBot = true;
  else if (build === "fisher-bot") hasFisherBot = true;
  else hasTimeWarper = true;

  updateStorageControls();
  updateTimeWarperButton();
}

interface HackerTarget {
  label: string;
  x: number;
  y: number;
  hit: boolean;
  isFallback?: boolean;
  clipboard?: HackerClipboard;
  remove: () => void;
}

// Everything the delete/copy tools can grab, most specific first so a bot on
// the raft wins over the raft underneath it.
function collectHackerTargets(worldX: number, worldY: number): HackerTarget[] {
  const near = (x: number, y: number, radius: number): boolean => distance(worldX, worldY, x, y) < radius;
  const inBox = (x: number, y: number, width: number, height: number): boolean =>
    worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height;
  const raft = getRaftBounds();
  const targets: HackerTarget[] = [];

  crates.forEach((crate, index) => {
    targets.push({
      label: `${crate.kind.toUpperCase()} CRATE`,
      x: crate.x,
      y: crate.y,
      hit: near(crate.x, crate.y, 42),
      clipboard: { kind: "crate", crate: { ...crate } },
      remove: () => crates.splice(index, 1),
    });
  });

  cargoShips.forEach((ship, index) => {
    targets.push({
      label: "CARGO SHIP",
      x: ship.x,
      y: ship.y,
      hit: near(ship.x, ship.y, 46),
      clipboard: { kind: "build", build: "cargo-ship", label: "CARGO SHIP" },
      remove: () => cargoShips.splice(index, 1),
    });
  });

  collectorBots.forEach((bot, index) => {
    targets.push({
      label: "COLLECTOR BOT",
      x: bot.x,
      y: bot.y,
      hit: near(bot.x, bot.y, 26),
      clipboard: { kind: "build", build: "collector-bot", label: "COLLECTOR BOT" },
      remove: () => {
        collectorBots.splice(index, 1);
        collectorBotCount = Math.max(0, collectorBotCount - 1);
      },
    });
  });

  if (hasScoldBot) {
    const scold = getScoldBotPosition();
    targets.push({
      label: "SCOLD BOT",
      x: scold.x,
      y: scold.y,
      hit: near(scold.x, scold.y, 34),
      clipboard: { kind: "build", build: "scold-bot", label: "SCOLD BOT" },
      remove: () => {
        hasScoldBot = false;
        hasSuperScoldBot = false;
        scoldTarget = null;
      },
    });
  }

  if (hasFisherBot) {
    const fisher = getFisherBotPosition();
    targets.push({
      label: "FISHER BOT",
      x: fisher.x,
      y: fisher.y,
      hit: near(fisher.x, fisher.y, 32),
      clipboard: { kind: "build", build: "fisher-bot", label: "FISHER BOT" },
      remove: () => {
        hasFisherBot = false;
        fisherBotCatches = [];
      },
    });
  }

  if (hasTimeWarper) {
    const warperX = raft.x + raft.width - 92;
    const warperY = raft.y + raft.height - 48;
    targets.push({
      label: "TIME WARPER",
      x: warperX,
      y: warperY,
      hit: near(warperX, warperY, 36),
      clipboard: { kind: "build", build: "time-warper", label: "TIME WARPER" },
      remove: () => {
        hasTimeWarper = false;
        timeWarperOpen = false;
      },
    });
  }

  if (hasCraftingTable) {
    targets.push({
      label: "CRAFTING TABLE",
      x: raft.x + 57,
      y: raft.y + 57,
      hit: inBox(raft.x + 24, raft.y + 29, 66, 56),
      clipboard: { kind: "build", build: "crafting-table", label: "CRAFTING TABLE" },
      remove: () => {
        hasCraftingTable = false;
        craftingTableLevel = 0;
        craftingOpen = false;
      },
    });
  }

  for (let index = 0; index < Math.min(chestCount, 4); index += 1) {
    const chestX = raft.x + raft.width - 76 - (index % 2) * 50;
    const chestY = raft.y + 30 + Math.floor(index / 2) * 44;
    targets.push({
      label: "CHEST",
      x: chestX + 21,
      y: chestY + 15,
      hit: inBox(chestX, chestY, 42, 30),
      clipboard: { kind: "build", build: "chest", label: "CHEST" },
      remove: () => {
        chestCount = Math.max(0, chestCount - 1);
        if (chestCount === 0) storageOpen = false;
      },
    });
  }

  if (hasStorageCompartment) {
    const mini = getStorageMiniRaftBounds();
    targets.push({
      label: "STORAGE COMPARTMENT",
      x: mini.x + mini.width / 2,
      y: mini.y + mini.height / 2,
      hit: inBox(mini.x, mini.y, mini.width, mini.height),
      clipboard: { kind: "build", build: "storage", label: "STORAGE COMPARTMENT" },
      remove: () => {
        hasStorageCompartment = false;
        storageOpen = false;
      },
    });
  }

  if (hasCargoDock) {
    const dock = getCargoDockPosition();
    targets.push({
      label: "CARGO DOCK",
      x: dock.x,
      y: dock.y,
      hit: near(dock.x, dock.y, 46),
      clipboard: { kind: "build", build: "cargo-dock", label: "CARGO DOCK" },
      remove: () => {
        hasCargoDock = false;
        cargoShips = [];
        cargoShipCount = 0;
      },
    });
  }

  if (!shopkeeperDeleted && isShopkeeperHere()) {
    targets.push({
      label: "SHOPKEEPER",
      x: 690,
      y: 320,
      hit: near(690, 320, 64),
      remove: () => {
        shopkeeperDeleted = true;
        shopkeeperUntil = 0;
        shopOpen = false;
      },
    });
  }

  sunkenRafts.forEach((wreck, index) => {
    if (!wreck.bridgeBuilt || elapsed < wreck.raisedAt) return;
    const segment = getSunkenRaftBridgeSegment(wreck);
    const midX = (segment.start.x + segment.end.x) / 2;
    const midY = (segment.start.y + segment.end.y) / 2;
    targets.push({
      label: "BRIDGE",
      x: midX,
      y: midY,
      hit: near(midX, midY, 26),
      remove: () => {
        const target = sunkenRafts[index];
        if (target) target.bridgeBuilt = false;
      },
    });
  });

  if (isIslandUnlocked()) {
    ISLANDS.slice(0, bridgesBuilt).forEach((island, index) => {
      if (!isIslandVisible(island) || deletedIslands.has(index)) return;
      const segment = getBridgeSegment(island);
      const midX = (segment.start.x + segment.end.x) / 2;
      const midY = (segment.start.y + segment.end.y) / 2;
      targets.push({
        label: "ISLAND BRIDGE",
        x: midX,
        y: midY,
        hit: near(midX, midY, 26),
        remove: () => {
          bridgesBuilt = Math.min(bridgesBuilt, index);
        },
      });
    });
  }

  sunkenRafts.forEach((wreck, index) => {
    targets.push({
      label: "RAFT PLATFORM",
      x: wreck.x,
      y: wreck.y,
      hit: Math.abs(worldX - wreck.x) < wreck.width / 2 + 12 && Math.abs(worldY - wreck.y) < wreck.height / 2 + 12,
      clipboard: { kind: "raft", width: wreck.width, height: wreck.height },
      remove: () => sunkenRafts.splice(index, 1),
    });
  });

  ISLANDS.forEach((island, index) => {
    if (deletedIslands.has(index) || !isIslandVisible(island)) return;
    targets.push({
      label: island.name.toUpperCase(),
      x: island.x,
      y: island.y,
      hit: isInsideIsland(worldX, worldY, island),
      remove: () => {
        deletedIslands.add(index);
        bridgesBuilt = Math.min(bridgesBuilt, index);
      },
    });
  });

  extraSharks.forEach((hunter, index) => {
    targets.push({
      label: "SHARK",
      x: hunter.x,
      y: hunter.y,
      hit: near(hunter.x, hunter.y, 48),
      clipboard: { kind: "shark" },
      remove: () => extraSharks.splice(index, 1),
    });
  });

  if (!sharkDeleted) {
    targets.push({
      label: "SHARK",
      x: shark.x,
      y: shark.y,
      hit: near(shark.x, shark.y, 48),
      clipboard: { kind: "shark" },
      remove: () => {
        sharkDeleted = true;
        shark.x = DELETED_ASSET_X;
        shark.y = DELETED_ASSET_Y;
      },
    });
  }

  if (!playerDeleted) {
    targets.push({
      label: "YOURSELF",
      x: player.x,
      y: player.y,
      hit: near(player.x, player.y, 30),
      remove: () => {
        playerDeleted = true;
      },
    });
  }

  if (!homeRaftDeleted) {
    targets.push({
      label: "HOME RAFT",
      x: raft.x + raft.width / 2,
      y: raft.y + raft.height / 2,
      hit: inBox(raft.x, raft.y, raft.width, raft.height),
      clipboard: { kind: "raft", width: raft.width, height: raft.height },
      remove: () => {
        homeRaftDeleted = true;
      },
    });
  }

  // Last resort: open sea. Tapping nothing in particular deletes the water.
  // Flagged so it never steals a near-miss away from a real target.
  if (!oceanDeleted) {
    targets.push({
      label: "THE WATER",
      x: worldX,
      y: worldY,
      hit: true,
      isFallback: true,
      remove: () => {
        oceanDeleted = true;
      },
    });
  }

  return targets;
}

function useHackerToolAt(worldX: number, worldY: number): boolean {
  if (!isHacker || hackerTool === "none" || hackerTool === "gui") return false;

  const hits = collectHackerTargets(worldX, worldY).filter((candidate) => candidate.hit);
  // Real targets always beat the open-water fallback, and the closest one wins
  // so a tap between two things grabs the one you actually aimed at. Copying
  // ignores the water entirely — it has nothing to put on the clipboard.
  const real = hits.filter((candidate) => !candidate.isFallback);
  const usable = hackerTool === "copy" ? real.filter((candidate) => candidate.clipboard) : real;
  const ranked = usable.length > 0 ? usable : hackerTool === "copy" ? [] : hits;
  const target = ranked
    .slice()
    .sort((a, b) => distance(worldX, worldY, a.x, a.y) - distance(worldX, worldY, b.x, b.y))[0];

  if (!target) {
    showMessage(hackerTool === "copy" ? "NOTHING THERE TO COPY." : "NOTHING THERE TO GRAB.", 2);
    return true;
  }

  if (hackerTool === "copy") {
    if (!target.clipboard) {
      showMessage(`${target.label} CANNOT BE COPIED.`, 3);
    } else {
      hackerClipboard = target.clipboard;
      showMessage(`COPIED ${target.label}.`, 3);
    }
  } else {
    deleteHackerTarget(target.x, target.y, target.remove, target.label);
  }
  updateHackerUi();
  return true;
}

// The GUI tool eats the click before the button can act, hides whatever was
// tapped, and remembers it so it stays gone across reloads.
function installGuiDeleteHandler(): void {
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!isHacker || hackerTool !== "gui") return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("#hacker-panel") || target.closest("[data-action='hacker']")) return;

      const canvas = target.closest("canvas");
      if (canvas) {
        hudDeleted = true;
        showMessage("HUD DELETED.", 3);
        saveGame();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const element = target.closest<HTMLElement>("button, section, p, div, header, h2, span");
      if (!element || element.id === "hacker-panel") return;
      const selector = describeGuiElement(element);
      deletedGuiSelectors.add(selector);
      element.style.display = "none";
      showMessage(`GUI DELETED: ${selector.toUpperCase()}`, 3);
      saveGame();
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
}

function describeGuiElement(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  const action = element.dataset["action"];
  if (action) return `[data-action='${action}']`;
  const direction = element.dataset["direction"];
  if (direction) return `[data-direction='${direction}']`;
  const className = element.className.trim().split(/\s+/)[0];
  return className ? `.${className}` : element.tagName.toLowerCase();
}

function applyDeletedGui(): void {
  for (const selector of deletedGuiSelectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) element.style.display = "none";
  }
}

// Nukes the entire game out of the page. Never saved, so a refresh or a fresh
// tab brings the whole thing back.
function deleteWholeGame(): void {
  if (!isHacker) return;
  saveGame();
  gameDeleted = true;
  closeHackerPanel();
  document.body.classList.add("game-deleted");
  showMessage("", 0);
}

function restoreDeletedAssets(): void {
  if (!isHacker) return;
  const hadDeletions = sharkDeleted || homeRaftDeleted || shopkeeperDeleted || hudDeleted
    || oceanDeleted || playerDeleted || deletedIslands.size > 0 || deletedGuiSelectors.size > 0;
  if (!hadDeletions) {
    showMessage("NOTHING TO BRING BACK.", 3);
    return;
  }
  if (sharkDeleted) {
    sharkDeleted = false;
    shark.x = 110;
    shark.y = 120;
    shark.biteCooldownUntil = 0;
  }
  homeRaftDeleted = false;
  shopkeeperDeleted = false;
  hudDeleted = false;
  oceanDeleted = false;
  playerDeleted = false;
  sinkVelocity = 0;
  deletedIslands.clear();
  for (const selector of deletedGuiSelectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) element.style.removeProperty("display");
  }
  deletedGuiSelectors.clear();
  showMessage("HACKER: EVERYTHING BROUGHT BACK.", 3.5);
  saveGame();
}

function deleteHackerTarget(x: number, y: number, remove: () => void, label: string): void {
  burst(x, y, "#8ff9f5", 26);
  remove();
  showMessage(`${label} DELETED — GONE FOR GOOD.`, 3.5);
  saveGame();
}

function spawnBloodCrate(): void {
  const position = randomWaterPosition();
  crates.push({ x: position.x, y: position.y, kind: "blood", landedAt: elapsed, bobOffset: Math.random() * 10 });
}

function randomWaterPosition(): { x: number; y: number } {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const maxX = isIslandUnlocked() ? WIDTH - 65 : 700;
    const x = 65 + Math.random() * (maxX - 65);
    const y = 105 + Math.random() * (HEIGHT - 160);
    if (!isInSafeZone(x, y) && distance(x, y, player.x, player.y) > 210) return { x, y };
  }
  return { x: 95, y: HEIGHT - 90 };
}

function collectCrates(): void {
  let collectedAny = false;
  crates = crates.filter((crate) => {
    if (distance(player.x, player.y, crate.x, crate.y) > 34) return true;
    carriedCrates.push(crate);
    collectedAny = true;
    burst(crate.x, crate.y, crateColor(crate), 14);
    // Tell the host to drop it from the world list, otherwise the next world
    // sync would put the crate straight back.
    if (multiplayerConnected && !multiplayerIsHost) sendMultiplayerMessage("take", { x: crate.x, y: crate.y });
    showMessage(
      `CRATE SECURED! REACH ANY RAFT PLATFORM${carriedCrates.length > 1 ? ` (${carriedCrates.length} CARRIED)` : ""}.`,
      3.2
    );
    return false;
  });
  if (collectedAny) {
    saveGame();
    broadcastMultiplayerNotice("COLLECTED A SHARED CRATE!");
  }
}

function depositCarriedCrates(): void {
  if (carriedCrates.length === 0 || !isOnRaftNetwork(player.x, player.y)) return;
  const delivered = carriedCrates.splice(0);
  for (const crate of delivered) openCrate(crate);
  saveGame();
  broadcastMultiplayerNotice(`OPENED ${delivered.length} SHARED CRATE${delivered.length === 1 ? "" : "S"}!`);
}

function openCrate(crate: FloatingCrate): void {
  if (crate.kind === "hacker") {
    grantHackerCrate();
    burst(player.x, player.y, "#4dff9b", 120);
    showMessage("HACKER CRATE! INFINITE EVERYTHING, MAX HEARTS, FULL CRAFTING!", 8);
    updateTerrainButton();
    updateHackerUi();
    return;
  }
  if (crate.kind === "rainbow" || crate.kind === "super") {
    const amount = crate.kind === "super" ? 100 : 50;
    grantOmniCrate(amount);
    burst(player.x, player.y, crate.kind === "super" ? "#ffffff" : `hsl(${(elapsed * 180) % 360} 100% 65%)`, crate.kind === "super" ? 100 : 70);
    showMessage(
      crate.kind === "super"
        ? "SUPER CRATE! +100 OF EVERYTHING, +100 FOOD, +100 TERRAIN GENERATORS!"
        : "RAINBOW CRATE! +50 OF EVERYTHING, +50 FOOD, +50 TERRAIN GENERATORS!",
      8
    );
    updateTerrainButton();
    return;
  }
  let contentsMessage = "";
  let unlockedEndgameNow = false;
  if (crate.kind === "supply" && crate.material) {
    addItem(crate.material.name, crate.material.amount);
    contentsMessage = `${crate.material.amount} ${crate.material.name.toUpperCase()}`;
    const previousMaterial = getPreviousMaterial(crate.material.name);
    if (previousMaterial && Math.random() < 0.75) {
      const bonusAmount = Math.max(1, Math.ceil(previousMaterial.amount / 2));
      addItem(previousMaterial.name, bonusAmount);
      contentsMessage += ` + ${bonusAmount} ${previousMaterial.name.toUpperCase()}`;
    }
    burst(player.x, player.y, crate.material.color, 18);
    if (crate.material.name === "God Material" && !endgameUnlocked) {
      endgameUnlocked = true;
      unlockedEndgameNow = true;
    }
  } else if (crate.kind === "blood") {
    const bloodRewards: MaterialDrop[] = [
      { name: "Gold", amount: 12, color: "#ffd84e" },
      { name: "Diamond", amount: 8, color: "#b9ffff" },
      { name: "Plasma", amount: 7, color: "#e878ff" },
      { name: "Star Material", amount: 5, color: "#fff3a1" },
      { name: "God Material", amount: 3, color: "#ffffff" },
      { name: "Infernal Material", amount: 6, color: "#ff5738" },
      { name: "Technology Shards", amount: 12, color: "#62efff" },
    ];
    const reward = bloodRewards[Math.floor(Math.random() * bloodRewards.length)] ?? bloodRewards[0]!;
    addItem(reward.name, reward.amount);
    contentsMessage = `${reward.amount} ${reward.name.toUpperCase()}`;
    if (Math.random() < 0.55) {
      const bonus = 4 + Math.floor(Math.random() * 5);
      addItem("Infernal Material", bonus);
      contentsMessage += ` + ${bonus} INFERNAL MATERIAL`;
    }
    burst(player.x, player.y, "#d71935", 30);
  } else if (crate.kind === "wooden") {
    if (!hasCraftingTable) {
      hasCraftingTable = true;
      craftingTableLevel = 1;
      addItem("Wood", 3);
      contentsMessage = "A CRAFTING TABLE + 3 WOOD";
    } else {
      const wood = 5 + Math.floor(Math.random() * 5);
      const stone = 1 + Math.floor(Math.random() * 3);
      addItem("Wood", wood);
      addItem("Stone", stone);
      contentsMessage = `${wood} WOOD + ${stone} STONE`;
    }
    burst(player.x, player.y, "#d18a48", 18);
  } else {
    const shards = 3 + Math.floor(Math.random() * 5);
    addItem("Technology Shards", shards);
    contentsMessage = `${shards} TECHNOLOGY SHARDS`;
    burst(player.x, player.y, "#62efff", 20);
  }
  const foodName = addCrateFood();
  showMessage(
    unlockedEndgameNow
      ? `GOD MATERIAL + ${foodName.toUpperCase()}! DROPS ARE RANDOM${expansionCount >= 3 ? " AND ISLANDS REVEALED" : ""}!`
      : `DELIVERED ${contentsMessage} + ${foodName.toUpperCase()}!`,
    unlockedEndgameNow ? 5 : 4
  );
}

function grantOmniCrate(amount: number): void {
  const materialNames = new Set(endlessMaterials.map((material) => material.name));
  materialNames.add("Technology Shards");
  for (const name of materialNames) inventory.set(name, (inventory.get(name) ?? 0) + amount);
  for (let index = 0; index < amount; index += 1) foodHealing.push(99);
  inventory.set("Food", foodHealing.length);
  terrainGenerators += amount;
}

function getPreviousMaterial(materialName: string): MaterialDrop | undefined {
  const index = endlessMaterials.findIndex((material) => material.name === materialName);
  return index > 0 ? endlessMaterials[index - 1] : undefined;
}

function loseCarriedCrates(): number {
  const lost = carriedCrates.splice(0);
  for (const crate of lost) {
    const position = randomWaterPosition();
    crates.push({
      x: position.x,
      y: position.y,
      kind: crate.kind,
      ...(crate.material ? { material: crate.material } : {}),
      landedAt: elapsed,
      bobOffset: Math.random() * 10,
    });
  }
  return lost.length;
}

function crateColor(crate: FloatingCrate): string {
  if (crate.kind === "hacker") return "#4dff9b";
  if (crate.kind === "super") return "#fff7a8";
  if (crate.kind === "rainbow") return `hsl(${(elapsed * 120 + crate.bobOffset * 30) % 360} 95% 58%)`;
  if (crate.kind === "blood") return "#d71935";
  if (crate.kind === "technology") return "#62efff";
  if (crate.kind === "wooden") return "#d18a48";
  return crate.material?.color ?? "#ffe36c";
}

function addCrateFood(): string {
  const isFullMeal = Math.random() < 0.24;
  addFood(isFullMeal ? 99 : 1, 1);
  return isFullMeal ? "Full Meal" : "Snack";
}

function eatFood(): void {
  if (mode !== "playing") return;
  if (foodHealing.length === 0) {
    showMessage("You do not have any food yet.", 2.5);
    return;
  }
  if (player.hearts >= maxHearts) {
    showMessage("Your hearts are already full.", 2.5);
    return;
  }
  const healing = foodHealing.shift() ?? 1;
  const heartsBefore = player.hearts;
  player.hearts = healing >= 3 ? maxHearts : Math.min(maxHearts, player.hearts + healing);
  inventory.set("Food", foodHealing.length);
  const restored = player.hearts - heartsBefore;
  showMessage(healing >= 3 ? "FULL MEAL! ALL HEARTS RESTORED!" : `ATE A SNACK! +${restored} HEART`, 3);
  burst(player.x, player.y, "#ff8fb1", 14);
  saveGame();
}

function keepSharkOutOfRaft(hunter: SharkEntity = shark): void {
  const margin = 14;
  const raft = getRaftBounds();
  const left = raft.x - margin;
  const right = raft.x + raft.width + margin;
  const top = raft.y - margin;
  const bottom = raft.y + raft.height + margin;
  if (hunter.x <= left || hunter.x >= right || hunter.y <= top || hunter.y >= bottom) return;

  const distances = [
    { edge: "left", distance: hunter.x - left },
    { edge: "right", distance: right - hunter.x },
    { edge: "top", distance: hunter.y - top },
    { edge: "bottom", distance: bottom - hunter.y },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  const nearest = distances[0]?.edge;
  if (nearest === "left") hunter.x = left;
  if (nearest === "right") hunter.x = right;
  if (nearest === "top") hunter.y = top;
  if (nearest === "bottom") hunter.y = bottom;
}

function keepSharkOutOfIsland(hunter: SharkEntity = shark): void {
  if (!isIslandUnlocked()) return;
  for (const island of ISLANDS) {
    if (!isIslandVisible(island)) continue;
    const dx = hunter.x - island.x;
    const dy = hunter.y - island.y;
    const radiusX = island.radiusX + 16;
    const radiusY = island.radiusY + 14;
    const normalized = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
    if (normalized >= 1) continue;
    const angle = Math.atan2(dy / radiusY, dx / radiusX);
    hunter.x = island.x + Math.cos(angle) * radiusX;
    hunter.y = island.y + Math.sin(angle) * radiusY;
  }
}

function toggleCrafting(): void {
  if (mode !== "playing") return;
  if (!hasCraftingTable) {
    showMessage("Find a wooden crate with a crafting table first.", 3);
    return;
  }
  craftingOpen = !craftingOpen;
  if (craftingOpen) craftingAutomationPage = false;
  storageOpen = false;
  shopOpen = false;
  timeWarperOpen = false;
  creativeCrateMenuOpen = false;
  updateShopkeeperButton();
  updateCreativeCrateSpawnerButton();
  updateStorageControls();
  keys.clear();
}

function toggleCraftingPage(): void {
  if (!craftingOpen) return;
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage("Upgrade to the Techno Crafting Table to unlock automation.", 3);
    return;
  }
  craftingAutomationPage = !craftingAutomationPage;
}

function toggleStorage(): void {
  if (mode !== "playing") return;
  if (chestCount === 0) {
    showMessage("Craft a chest first.", 2.5);
    return;
  }
  if (!isOnRaftNetwork(player.x, player.y)) {
    showMessage("Stand on the raft, cargo pickup, a bridge, or an island to use your chests.", 3);
    return;
  }
  storageOpen = !storageOpen;
  craftingOpen = false;
  shopOpen = false;
  timeWarperOpen = false;
  creativeCrateMenuOpen = false;
  updateShopkeeperButton();
  updateCreativeCrateSpawnerButton();
  keys.clear();
  updateStorageControls();
}

function updateStorageControls(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-action='deposit']");
  if (button) button.hidden = !storageOpen;
  if (!storageOpen) closeDepositDialog();
}

function openDepositDialog(): void {
  if (!storageOpen) return;
  const dialog = document.getElementById("deposit-dialog");
  const select = document.getElementById("deposit-item");
  if (!(dialog instanceof HTMLFormElement) || !(select instanceof HTMLSelectElement)) return;
  const options: Array<{ name: string; amount: number }> = [];
  for (const [name, amount] of inventory) {
    if (name !== "Food" && amount > 0) options.push({ name, amount });
  }
  if (foodHealing.length > 0) options.push({ name: "Food", amount: foodHealing.length });
  select.innerHTML = options.length > 0
    ? options.map((option) => `<option value="${option.name}">${option.name} (${option.amount} available)</option>`).join("")
    : '<option value="">Nothing to deposit</option>';
  dialog.hidden = false;
  updateDepositAmountLimit();
  const amountInput = document.getElementById("deposit-amount");
  if (amountInput instanceof HTMLInputElement) {
    amountInput.focus();
    amountInput.select();
  }
}

function closeDepositDialog(): void {
  const dialog = document.getElementById("deposit-dialog");
  if (dialog instanceof HTMLFormElement) dialog.hidden = true;
}

function updateDepositAmountLimit(): void {
  const select = document.getElementById("deposit-item");
  const amountInput = document.getElementById("deposit-amount");
  if (!(select instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
  const available = select.value === "Food" ? foodHealing.length : inventory.get(select.value) ?? 0;
  const chestSpace = Math.max(0, getChestCapacity() - getChestUsed());
  const maximum = Math.max(1, Math.min(available, chestSpace));
  amountInput.max = String(maximum);
  amountInput.value = String(Math.min(Number(amountInput.value) || 1, maximum));
}

function depositSelectedItems(): void {
  const select = document.getElementById("deposit-item");
  const amountInput = document.getElementById("deposit-amount");
  if (!(select instanceof HTMLSelectElement) || !(amountInput instanceof HTMLInputElement)) return;
  const itemName = select.value;
  const requested = Math.max(0, Math.floor(Number(amountInput.value)));
  const chestSpace = Math.max(0, getChestCapacity() - getChestUsed());
  const available = itemName === "Food" ? foodHealing.length : inventory.get(itemName) ?? 0;
  const amount = Math.min(requested, available, chestSpace);
  if (!itemName || amount <= 0) {
    showMessage(chestSpace <= 0 ? "Your chests are full." : "Choose an available item and amount.", 3);
    return;
  }
  if (itemName === "Food") {
    for (let index = 0; index < amount; index += 1) {
      const food = foodHealing.pop();
      if (food !== undefined) chestFoodHealing.push(food);
    }
    inventory.set("Food", foodHealing.length);
  } else {
    inventory.set(itemName, available - amount);
    chestInventory.set(itemName, (chestInventory.get(itemName) ?? 0) + amount);
  }
  closeDepositDialog();
  showMessage(`DEPOSITED ${amount} ${itemName.toUpperCase()} IN THE CHEST.`, 4);
  saveGame();
}

function craftRecipe(recipe: number): void {
  if (recipe === 1) craftDecoy();
  else if (recipe === 2) craftShield();
  else if (recipe === 3) craftRaftExpansion();
  else if (recipe === 4) craftBridge();
  else if (recipe === 5) craftHuntingSpear();
  else if (recipe === 6) craftChest();
  else if (recipe === 7) upgradeCraftingTable();
  else if (recipe === 8) craftCargoDock();
  else if (recipe === 9) craftCargoShip();
  else if (recipe === 10) craftStorageCompartment();
  else if (recipe === 11) craftCollectorBot();
  else if (recipe === 12) craftScoldBot();
  else if (recipe === 13) craftSuperScoldBot();
  else if (recipe === 14) craftFisherBot();
}

function getCraftRecipeAt(x: number, y: number): number {
  if (craftingAutomationPage) {
    const columns = [70, 365, 660];
    const rows = [205, 340];
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < columns.length; column += 1) {
        const automationIndex = row * 3 + column;
        const left = columns[column] ?? 0;
        const top = rows[row] ?? 0;
        if (x >= left && x <= left + 230 && y >= top && y <= top + 105) return automationIndex + 8;
      }
    }
    if (x >= 365 && x <= 595 && y >= 455 && y <= 560) return 14;
    return 0;
  }
  const columns = [70, 365, 660];
  const rows = [165, 290, 415];
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < columns.length; column += 1) {
      const left = columns[column] ?? 0;
      const top = rows[row] ?? 0;
      const recipe = row * 3 + column + 1;
      if (recipe <= 7 && x >= left && x <= left + 230 && y >= top && y <= top + 105) return recipe;
    }
  }
  return 0;
}

function upgradeCraftingTable(): void {
  if (craftingTableLevel >= TECHNO_CRAFTING_LEVEL) {
    showMessage("Your Techno Crafting Table is already at maximum level.", 3);
    return;
  }
  const material = craftingTableUpgradeMaterials[craftingTableLevel - 1];
  if (!material) return;
  if (!spendItem(material, 4)) {
    showMessage(`You need 4 ${material} for crafting table level ${craftingTableLevel + 1}.`, 3);
    return;
  }
  craftingTableLevel += 1;
  showMessage(
    craftingTableLevel >= TECHNO_CRAFTING_LEVEL
      ? "TECHNO CRAFTING TABLE ONLINE! ALL AUTOMATION UNLOCKED!"
      : `CRAFTING TABLE UPGRADED TO LEVEL ${craftingTableLevel}! NEXT TIER UNLOCKED.`,
    4
  );
  saveGame();
}

function craftCargoDock(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (hasCargoDock) {
    showMessage("Your cargo dock is already attached to the raft.", 3);
    return;
  }
  const costs: Array<[string, number]> = [["Wood", 12], ["Steel", 6], ["Technology Shards", 4]];
  if (!canAffordItems(costs)) {
    showMessage("The cargo dock needs 12 Wood, 6 Steel, and 4 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  hasCargoDock = true;
  syncCargoShips();
  showMessage(isNightmareLevel() ? "THE BLACK DOCK EXTENDS INTO THE WATER." : "CARGO DOCK BUILT! CARGO SHIPS CAN NOW LAND.", 4);
  saveGame();
}

function craftCargoShip(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (!hasCargoDock) {
    showMessage("Build a cargo dock before building a cargo ship.", 3);
    return;
  }
  if (cargoShipCount >= MAX_CARGO_SHIPS) {
    showMessage(`Your dock can manage at most ${MAX_CARGO_SHIPS} cargo ships.`, 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 10], ["Technology Shards", 8]];
  if (!canAffordItems(costs)) {
    showMessage("A cargo ship needs 10 Steel and 8 Technology Shards.", 3);
    return;
  }
  spendItems(costs);
  cargoShipCount += 1;
  syncCargoShips();
  showMessage(
    isNightmareLevel()
      ? `HOLLOW CARGO SHIP ${cargoShipCount} HAS AWAKENED.`
      : `CARGO SHIP ${cargoShipCount} LAUNCHED! IT WILL COLLECT CRATES AUTOMATICALLY.`,
    4
  );
  saveGame();
}

function craftStorageCompartment(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (hasStorageCompartment) {
    showMessage("The Storage Compartment is already installed.", 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 12], ["Technology Shards", 10]];
  if (!canAffordItems(costs)) {
    showMessage("The Storage Compartment needs 12 Steel and 10 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  hasStorageCompartment = true;
  moveCollectorDropsToCompartment();
  showMessage(isNightmareLevel() ? "THE HARVEST VAULT RISES ON ITS OWN DEAD RAFT." : "STORAGE MINI RAFT BUILT! BOT HARVESTS WILL STACK ON TOP.", 4);
  saveGame();
}

function craftCollectorBot(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (collectorBotCount >= MAX_COLLECTOR_BOTS) {
    showMessage(`You can operate at most ${MAX_COLLECTOR_BOTS} Collector Bots.`, 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 6], ["Technology Shards", 6]];
  if (!canAffordItems(costs)) {
    showMessage("A Collector Bot needs 6 Steel and 6 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  collectorBotCount += 1;
  syncCollectorBots();
  nextCollectorRunAt = Math.min(nextCollectorRunAt || elapsed, elapsed + 2);
  showMessage(
    isNightmareLevel()
      ? `REAPER BOT ${collectorBotCount} CRAWLS TOWARD THE ISLANDS.`
      : `COLLECTOR BOT ${collectorBotCount} ONLINE! IT WILL HARVEST READY ISLANDS.`,
    4
  );
  saveGame();
}

function craftScoldBot(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (hasScoldBot) {
    showMessage("Your Scold Bot is already guarding the raft.", 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 8], ["Technology Shards", 8]];
  if (!canAffordItems(costs)) {
    showMessage("A Scold Bot needs 8 Steel and 8 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  hasScoldBot = true;
  nextScoldAt = elapsed + 1;
  showMessage(
    isNightmareLevel() ? "THE WARDEN OPENS ITS MOUTH." : "SCOLD BOT ONLINE! SHARKS ARE ABOUT TO GET A TALKING-TO.",
    4
  );
  saveGame();
}

function craftSuperScoldBot(): void {
  if (!hasScoldBot) {
    showMessage("Build a Scold Bot before giving it the super megaphone.", 3);
    return;
  }
  if (hasSuperScoldBot) {
    showMessage("Your Super Scold Bot is already at maximum loudness.", 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 16], ["Technology Shards", 16]];
  if (!canAffordItems(costs)) {
    showMessage("The Super Scold upgrade needs 16 Steel and 16 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  hasSuperScoldBot = true;
  nextScoldAt = elapsed + 0.5;
  showMessage(
    isNightmareLevel() ? "THE WARDEN HAS FOUND ITS VOICE." : "SUPER SCOLD BOT ONLINE! MEGAPHONE BLAST READY!",
    4
  );
  saveGame();
}

function craftFisherBot(): void {
  if (craftingTableLevel < TECHNO_CRAFTING_LEVEL) {
    showMessage(`Reach Techno Crafting Table level ${TECHNO_CRAFTING_LEVEL} first.`, 3);
    return;
  }
  if (hasFisherBot) {
    showMessage("Your Fisher Bot is already casting from the raft.", 3);
    return;
  }
  const costs: Array<[string, number]> = [["Steel", 10], ["Technology Shards", 10]];
  if (!canAffordItems(costs)) {
    showMessage("A Fisher Bot needs 10 Steel and 10 Technology Shards.", 4);
    return;
  }
  spendItems(costs);
  hasFisherBot = true;
  nextAutoFishAt = elapsed + 3;
  showMessage("FISHER BOT ONLINE! IT WILL FILL YOUR FISH INDEX WHILE YOU EXPLORE.", 5);
  saveGame();
}

function updateFisherBot(): void {
  if (!hasFisherBot || elapsed < nextAutoFishAt) return;
  const undiscovered = fishCatches.filter((fish) => (fishCollection.get(fish.name) ?? 0) === 0);
  const pool = undiscovered.length > 0 ? undiscovered : fishCatches;
  const caught = pool[Math.floor(Math.random() * pool.length)];
  nextAutoFishAt = elapsed + FISHER_BOT_INTERVAL;
  if (!caught) return;
  fishCollection.set(caught.name, (fishCollection.get(caught.name) ?? 0) + 1);
  const bot = getFisherBotPosition();
  burst(bot.lineX, bot.lineY, caught.color, 18);
  if (elapsed >= messageUntil) {
    showMessage(`FISHER BOT CAUGHT: ${caught.name.toUpperCase()}! INDEX ${fishCollection.size}/${fishCatches.length}`, 4);
  }
  saveGame();
}

function syncCollectorBots(): void {
  while (collectorBots.length < collectorBotCount) {
    const index = collectorBots.length;
    const home = getCollectorBotHome(index, collectorBotCount);
    collectorBots.push({
      x: home.x,
      y: home.y,
      state: "idle",
      targetIslandIndex: -1,
      waypoints: [],
      waypointIndex: 0,
      cargo: null,
      harvestUntil: 0,
      stepOffset: Math.random() * Math.PI * 2,
    });
  }
  if (collectorBots.length > collectorBotCount) collectorBots.length = collectorBotCount;
}

function updateCollectorBots(dt: number): void {
  if (collectorBotCount === 0) return;
  syncCollectorBots();
  collectorBots.forEach((bot, index) => {
    if (bot.state === "idle") {
      const home = getCollectorBotHome(index, collectorBots.length);
      moveCollectorBotToward(bot, home.x, home.y, dt);
      return;
    }
    if (bot.state === "harvesting") {
      if (elapsed >= bot.harvestUntil) finishCollectorHarvest(bot);
      return;
    }
    if (!moveCollectorBotAlongRoute(bot, dt)) return;
    if (bot.state === "outbound") {
      bot.state = "harvesting";
      bot.harvestUntil = elapsed + 1.5;
    } else {
      finishCollectorReturn(bot);
    }
  });

  if (elapsed < nextCollectorRunAt) return;
  nextCollectorRunAt = elapsed + COLLECTOR_INTERVAL;
  const claimedIslands = new Set(
    collectorBots.filter((bot) => bot.state !== "idle" && bot.targetIslandIndex >= 0).map((bot) => bot.targetIslandIndex)
  );
  for (const bot of collectorBots) {
    if (bot.state !== "idle") continue;
    const availableIslandIndices = ISLANDS.map((island, index) => ({ island, index })).filter(({ island, index }) => {
      if (claimedIslands.has(index) || index >= bridgesBuilt || !isIslandVisible(island)) return false;
      return island.kind === "coconut" ? getAvailableCoconuts(index) > 0 : elapsed >= (animalReadyAt[index] ?? 0);
    });
    const target = availableIslandIndices[Math.floor(Math.random() * availableIslandIndices.length)];
    if (!target) break;
    bot.state = "outbound";
    bot.targetIslandIndex = target.index;
    bot.waypoints = getCollectorBotRoute(target.index, false, collectorBots.indexOf(bot));
    bot.waypointIndex = 0;
    claimedIslands.add(target.index);
  }
}

function moveCollectorBotAlongRoute(bot: CollectorBot, dt: number): boolean {
  const waypoint = bot.waypoints[bot.waypointIndex];
  if (!waypoint) return true;
  if (moveCollectorBotToward(bot, waypoint.x, waypoint.y, dt)) bot.waypointIndex += 1;
  return bot.waypointIndex >= bot.waypoints.length;
}

function moveCollectorBotToward(bot: CollectorBot, targetX: number, targetY: number, dt: number): boolean {
  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  const remaining = Math.hypot(dx, dy);
  const travel = 78 * dt;
  if (remaining <= Math.max(2, travel)) {
    bot.x = targetX;
    bot.y = targetY;
    return true;
  }
  bot.x += (dx / remaining) * travel;
  bot.y += (dy / remaining) * travel;
  return false;
}

function finishCollectorHarvest(bot: CollectorBot): void {
  const island = ISLANDS[bot.targetIslandIndex];
  if (island?.kind === "coconut") {
    const fruitCount = getAvailableCoconuts(bot.targetIslandIndex);
    if (fruitCount > 0) {
      bot.cargo = { healing: 1, count: fruitCount * 2, source: isNightmareLevel() ? "blood-orange" : "coconut" };
      coconutReadyAt[bot.targetIslandIndex] = elapsed + 45;
    }
  } else if (island && elapsed >= (animalReadyAt[bot.targetIslandIndex] ?? 0)) {
    bot.cargo = { healing: 99, count: island.kind === "cow" ? 2 : 1, source: island.kind };
    animalReadyAt[bot.targetIslandIndex] = elapsed + 90;
  }
  if (bot.cargo && !hasStorageCompartment) {
    placeCollectorDrop(bot.targetIslandIndex, bot.cargo.healing, bot.cargo.count, bot.cargo.source, true);
    bot.cargo = null;
    showMessage("A COLLECTOR BOT LEFT ITS HARVEST ON THE ISLAND GROUND!", 4);
  }
  bot.state = "returning";
  bot.waypoints = getCollectorBotRoute(bot.targetIslandIndex, true, collectorBots.indexOf(bot));
  bot.waypointIndex = 0;
  saveGame();
}

function finishCollectorReturn(bot: CollectorBot): void {
  if (bot.cargo) {
    placeCollectorDrop(bot.targetIslandIndex, bot.cargo.healing, bot.cargo.count, bot.cargo.source);
    bot.cargo = null;
    showMessage("A COLLECTOR BOT STACKED ITS HARVEST ON THE STORAGE COMPARTMENT!", 4);
  }
  bot.state = "idle";
  bot.targetIslandIndex = -1;
  bot.waypoints = [];
  bot.waypointIndex = 0;
  saveGame();
}

function placeCollectorDrop(
  islandIndex: number,
  healing: 1 | 99,
  count: number,
  source: CollectorDrop["source"],
  forceGround = false
): void {
  const island = ISLANDS[islandIndex];
  if (!island) return;
  if (hasStorageCompartment && !forceGround) {
    const compartment = getStorageCompartmentPosition();
    const matchingPile = collectorDrops.find((drop) =>
      drop.onCompartment && drop.healing === healing && drop.source === source
    );
    if (matchingPile) {
      matchingPile.count += count;
    } else {
      collectorDrops.push({
        x: compartment.x,
        y: compartment.y - 2,
        healing,
        count,
        source,
        onCompartment: true,
      });
    }
    positionCollectorStorageDrops();
    return;
  }
  collectorDrops.push({
    x: island.x + (Math.random() - 0.5) * island.radiusX * 1.15,
    y: island.y + (Math.random() - 0.5) * island.radiusY * 0.85,
    healing,
    count,
    source,
    onCompartment: false,
  });
}

function positionCollectorStorageDrops(): void {
  const compartment = getStorageCompartmentPosition();
  const storedDrops = collectorDrops.filter((drop) => drop.onCompartment);
  storedDrops.forEach((drop, index) => {
    drop.x = compartment.x - 30 + (index % 4) * 20;
    drop.y = compartment.y - 2 + Math.floor(index / 4) * 7;
  });
}

function moveCollectorDropsToCompartment(): void {
  const mergedDrops = new Map<string, CollectorDrop>();
  for (const drop of collectorDrops) {
    const key = `${drop.source}:${drop.healing}`;
    const matchingPile = mergedDrops.get(key);
    if (matchingPile) {
      matchingPile.count += drop.count;
    } else {
      mergedDrops.set(key, { ...drop, onCompartment: true });
    }
  }
  collectorDrops = [...mergedDrops.values()];
  positionCollectorStorageDrops();
}

function collectCollectorDrops(pickupX = player.x, pickupY = player.y, pickupRadius = 48): void {
  let collected = 0;
  let blockedByFullStorage = false;
  collectorDrops = collectorDrops.filter((drop) => {
    if (distance(pickupX, pickupY, drop.x, drop.y) > pickupRadius) return true;
    const availableRoom = Math.max(0, STACK_LIMIT - foodHealing.length) + Math.max(0, getChestCapacity() - getChestUsed());
    const amount = Math.min(drop.count, availableRoom);
    if (amount <= 0) {
      blockedByFullStorage = true;
      return true;
    }
    addFood(drop.healing, amount);
    drop.count -= amount;
    collected += amount;
    return drop.count > 0;
  });
  if (collected > 0) {
    showMessage(`PICKED UP ${collected} BOT-COLLECTED FOOD!`, 3);
    saveGame();
  } else if (blockedByFullStorage && elapsed >= messageUntil) {
    showMessage(
      hasStorageCompartment
        ? "ALL FOOD STORAGE IS FULL. EAT, TRADE, OR EMPTY A CHEST FIRST."
        : "INVENTORY AND CHESTS FULL! CRAFT A STORAGE COMPARTMENT FOR 1,000 MORE SPACES.",
      4
    );
  }
}

function canAffordItems(costs: Array<[string, number]>): boolean {
  return gameKind === "creative" || costs.every(([name, amount]) => (inventory.get(name) ?? 0) >= amount);
}

function spendItems(costs: Array<[string, number]>): void {
  if (gameKind === "creative") return;
  for (const [name, amount] of costs) inventory.set(name, Math.max(0, (inventory.get(name) ?? 0) - amount));
}

function craftDecoy(): void {
  if (!spendItem("Wood", 3)) {
    showMessage("You need 3 Wood.", 2);
    return;
  }
  sharkDecoyUntil = elapsed + 15;
  showMessage(isNightmareLevel() ? "THE LURE EFFIGY IS CALLING. THE SHARK MUST ANSWER." : "SHARK DECOY DEPLOYED FOR 15 SECONDS!", 3);
  saveGame();
}

function craftShield(): void {
  if (!spendItem("Technology Shards", 5)) {
    showMessage("You need 5 Technology Shards.", 2);
    return;
  }
  shieldUntil = Number.POSITIVE_INFINITY;
  showMessage(isNightmareLevel() ? "THE VEIN SHIELD TWITCHES AROUND YOU. ONE BITE WILL FEED IT." : "TECH SHIELD READY! It blocks one bite.", 3);
  saveGame();
}

function craftRaftExpansion(): void {
  const woodCost = 8 * 2 ** expansionCount;
  const stoneCost = 2 * 2 ** expansionCount;
  const wood = inventory.get("Wood") ?? 0;
  const stone = inventory.get("Stone") ?? 0;
  if (gameKind !== "creative" && (wood < woodCost || stone < stoneCost)) {
    showMessage(`You need ${woodCost} Wood and ${stoneCost} Stone.`, 3);
    return;
  }
  if (gameKind !== "creative") {
    inventory.set("Wood", wood - woodCost);
    inventory.set("Stone", stone - stoneCost);
  }
  expansionCount += 1;
  raftLevel = expansionCount + 1;
  if (hasStorageCompartment) moveCollectorDropsToCompartment();
  if (isNightmareLevel()) {
    showMessage(`THE LIVING RAFT HAS GROWN TO LEVEL ${raftLevel}. IT WANTS MORE.`, 4);
  } else if (expansionCount === 3) {
    showMessage(
      endgameUnlocked
        ? "THIRD EXPANSION! NEW ISLANDS APPEAR — BUILD BRIDGES TO THEM!"
        : "THIRD EXPANSION READY! GOD MATERIAL WILL REVEAL THE ISLANDS!",
      5
    );
  } else if (expansionCount === 4 && endgameUnlocked) {
    showMessage("FOURTH EXPANSION! COW AND SHEEP ISLANDS HAVE APPEARED!", 5);
  } else {
    const nextWood = 8 * 2 ** expansionCount;
    const nextStone = 2 * 2 ** expansionCount;
    showMessage(
      gameKind === "creative"
        ? `RAFT EXPANDED TO LEVEL ${raftLevel}! CREATIVE EXPANSIONS STAY FREE.`
        : `RAFT EXPANDED! Next cost: ${nextWood} Wood + ${nextStone} Stone.`,
      4
    );
  }
  saveGame();
}

function craftBridge(): void {
  const targetIsland = isIslandUnlocked() && bridgesBuilt < ISLANDS.length ? ISLANDS[bridgesBuilt] : undefined;
  if (targetIsland && !isIslandVisible(targetIsland)) {
    showMessage("Build a fourth raft expansion to reveal the animal islands.", 3);
    return;
  }
  const targetRaft = targetIsland
    ? undefined
    : sunkenRafts.find((wreck) => elapsed >= wreck.raisedAt && !wreck.bridgeBuilt);
  if (!targetIsland && !targetRaft) {
    const nextWreck = sunkenRafts
      .filter((wreck) => !wreck.bridgeBuilt && elapsed < wreck.raisedAt)
      .sort((a, b) => a.raisedAt - b.raisedAt)[0];
    if (nextWreck) {
      showMessage(`The next sunken raft surfaces in ${formatTime(Math.ceil(nextWreck.raisedAt - elapsed))}.`, 3);
    } else if (sunkenRafts.length > 0) {
      showMessage("Every surfaced raft already has a bridge.", 3);
    } else {
      showMessage(isIslandUnlocked() ? "Every island already has a bridge. Use a Terrain Generator to find more rafts." : "Reveal islands or use a Terrain Generator to find a sunken raft.", 4);
    }
    return;
  }
  const woodCost = 6;
  const stoneCost = 2;
  const wood = inventory.get("Wood") ?? 0;
  const stone = inventory.get("Stone") ?? 0;
  if (gameKind !== "creative" && (wood < woodCost || stone < stoneCost)) {
    showMessage(`You need ${woodCost} Wood and ${stoneCost} Stone for the bridge.`, 3);
    return;
  }
  if (gameKind !== "creative") {
    inventory.set("Wood", wood - woodCost);
    inventory.set("Stone", stone - stoneCost);
  }
  if (targetIsland) bridgesBuilt += 1;
  if (targetRaft) {
    assignSunkenRaftBridgeSource(targetRaft);
    targetRaft.bridgeBuilt = true;
  }
  showMessage(
    isNightmareLevel()
      ? "THE BONE CAUSEWAY HAS FINISHED ASSEMBLING ITSELF."
      : targetIsland ? `BRIDGE BUILT TO ${targetIsland.name}!` : `BRIDGE BUILT ${getSunkenRaftConnectionLabel(targetRaft)}!`,
    4
  );
  saveGame();
}

function craftHuntingSpear(): void {
  if (hasHuntingSpear) {
    showMessage("You already have a hunting spear.", 2.5);
    return;
  }
  const wood = inventory.get("Wood") ?? 0;
  const iron = inventory.get("Iron") ?? 0;
  if (gameKind !== "creative" && (wood < 8 || iron < 3)) {
    showMessage("You need 8 Wood and 3 Iron for a hunting spear.", 3);
    return;
  }
  if (gameKind !== "creative") {
    inventory.set("Wood", wood - 8);
    inventory.set("Iron", iron - 3);
  }
  hasHuntingSpear = true;
  spearDurability = SPEAR_MAX_DURABILITY;
  showMessage(
    isNightmareLevel()
      ? `BARBED HARPOON FORGED. IT WILL TASTE ${SPEAR_MAX_DURABILITY} CREATURES.`
      : `HUNTING SPEAR CRAFTED! ${SPEAR_MAX_DURABILITY} USES AVAILABLE.`,
    4
  );
  saveGame();
}

function craftChest(): void {
  if (!spendItem("Wood", 8)) {
    showMessage("You need 8 Wood to craft a chest.", 3);
    return;
  }
  chestCount += 1;
  showMessage(
    isNightmareLevel() ? `A MIMIC CHEST OPENS ITS MOUTH. CAPACITY: ${getChestCapacity()}` : `CHEST CRAFTED! STORAGE CAPACITY: ${getChestCapacity()}`,
    4
  );
  saveGame();
}

function harvestCoconuts(): void {
  if (mode !== "playing") return;
  const islandIndex = ISLANDS.findIndex((island) => isInsideIsland(player.x, player.y, island));
  const island = ISLANDS[islandIndex];
  if (islandIndex < 0 || islandIndex >= bridgesBuilt || island?.kind !== "coconut") {
    showMessage(isNightmareLevel() ? "Cross the bone bridge to harvest blood oranges." : "Build a bridge, then stand on its island to harvest coconuts.", 3);
    return;
  }
  const readyAt = coconutReadyAt[islandIndex] ?? 0;
  const coconutCount = getAvailableCoconuts(islandIndex);
  if (coconutCount <= 0) {
    showMessage(
      isNightmareLevel()
        ? `The tree demands ${Math.ceil(readyAt - elapsed)} more seconds.`
        : `The first coconut grows in ${Math.ceil(readyAt - elapsed)} seconds.`,
      3
    );
    return;
  }
  const snacks = coconutCount * 2;
  addFood(1, snacks);
  coconutReadyAt[islandIndex] = elapsed + 45;
  showMessage(
    isNightmareLevel()
      ? `PLUCKED ${coconutCount} BLOOD ORANGE${coconutCount === 1 ? "" : "S"}. THEY BECAME ${snacks} SNACKS.`
      : `HARVESTED ${coconutCount} COCONUT${coconutCount === 1 ? "" : "S"}! YOU MADE ${snacks} SNACKS!`,
    4
  );
  burst(player.x, player.y, isNightmareLevel() ? "#d71935" : "#9c6232", 18);
  saveGame();
  broadcastMultiplayerNotice(`HARVESTED ${coconutCount} COCONUT${coconutCount === 1 ? "" : "S"}!`);
}

function getAvailableCoconuts(islandIndex: number): number {
  const readyAt = coconutReadyAt[islandIndex] ?? 0;
  if (readyAt === 0) return 1;
  if (elapsed < readyAt) return 0;
  return Math.min(100, 1 + Math.floor((elapsed - readyAt) / 5));
}

function huntAnimal(): void {
  if (mode !== "playing") return;
  const closestShark = getClosestShark();
  if (distance(player.x, player.y, closestShark.x, closestShark.y) <= 76) {
    hitShark();
    return;
  }
  const islandIndex = ISLANDS.findIndex(
    (island) => isIslandVisible(island) && isInsideIsland(player.x, player.y, island) && island.kind !== "coconut"
  );
  const island = ISLANDS[islandIndex];
  if (islandIndex < 0 || !island) {
    showMessage("Stand near a cow or sheep to hunt.", 2.5);
    return;
  }
  if (islandIndex >= bridgesBuilt) {
    showMessage("Build a bridge to this island first.", 3);
    return;
  }
  if (!hasHuntingSpear) {
    showMessage("Craft a hunting spear before hunting animals.", 3);
    return;
  }
  const readyAt = animalReadyAt[islandIndex] ?? 0;
  if (elapsed < readyAt) {
    showMessage(`The animals return in ${Math.ceil(readyAt - elapsed)} seconds.`, 3);
    return;
  }
  const meals = island.kind === "cow" ? 2 : 1;
  addFood(99, meals);
  animalReadyAt[islandIndex] = elapsed + 90;
  const spearStatus = wearDownHuntingSpear();
  showMessage(
    `${island.kind === "cow" ? "COW" : "SHEEP"} HUNTED! ${meals} FULL-HEAL MEAL${meals === 1 ? "" : "S"}! ${spearStatus}`,
    4
  );
  burst(player.x, player.y, "#ffdbad", 20);
  saveGame();
}

function hitShark(): void {
  if (!hasHuntingSpear) {
    showMessage(isNightmareLevel() ? "The shark fears only a barbed harpoon." : "Craft a hunting spear before attacking the shark.", 3);
    return;
  }
  const targetShark = getClosestShark();
  const fleeDuration = 10 + Math.random() * 20;
  sharkFleeUntil = elapsed + fleeDuration;
  const awayAngle = Math.atan2(targetShark.y - player.y, targetShark.x - player.x);
  targetShark.angle = awayAngle;
  targetShark.x = clamp(targetShark.x + Math.cos(awayAngle) * 48, SHARK_EDGE_PADDING, WIDTH - SHARK_EDGE_PADDING);
  targetShark.y = clamp(targetShark.y + Math.sin(awayAngle) * 48, 78 + SHARK_EDGE_PADDING, HEIGHT - SHARK_EDGE_PADDING);
  for (const hunter of [shark, ...extraSharks]) hunter.biteCooldownUntil = sharkFleeUntil;
  const spearStatus = wearDownHuntingSpear();
  showMessage(
    isNightmareLevel()
      ? `THE HARPOON FOUND IT. THE SHARK VANISHES FOR ${Math.ceil(fleeDuration)} SECONDS. ${spearStatus}`
      : `YOU HIT THE SHARK! IT FLEES FOR ${Math.ceil(fleeDuration)} SECONDS! ${spearStatus}`,
    4
  );
  burst(targetShark.x, targetShark.y, "#d7f5ff", 20);
  saveGame();
}

function getClosestShark(): SharkEntity {
  return [shark, ...extraSharks].sort(
    (first, second) => distance(player.x, player.y, first.x, first.y) - distance(player.x, player.y, second.x, second.y)
  )[0] ?? shark;
}

function wearDownHuntingSpear(): string {
  spearDurability = Math.max(0, spearDurability - 1);
  if (spearDurability === 0) {
    hasHuntingSpear = false;
    return "YOUR SPEAR BROKE!";
  }
  return `SPEAR: ${spearDurability} USE${spearDurability === 1 ? "" : "S"} LEFT.`;
}

function addItem(name: string, amount: number): void {
  const current = inventory.get(name) ?? 0;
  const personalAmount = Math.min(amount, Math.max(0, STACK_LIMIT - current));
  inventory.set(name, current + personalAmount);
  const overflow = amount - personalAmount;
  if (overflow > 0) storeMaterialOverflow(name, overflow);
}

function storeMaterialOverflow(name: string, amount: number): void {
  const available = Math.max(0, getChestCapacity() - getChestUsed());
  if (available <= 0) return;
  const stored = Math.min(amount, available);
  chestInventory.set(name, (chestInventory.get(name) ?? 0) + stored);
}

function addFood(healing: number, count: number): void {
  for (let index = 0; index < count; index += 1) {
    if (foodHealing.length < STACK_LIMIT) foodHealing.push(healing);
    else if (getChestUsed() < getChestCapacity()) chestFoodHealing.push(healing);
  }
  inventory.set("Food", foodHealing.length);
}

function getChestCapacity(): number {
  return chestCount * CHEST_CAPACITY + (hasStorageCompartment ? STORAGE_COMPARTMENT_CAPACITY : 0);
}

function getChestUsed(): number {
  let used = chestFoodHealing.length;
  for (const amount of chestInventory.values()) used += amount;
  return used;
}

function storeAllInChest(): void {
  if (!storageOpen) return;
  let available = Math.max(0, getChestCapacity() - getChestUsed());
  for (const [name, amount] of inventory) {
    if (name === "Food" || amount <= 0 || available <= 0) continue;
    const moved = Math.min(amount, available);
    inventory.set(name, amount - moved);
    chestInventory.set(name, (chestInventory.get(name) ?? 0) + moved);
    available -= moved;
  }
  while (foodHealing.length > 0 && available > 0) {
    const food = foodHealing.pop();
    if (food !== undefined) chestFoodHealing.push(food);
    available -= 1;
  }
  inventory.set("Food", foodHealing.length);
  showMessage("SUPPLIES STORED IN CHESTS.", 3);
  saveGame();
}

function takeAllFromChest(): void {
  if (!storageOpen) return;
  for (const [name, amount] of chestInventory) {
    const room = Math.max(0, STACK_LIMIT - (inventory.get(name) ?? 0));
    const moved = Math.min(amount, room);
    inventory.set(name, (inventory.get(name) ?? 0) + moved);
    chestInventory.set(name, amount - moved);
  }
  while (chestFoodHealing.length > 0 && foodHealing.length < STACK_LIMIT) {
    const food = chestFoodHealing.pop();
    if (food !== undefined) foodHealing.push(food);
  }
  inventory.set("Food", foodHealing.length);
  showMessage("TOOK EVERYTHING THAT FITS IN YOUR INVENTORY.", 3);
  saveGame();
}

function spendItem(name: string, amount: number): boolean {
  if (gameKind === "creative") return true;
  const current = inventory.get(name) ?? 0;
  if (current < amount) return false;
  inventory.set(name, current - amount);
  return true;
}

function showMessage(text: string, seconds: number): void {
  message = text;
  messageUntil = elapsed + seconds;
}

function draw(): void {
  drawOcean();
  const cameraZoom = getCameraZoom();
  const camera = getCameraCenter();
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-camera.x, -camera.y);
  drawGeneratedTerrain();
  if (!isIslandUnlocked()) drawLockedHorizon();
  drawBubbles();
  drawShark();
  drawBridges();
  drawIsland();
  drawCollectorDrops(false);
  drawCrates(false);
  drawCargoShips();
  drawRaft();
  drawScoldBot();
  drawCollectorBots();
  drawCollectorDrops(true);
  if (hasStorageCompartment) drawStorageCompartmentFront();
  drawCrates(true);
  drawShopkeeper();
  if (elapsed < sharkDecoyUntil) drawDecoy();
  drawFishingLine();
  drawPlayer();
  drawRemoteMultiplayerPlayer();
  drawPastSelfEcho();
  drawParticles();
  drawCratePointers();
  ctx.restore();
  if (isNightmareLevel()) drawNightmareAtmosphere();
  drawCosmicEra();
  drawHud();
  if (terrainAnimationUntil > elapsed) drawTerrainGeneratorAnimation();
  if (craftingOpen) drawCrafting();
  if (storageOpen) drawStorage();
  if (shopOpen) drawShop();
  if (timeWarperOpen) drawTimeWarperMenu();
  if (creativeCrateMenuOpen) drawCreativeCrateMenu();
  if (mode === "ready") drawOverlay("SHARKS IN THE WATER", "Every minute, a new supply crate drops.", "PRESS SPACE OR TAP TO BEGIN");
  if (mode === "gameOver") drawOverlay("LOST AT SEA", "The shark got all three bites.", "PRESS SPACE OR TAP TO TRY AGAIN");
  if (mode === "paused" && mapOpen) drawMapViewLabel();
  else if (mode === "paused") drawOverlay("PAUSED", restoredAutosave ? "Autosave restored. Your voyage is ready." : "The ocean is frozen for now.", "PRESS P, ESCAPE, OR TAP TO RESUME");
  drawSavingIndicator();
}

function getPastSelfPosition(): { x: number; y: number } | null {
  if (!pastSelfEcho || elapsed >= pastSelfEcho.expiresAt) {
    pastSelfEcho = null;
    return null;
  }
  const path = pastSelfEcho.path;
  if (path.length === 0) return { x: pastSelfEcho.fallbackX, y: pastSelfEcho.fallbackY };
  const afterIndex = path.findIndex((point) => point.time >= elapsed);
  if (afterIndex <= 0) {
    const point = afterIndex === 0 ? path[0] : path[path.length - 1];
    return point ? { x: point.x, y: point.y } : { x: pastSelfEcho.fallbackX, y: pastSelfEcho.fallbackY };
  }
  const before = path[afterIndex - 1];
  const after = path[afterIndex];
  if (!before || !after) return { x: pastSelfEcho.fallbackX, y: pastSelfEcho.fallbackY };
  const progress = clamp((elapsed - before.time) / Math.max(0.001, after.time - before.time), 0, 1);
  return {
    x: before.x + (after.x - before.x) * progress,
    y: before.y + (after.y - before.y) * progress,
  };
}

function drawPastSelfEcho(): void {
  const echo = getPastSelfPosition();
  if (!echo) return;
  ctx.save();
  ctx.globalAlpha = 0.72 + Math.sin(elapsed * 8) * 0.14;
  ctx.translate(echo.x, echo.y);
  ctx.shadowColor = "#8ff9f5";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#baffff";
  ctx.beginPath();
  ctx.arc(0, -12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#72dfe8";
  roundedRect(-10, -3, 20, 27, 6);
  ctx.fill();
  ctx.strokeStyle = "#d9ffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-6, 22);
  ctx.lineTo(-9, 34);
  ctx.moveTo(6, 22);
  ctx.lineTo(9, 34);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(2, 34, 48, 0.92)";
  ctx.strokeStyle = "#8ff9f5";
  ctx.lineWidth = 2;
  roundedRect(-43, -58, 86, 25, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d9ffff";
  ctx.font = "900 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("PAST YOU", 0, -41);
  ctx.restore();

  const echoDistance = distance(player.x, player.y, echo.x, echo.y);
  if (echoDistance > 220) {
    const angle = Math.atan2(echo.y - player.y, echo.x - player.x);
    ctx.save();
    ctx.translate(player.x + Math.cos(angle) * 95, player.y + Math.sin(angle) * 95);
    ctx.rotate(angle);
    ctx.fillStyle = "#8ff9f5";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-angle);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 10px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("PAST YOU", 0, -18);
    ctx.restore();
  }
}

function drawCosmicEra(): void {
  if (cosmicTimeYears <= 0) {
    ctx.save();
    const flash = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 10, WIDTH / 2, HEIGHT / 2, 520);
    flash.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    flash.addColorStop(0.18, "rgba(255, 226, 92, 0.86)");
    flash.addColorStop(0.5, "rgba(255, 78, 44, 0.58)");
    flash.addColorStop(1, "rgba(50, 0, 82, 0.72)");
    ctx.fillStyle = flash;
    ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 52px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("THE BIG BANG", WIDTH / 2, 250);
    ctx.font = "900 18px Trebuchet MS";
    ctx.fillText("TIME = 0", WIDTH / 2, 285);
    ctx.restore();
  } else if (cosmicTimeYears >= BIG_CRUNCH_YEAR) {
    ctx.save();
    const collapse = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 5, WIDTH / 2, HEIGHT / 2, 520);
    collapse.addColorStop(0, "rgba(255, 48, 74, 0.72)");
    collapse.addColorStop(0.12, "rgba(65, 0, 18, 0.9)");
    collapse.addColorStop(1, "rgba(0, 0, 0, 0.97)");
    ctx.fillStyle = collapse;
    ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
    ctx.fillStyle = "#ff6278";
    ctx.font = "900 52px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("THE BIG CRUNCH", WIDTH / 2, 250);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px Trebuchet MS";
    ctx.fillText("THE LAST MOMENT", WIDTH / 2, 285);
    ctx.restore();
  }
}

function getCameraZoom(): number {
  if (mode === "paused" && mapOpen) return terrainLevel > 0 ? getTerrainZoom(terrainLevel) : 0.72;
  const followZoom = 1.05;
  if (terrainAnimationUntil <= elapsed || terrainLevel === 0) return followZoom;
  const progress = clamp(1 - (terrainAnimationUntil - elapsed) / 3.2, 0, 1);
  const revealAmount = Math.sin(progress * Math.PI);
  return followZoom + (getTerrainZoom(terrainLevel) - followZoom) * revealAmount;
}

function getCameraCenter(): { x: number; y: number } {
  if (mode === "paused" && mapOpen) return { x: WIDTH / 2, y: HEIGHT / 2 };
  return { x: player.x, y: player.y };
}

function getTerrainZoom(level: number): number {
  if (level <= 0) return 1;
  return Math.max(0.34, 0.58 - (level - 1) * 0.06);
}

function drawGeneratedTerrain(): void {
  for (let index = 0; index < sunkenRafts.length; index += 1) {
    const wreck = sunkenRafts[index];
    if (!wreck) continue;
    const surfaced = elapsed >= wreck.raisedAt;
    const bob = surfaced ? Math.sin(elapsed * 1.7 + wreck.bobOffset) * 3 : 9 + Math.sin(elapsed * 0.9 + wreck.bobOffset) * 2;
    ctx.save();
    ctx.translate(wreck.x, wreck.y + bob);
    ctx.rotate(Math.sin(wreck.bobOffset) * 0.055);
    ctx.globalAlpha = surfaced ? 1 : 0.48;
    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    roundedRect(-wreck.width / 2 + 7, -wreck.height / 2 + 9, wreck.width, wreck.height, 10);
    ctx.fill();
    for (let y = -wreck.height / 2; y < wreck.height / 2; y += 18) {
      ctx.fillStyle = isNightmareLevel()
        ? (y % 36 < 18 ? "#4c1d1d" : "#321313")
        : surfaced ? (y % 36 < 18 ? "#b9783d" : "#99602f") : "#466b70";
      roundedRect(-wreck.width / 2, y, wreck.width, 15, 4);
      ctx.fill();
      ctx.strokeStyle = isNightmareLevel() ? "#9d2437" : surfaced ? "#68401f" : "#78bdc4";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = isNightmareLevel() ? "#ff304a" : surfaced ? "#ffe56b" : "#baf9ff";
    ctx.font = "900 12px Trebuchet MS";
    ctx.textAlign = "center";
    const remaining = Math.max(0, Math.ceil(wreck.raisedAt - elapsed));
    ctx.fillText(
      surfaced
        ? wreck.bridgeBuilt ? `RAFT ${index + 1} • CONNECTED` : `RAFT ${index + 1} • BRIDGE NEEDED`
        : `SUNKEN RAFT ${index + 1} • ${formatTime(remaining)}`,
      0,
      5
    );
    if (!surfaced) {
      ctx.strokeStyle = "rgba(186, 249, 255, 0.7)";
      ctx.lineWidth = 2;
      for (let bubble = 0; bubble < 4; bubble += 1) {
        ctx.beginPath();
        ctx.arc(-40 + bubble * 27, -wreck.height / 2 - 10 - (bubble % 2) * 9, 4 + bubble % 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawTerrainGeneratorAnimation(): void {
  const progress = clamp(1 - (terrainAnimationUntil - elapsed) / 3.2, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(65, 242, 255, ${0.16 * (1 - progress)})`;
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.strokeStyle = "#72f5ff";
  ctx.shadowColor = "#72f5ff";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 30 + progress * 470, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(progress * Math.PI * 4);
  for (let beam = 0; beam < 8; beam += 1) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(45, 0);
    ctx.lineTo(150 + progress * 260, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFishingLine(): void {
  if (fishingUntil <= elapsed) return;
  ctx.save();
  ctx.strokeStyle = "#f4f0d5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x + 8, player.y - 2);
  ctx.quadraticCurveTo((player.x + fishingBobber.x) / 2, player.y - 55, fishingBobber.x, fishingBobber.y);
  ctx.stroke();
  ctx.fillStyle = "#ff625e";
  ctx.beginPath();
  ctx.arc(fishingBobber.x, fishingBobber.y + Math.sin(elapsed * 8) * 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 13px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(`FISHING... ${Math.max(1, Math.ceil(fishingUntil - elapsed))}`, fishingBobber.x, fishingBobber.y - 16);
  ctx.restore();
}

function drawOcean(): void {
  if (oceanDeleted) {
    // No water left — just the empty void the ocean used to sit in.
    ctx.fillStyle = "#04070a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }
  const nightmare = isNightmareLevel();
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, nightmare ? "#5b090d" : "#0b7896");
  gradient.addColorStop(0.52, nightmare ? "#31050a" : "#075a78");
  gradient.addColorStop(1, nightmare ? "#100106" : "#06435f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.strokeStyle = nightmare ? "rgba(255, 79, 79, 0.2)" : "rgba(179, 249, 255, 0.12)";
  ctx.lineWidth = 2;
  for (let y = 95; y < HEIGHT; y += 42) {
    ctx.beginPath();
    for (let x = -20; x <= WIDTH + 20; x += 20) {
      const waveY = y + Math.sin(x * 0.03 + elapsed * 1.8 + y) * 5;
      if (x === -20) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawNightmareAtmosphere(): void {
  ctx.save();
  ctx.fillStyle = "rgba(75, 0, 9, 0.12)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 105, WIDTH / 2, HEIGHT / 2, 620);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.65, "rgba(22, 0, 4, 0.2)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.78)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);

  const eyes = [
    { x: 75, y: 165, size: 5, phase: 0.2 },
    { x: 878, y: 205, size: 7, phase: 1.7 },
    { x: 820, y: 530, size: 4, phase: 3.1 },
    { x: 150, y: 505, size: 6, phase: 4.4 },
  ];
  for (const eye of eyes) {
    const blink = Math.sin(elapsed * 0.7 + eye.phase) > -0.94 ? 1 : 0.12;
    ctx.save();
    ctx.translate(eye.x, eye.y + Math.sin(elapsed * 0.35 + eye.phase) * 5);
    ctx.scale(1, blink);
    ctx.fillStyle = "rgba(255, 22, 48, 0.72)";
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(-eye.size * 1.4, 0, eye.size, eye.size * 0.48, -0.15, 0, Math.PI * 2);
    ctx.ellipse(eye.size * 1.4, 0, eye.size, eye.size * 0.48, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawLockedHorizon(): void {
  const gradient = ctx.createLinearGradient(690, 0, WIDTH, 0);
  gradient.addColorStop(0, "rgba(4, 67, 95, 0)");
  gradient.addColorStop(0.35, "rgba(3, 33, 52, 0.76)");
  gradient.addColorStop(1, "rgba(1, 20, 34, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(680, 78, WIDTH - 680, HEIGHT - 78);
  ctx.save();
  ctx.translate(820, 335);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(186, 231, 236, 0.7)";
  ctx.font = "900 15px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("3 RAFT EXPANSIONS REVEAL THE HORIZON", 0, 0);
  ctx.restore();
}

function drawIsland(): void {
  if (!isIslandUnlocked()) return;
  ISLANDS.forEach((island, islandIndex) => {
    if (!isIslandVisible(island)) return;
    ctx.save();
    ctx.translate(island.x, island.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(8, 12, island.radiusX + 8, island.radiusY + 7, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isNightmareLevel() ? "#6c4b42" : "#e8c77c";
    ctx.beginPath();
    ctx.ellipse(0, 0, island.radiusX, island.radiusY, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isNightmareLevel() ? (island.kind === "coconut" ? "#33151b" : "#3c2020") : island.kind === "coconut" ? "#65ad57" : "#74b85d";
    ctx.beginPath();
    ctx.ellipse(-10, -8, island.radiusX - 22, island.radiusY - 20, -0.08, 0, Math.PI * 2);
    ctx.fill();
    if (island.kind === "coconut") drawPalmTree(islandIndex);
    else if (elapsed >= (animalReadyAt[islandIndex] ?? 0)) drawFarmAnimal(island.kind);
    else {
      ctx.fillStyle = "#d8f0e5";
      ctx.font = "800 12px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(`RETURNS IN ${Math.ceil((animalReadyAt[islandIndex] ?? elapsed) - elapsed)}s`, 0, 0);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 13px Trebuchet MS";
    ctx.textAlign = "center";
    const nightmareName = island.kind === "coconut" ? (islandIndex === 0 ? "BLOOD ORANGE GROVE" : "WITHERED ORCHARD") : island.kind === "cow" ? "HOLLOW PASTURE" : "BLACK WOOL SHORE";
    ctx.fillText(bridgesBuilt > islandIndex ? (isNightmareLevel() ? nightmareName : island.name) : isNightmareLevel() ? "BONE BRIDGE NEEDED" : "BRIDGE NEEDED", -4, 50);
    ctx.restore();
  });
}

function drawPalmTree(islandIndex: number): void {
  if (isNightmareLevel()) {
    drawBloodOrangeTree(islandIndex);
    return;
  }
  ctx.strokeStyle = "#71451f";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(18, -5);
  ctx.lineTo(3, -57);
  ctx.stroke();
  ctx.fillStyle = "#2b8f50";
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.translate(3, -58);
    ctx.rotate((Math.PI * 2 * i) / 6);
    ctx.beginPath();
    ctx.ellipse(24, 0, 30, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const coconutCount = getAvailableCoconuts(islandIndex);
  ctx.fillStyle = "#79502b";
  for (let index = 0; index < coconutCount; index += 1) {
    const angle = index * 2.399963;
    const spread = coconutCount === 1 ? 0 : Math.min(30, 4 + Math.sqrt(index) * 3);
    const x = 3 + Math.cos(angle) * spread;
    const y = -50 + Math.sin(angle) * spread * 0.55;
    const radius = coconutCount <= 8 ? 5 : coconutCount <= 35 ? 3.5 : 2.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.font = "900 12px Trebuchet MS";
  ctx.fillStyle = coconutCount > 0 ? "#fff0ad" : "#d8f0e5";
  ctx.fillText(coconutCount > 0 ? `COCONUTS ×${coconutCount}` : "GROWING...", 0, 24);
}

function drawBloodOrangeTree(islandIndex: number): void {
  const fruitCount = getAvailableCoconuts(islandIndex);
  ctx.save();
  ctx.strokeStyle = "#17090b";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4, 3);
  ctx.lineTo(0, -34);
  ctx.lineTo(-23, -57);
  ctx.moveTo(0, -34);
  ctx.lineTo(25, -61);
  ctx.moveTo(-10, -43);
  ctx.lineTo(-37, -38);
  ctx.moveTo(12, -47);
  ctx.lineTo(39, -39);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#751021";
  ctx.beginPath();
  ctx.moveTo(1, -3);
  ctx.lineTo(-1, -32);
  ctx.stroke();
  ctx.fillStyle = "#21080d";
  for (const [x, y, radius] of [[-24, -57, 18], [0, -66, 22], [25, -59, 19], [-35, -39, 14], [38, -40, 14]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let index = 0; index < fruitCount; index += 1) {
    const angle = index * 2.399963;
    const spread = fruitCount === 1 ? 0 : Math.min(39, 7 + Math.sqrt(index) * 3.2);
    const x = Math.cos(angle) * spread;
    const y = -54 + Math.sin(angle) * spread * 0.48;
    const radius = fruitCount <= 8 ? 5.5 : fruitCount <= 35 ? 3.8 : 2.5;
    ctx.fillStyle = "#d52b18";
    ctx.shadowColor = "#ff1f19";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.font = "900 12px Trebuchet MS";
  ctx.fillStyle = fruitCount > 0 ? "#ff6975" : "#9a4c57";
  ctx.fillText(fruitCount > 0 ? `BLOOD ORANGES ×${fruitCount}` : "THE TREE IS HUNGRY...", 0, 24);
  ctx.restore();
}

function drawFarmAnimal(kind: "cow" | "sheep"): void {
  if (isNightmareLevel()) {
    drawNightmareAnimal(kind);
    return;
  }
  ctx.save();
  ctx.translate(0, -8 + Math.sin(elapsed * 3) * 2);
  ctx.fillStyle = kind === "cow" ? "#f4eee4" : "#fffdf7";
  ctx.beginPath();
  ctx.ellipse(0, 0, kind === "cow" ? 31 : 27, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(27, -5, kind === "cow" ? 15 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = kind === "cow" ? "#5a4033" : "#ddd6cc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-16, 12);
  ctx.lineTo(-17, 28);
  ctx.moveTo(14, 12);
  ctx.lineTo(15, 28);
  ctx.stroke();
  if (kind === "cow") {
    ctx.fillStyle = "#50382f";
    ctx.beginPath();
    ctx.ellipse(-9, -5, 9, 7, 0.2, 0, Math.PI * 2);
    ctx.ellipse(12, 5, 7, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#ded8ce";
    ctx.lineWidth = 3;
    for (let x = -17; x <= 15; x += 10) {
      ctx.beginPath();
      ctx.arc(x, -4, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#1c2630";
  ctx.beginPath();
  ctx.arc(32, -9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNightmareAnimal(kind: "cow" | "sheep"): void {
  ctx.save();
  ctx.translate(0, -8 + Math.sin(elapsed * 2.2) * 1.5);
  ctx.fillStyle = kind === "cow" ? "#281217" : "#171116";
  ctx.strokeStyle = "#6b2733";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, kind === "cow" ? 32 : 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(27, -6, kind === "cow" ? 15 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#241015";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-17, 11);
  ctx.lineTo(-22, 31);
  ctx.moveTo(14, 11);
  ctx.lineTo(20, 31);
  ctx.stroke();
  if (kind === "sheep") {
    ctx.strokeStyle = "#814052";
    ctx.lineWidth = 2;
    for (let x = -18; x <= 14; x += 8) {
      ctx.beginPath();
      ctx.arc(x, -3, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "#b68c78";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, -17);
    ctx.lineTo(13, -29);
    ctx.moveTo(34, -18);
    ctx.lineTo(42, -29);
    ctx.stroke();
  }
  ctx.fillStyle = "#ff1738";
  ctx.shadowColor = "#ff001e";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(31, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBridges(): void {
  if (isIslandUnlocked()) {
    ISLANDS.slice(0, bridgesBuilt).forEach((island) => {
      if (!isIslandVisible(island)) return;
      const { start, end } = getBridgeSegment(island);
      drawBridgeDeck(start, end);
    });
  }
  sunkenRafts.forEach((wreck) => {
    if (!wreck.bridgeBuilt || elapsed < wreck.raisedAt) return;
    const { start, end } = getSunkenRaftBridgeSegment(wreck);
    drawBridgeDeck(start, end);
  });
}

function drawBridgeDeck(start: { x: number; y: number }, end: { x: number; y: number }): void {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = distance(start.x, start.y, end.x, end.y);
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(angle);
  const nightmare = isNightmareLevel();
  ctx.fillStyle = nightmare ? "#160a0d" : "#6f4324";
  ctx.fillRect(0, -BRIDGE_DECK_HALF_WIDTH, length, BRIDGE_DECK_HALF_WIDTH * 2);
  for (let x = 3; x < length; x += 18) {
    ctx.fillStyle = nightmare ? (x % 36 < 18 ? "#d4c1a1" : "#8d7767") : x % 36 < 18 ? "#bc7a3d" : "#a86632";
    ctx.fillRect(x, -BRIDGE_DECK_HALF_WIDTH + 3, 15, BRIDGE_DECK_HALF_WIDTH * 2 - 6);
  }
  ctx.strokeStyle = nightmare ? "#751021" : "#e0b066";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -BRIDGE_DECK_HALF_WIDTH - 3);
  ctx.lineTo(length, -BRIDGE_DECK_HALF_WIDTH - 3);
  ctx.moveTo(0, BRIDGE_DECK_HALF_WIDTH + 3);
  ctx.lineTo(length, BRIDGE_DECK_HALF_WIDTH + 3);
  ctx.stroke();
  ctx.restore();
}

function drawBubbles(): void {
  ctx.save();
  ctx.strokeStyle = isNightmareLevel() ? "#b51f31" : "#d4ffff";
  for (const bubble of bubbles) {
    ctx.globalAlpha = bubble.opacity;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRaft(): void {
  if (homeRaftDeleted) return;
  const growth = Math.min(70, expansionCount * 14);
  const raft = getRaftBounds();
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.rotate(Math.sin(elapsed * 0.9) * 0.006);
  ctx.translate(-WIDTH / 2, -HEIGHT / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  roundedRect(raft.x + 8, raft.y + 12, raft.width, raft.height, 12);
  ctx.fill();
  for (let y = raft.y; y < raft.y + raft.height; y += 23) {
    ctx.fillStyle = isNightmareLevel() ? (y % 46 < 23 ? "#4c1d1d" : "#321313") : y % 46 < 23 ? "#b9783d" : "#a66531";
    roundedRect(raft.x, y, raft.width, 20, 5);
    ctx.fill();
    ctx.strokeStyle = isNightmareLevel() ? "#170609" : "#69401f";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = isNightmareLevel() ? "#220b0d" : "#6b4124";
  ctx.fillRect(raft.x + 22, raft.y - 8, 8, raft.height + 16);
  ctx.fillRect(raft.x + raft.width - 30, raft.y - 8, 8, raft.height + 16);
  ctx.fillStyle = isNightmareLevel() ? "rgba(30, 0, 7, 0.88)" : "rgba(72, 42, 20, 0.88)";
  ctx.strokeStyle = isNightmareLevel() ? "#ff5269" : "#efc86f";
  ctx.lineWidth = 2;
  roundedRect(raft.x + raft.width / 2 - 92, raft.y + raft.height - 32, 184, 24, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isNightmareLevel() ? "#ff9eaa" : "#fff0aa";
  ctx.font = "900 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(raftName.toUpperCase(), raft.x + raft.width / 2, raft.y + raft.height - 15, 170);
  if (hasCraftingTable) drawCraftingTable();
  if (chestCount > 0) drawChests();
  if (hasTimeWarper) drawTimeWarperMachine();
  if (hasStorageCompartment) drawStorageCompartment();
  if (hasCargoDock) drawCargoDock();
  if (hasFisherBot) drawFisherBot();
  if (hasFisherBot) drawFisherBotCatchBox();
  ctx.restore();
}

function getFisherBotPosition(): { x: number; y: number; lineX: number; lineY: number } {
  const raft = getRaftBounds();
  return {
    x: raft.x + 48,
    y: raft.y + raft.height - 55,
    lineX: raft.x - 58,
    lineY: raft.y + raft.height - 12,
  };
}

function drawFisherBot(): void {
  const bot = getFisherBotPosition();
  const bob = Math.sin(elapsed * 2.8) * 3;
  ctx.save();
  ctx.strokeStyle = isNightmareLevel() ? "#8d1728" : "#d8e8eb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bot.x - 12, bot.y - 13);
  ctx.quadraticCurveTo(bot.x - 64, bot.y - 58, bot.lineX, bot.lineY + bob);
  ctx.stroke();
  ctx.fillStyle = "#ffdc67";
  ctx.beginPath();
  ctx.arc(bot.lineX, bot.lineY + bob, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(bot.x, bot.y);
  ctx.fillStyle = isNightmareLevel() ? "#21070d" : "#315c6d";
  ctx.strokeStyle = isNightmareLevel() ? "#ff304a" : "#8ff9f5";
  ctx.lineWidth = 3;
  roundedRect(-17, -22, 34, 36, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isNightmareLevel() ? "#ff1738" : "#8ff9f5";
  ctx.beginPath();
  ctx.arc(-6, -10, 3, 0, Math.PI * 2);
  ctx.arc(6, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffdc67";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.lineTo(-23, -28);
  ctx.stroke();
  ctx.fillStyle = "#ffe56b";
  ctx.font = "900 8px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("FISH", 0, 7);
  ctx.restore();
}

function drawFisherBotCatchBox(): void {
  const raft = getRaftBounds();
  const x = raft.x + 78;
  const y = raft.y + raft.height - 112;
  const width = 118;
  const height = 64;
  ctx.save();
  ctx.fillStyle = isNightmareLevel() ? "#1a070b" : "#704522";
  ctx.strokeStyle = isNightmareLevel() ? "#9b1930" : "#d49a52";
  ctx.lineWidth = 4;
  roundedRect(x, y, width, height, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isNightmareLevel() ? "#260a11" : "#173f50";
  roundedRect(x + 7, y + 8, width - 14, height - 21, 5);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 8, y + 7, width - 16, height - 18);
  ctx.clip();
  const visibleCatches = fisherBotCatches.slice(-8);
  visibleCatches.forEach((name, index) => {
    const fish = fishCatches.find((entry) => entry.name === name);
    if (!fish) return;
    const column = index % 4;
    const row = Math.floor(index / 4);
    drawMiniFishSprite(fish, x + 20 + column * 26, y + 19 + row * 20, 0.68, index % 2 === 1);
  });
  ctx.restore();

  ctx.fillStyle = isNightmareLevel() ? "#ff7386" : "#ffe56b";
  ctx.font = "900 8px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(fisherBotCatches.length > 0 ? `FISH BOX ×${fisherBotCatches.length}` : "FISH BOX • EMPTY", x + width / 2, y + height - 5);
  ctx.restore();
}

function drawMiniFishSprite(fish: FishCatch, x: number, y: number, scale: number, flip: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.globalAlpha = fish.name === "Ghostfish" ? 0.58 : 1;
  ctx.strokeStyle = "rgba(238, 253, 255, 0.85)";
  ctx.lineWidth = 2;

  if (fish.name === "Old Boot") {
    ctx.fillStyle = fish.color;
    roundedRect(-8, -10, 13, 20, 4);
    ctx.fill();
    roundedRect(0, 3, 16, 8, 3);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (fish.name === "Rubber Duck") {
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(0, 3, 13, 7, 0, 0, Math.PI * 2);
    ctx.arc(9, -5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8e32";
    ctx.fillRect(14, -6, 7, 4);
    ctx.restore();
    return;
  }

  ctx.fillStyle = fish.color;
  if (fish.name === "Pufferfish" || fish.name === "Sunfish") {
    ctx.beginPath();
    ctx.arc(2, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (fish.name === "Jellyfish") {
    ctx.beginPath();
    ctx.arc(2, -2, 10, Math.PI, 0);
    ctx.lineTo(12, 5);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fill();
    for (let tentacle = -6; tentacle <= 8; tentacle += 7) {
      ctx.beginPath();
      ctx.moveTo(tentacle, 5);
      ctx.lineTo(tentacle - 2, 13);
      ctx.stroke();
    }
    ctx.restore();
    return;
  } else if (fish.name === "Robot Fish" || fish.name === "Glitched Fish") {
    ctx.fillRect(-10, -7, 25, 14);
    if (fish.name === "Glitched Fish") {
      ctx.fillStyle = "#54f6ff";
      ctx.fillRect(-4, -7, 6, 14);
      ctx.fillStyle = "#18122c";
      ctx.fillRect(8, -7, 5, 14);
    }
  } else if (fish.name === "Diamondfish") {
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-3, -9);
    ctx.lineTo(12, -7);
    ctx.lineTo(17, 0);
    ctx.lineTo(10, 8);
    ctx.lineTo(-3, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(2, 0, fish.name === "Tiny Sardine" ? 12 : 17, fish.name === "Tiny Sardine" ? 5 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (fish.name !== "Pufferfish" && fish.name !== "Sunfish") {
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-23, -9);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-23, 9);
    ctx.closePath();
    ctx.fill();
  }
  if (fish.name === "Swordfish") {
    ctx.fillStyle = "#e7fbff";
    ctx.fillRect(14, -1, 18, 3);
  }
  if (fish.name === "Anglerfish") {
    ctx.beginPath();
    ctx.arc(9, -13, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff36b";
    ctx.fill();
    ctx.strokeStyle = "#9fb2b7";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(4, -17, 9, -13);
    ctx.stroke();
  }
  if (fish.name === "Kingfish") {
    ctx.fillStyle = "#ffd84e";
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(0, -16);
    ctx.lineTo(5, -9);
    ctx.lineTo(10, -16);
    ctx.lineTo(12, -6);
    ctx.closePath();
    ctx.fill();
  }
  if (fish.name === "Pirate Fish") {
    ctx.strokeStyle = "#17212a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(15, -4);
    ctx.stroke();
  }
  if (fish.name === "Moonfish") {
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 5, -1.3, 1.3);
    ctx.stroke();
  }
  ctx.fillStyle = fish.name === "Robot Fish" ? "#ff4242" : "#071b25";
  ctx.beginPath();
  ctx.arc(12, -2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTimeWarperMachine(): void {
  const raft = getRaftBounds();
  const x = raft.x + raft.width - 92;
  const y = raft.y + raft.height - 48;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = isNightmareLevel() ? "#260711" : "#3d1f56";
  ctx.strokeStyle = isNightmareLevel() ? "#ff304a" : "#d28cff";
  ctx.lineWidth = 4;
  roundedRect(-28, -34, 56, 68, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = isNightmareLevel() ? "#ff8394" : "#8ff9f5";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -7, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.rotate(elapsed * 0.9);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -13);
  ctx.moveTo(0, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#ffe56b";
  ctx.font = "900 9px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("TIME", 0, 27);
  ctx.restore();
}

function drawStorageCompartment(): void {
  const raft = getRaftBounds();
  const miniRaft = getStorageMiniRaftBounds();
  const compartment = getStorageCompartmentPosition();
  const nightmare = isNightmareLevel();
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  roundedRect(miniRaft.x + 6, miniRaft.y + 8, miniRaft.width, miniRaft.height, 10);
  ctx.fill();

  // A short planked neck keeps the storage platform visibly attached and walkable.
  ctx.fillStyle = nightmare ? "#321313" : "#a66531";
  ctx.strokeStyle = nightmare ? "#8e1730" : "#69401f";
  ctx.lineWidth = 2;
  ctx.fillRect(miniRaft.x + miniRaft.width / 2 - 24, miniRaft.y + miniRaft.height - 3, 48, raft.y - (miniRaft.y + miniRaft.height) + 6);
  ctx.strokeRect(miniRaft.x + miniRaft.width / 2 - 24, miniRaft.y + miniRaft.height - 3, 48, raft.y - (miniRaft.y + miniRaft.height) + 6);
  for (let y = miniRaft.y; y < miniRaft.y + miniRaft.height; y += 14) {
    ctx.fillStyle = nightmare ? (y % 28 < 14 ? "#4c1d1d" : "#321313") : y % 28 < 14 ? "#b9783d" : "#a66531";
    roundedRect(miniRaft.x, y, miniRaft.width, 12, 4);
    ctx.fill();
    ctx.strokeStyle = nightmare ? "#170609" : "#69401f";
    ctx.stroke();
  }
  ctx.strokeStyle = nightmare ? "#c3203a" : "#d4aa64";
  ctx.lineWidth = 3;
  roundedRect(miniRaft.x, miniRaft.y, miniRaft.width, miniRaft.height, 10);
  ctx.stroke();

  ctx.fillStyle = nightmare ? "#090104" : "#102d38";
  ctx.strokeStyle = nightmare ? "#b41631" : "#8ff9f5";
  ctx.lineWidth = 3;
  roundedRect(compartment.x - 48, compartment.y - 17, 96, 39, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = nightmare ? "#671020" : "#557985";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(compartment.x - 40, compartment.y - 10);
  ctx.lineTo(compartment.x + 40, compartment.y - 10);
  ctx.stroke();
}

function drawStorageCompartmentFront(): void {
  const compartment = getStorageCompartmentPosition();
  const nightmare = isNightmareLevel();
  ctx.save();
  ctx.fillStyle = nightmare ? "#26050c" : "#334e5b";
  ctx.strokeStyle = nightmare ? "#b41631" : "#8ff9f5";
  ctx.lineWidth = 3;
  roundedRect(compartment.x - 48, compartment.y + 2, 96, 21, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = nightmare ? "#ff2946" : "#ffd65c";
  ctx.font = "900 9px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(nightmare ? "HARVEST VAULT" : "BOT STORAGE", compartment.x, compartment.y + 16);
  ctx.restore();
}

function drawCollectorBots(): void {
  const nightmare = isNightmareLevel();
  for (const [index, bot] of collectorBots.entries()) {
    const walking = bot.state === "outbound" || bot.state === "returning";
    const step = walking ? Math.sin(elapsed * 12 + bot.stepOffset) * 4 : 0;
    ctx.save();
    ctx.translate(bot.x, bot.y + Math.sin(elapsed * 4 + index) * 1.5);
    if (bot.state === "harvesting") {
      ctx.strokeStyle = nightmare ? "#ff2946" : "#ffe56b";
      ctx.lineWidth = 2;
      for (let spark = 0; spark < 4; spark += 1) {
        const angle = elapsed * 5 + spark * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
        ctx.lineTo(Math.cos(angle) * 21, Math.sin(angle) * 21);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = nightmare ? "#7c1022" : "#364d56";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 7);
    ctx.lineTo(-10 + step, 15);
    ctx.moveTo(7, 7);
    ctx.lineTo(10 - step, 15);
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#27050b" : "#829aa5";
    ctx.strokeStyle = nightmare ? "#ff2946" : "#d6fbff";
    ctx.lineWidth = 2;
    roundedRect(-10, -9, 20, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#ff1738" : "#52eff3";
    ctx.fillRect(-6, -4, 4, 4);
    ctx.fillRect(2, -4, 4, 4);
    if (bot.cargo) {
      ctx.fillStyle = bot.cargo.healing === 99 ? "#f1d1a5" : bot.cargo.source === "blood-orange" ? "#9b0b22" : "#8a552d";
      ctx.strokeStyle = nightmare ? "#ff2946" : "#ffe56b";
      ctx.lineWidth = 2;
      roundedRect(-9, -19, 18, 10, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = nightmare ? "#ff8998" : "#ffffff";
    ctx.font = "900 8px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(bot.state === "harvesting" ? "WORK" : `${index + 1}`, 0, 4);
    ctx.restore();
  }
}

function drawCollectorDrops(onCompartment: boolean): void {
  for (const drop of collectorDrops) {
    if (drop.onCompartment !== onCompartment) continue;
    const nightmare = isNightmareLevel();
    ctx.save();
    ctx.translate(drop.x, drop.y);
    if (drop.source === "coconut") {
      ctx.fillStyle = "#8a552d";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (drop.source === "blood-orange") {
      ctx.fillStyle = "#9b0b22";
      ctx.shadowColor = "#ff1738";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = nightmare ? "#5b101c" : "#f1d1a5";
      roundedRect(-12, -9, 24, 18, 6);
      ctx.fill();
      ctx.strokeStyle = nightmare ? "#ff2946" : "#8a5c3d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = nightmare ? "#ffb2bd" : "#503625";
      ctx.font = "900 9px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText(drop.source === "cow" ? "COW" : "SHEEP", 0, 3);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#092436";
    ctx.lineWidth = 3;
    ctx.font = "900 11px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.strokeText(`×${drop.count}`, 0, -14);
    ctx.fillText(`×${drop.count}`, 0, -14);
    ctx.restore();
  }
}

function drawCargoDock(): void {
  const raft = getRaftBounds();
  const dock = getCargoDockPosition();
  const nightmare = isNightmareLevel();
  const raftBottom = raft.y + raft.height;
  ctx.fillStyle = nightmare ? "#17070a" : "#614126";
  ctx.fillRect(dock.x - 32, raftBottom - 5, 64, dock.y - raftBottom + 13);
  ctx.fillStyle = nightmare ? "#23080d" : "#765033";
  ctx.fillRect(dock.x - 92, dock.y - 38, 184, 82);
  ctx.strokeStyle = nightmare ? "#8e1730" : "#d4aa64";
  ctx.lineWidth = 3;
  for (let x = dock.x - 88; x < dock.x + 88; x += 18) {
    ctx.strokeRect(x, dock.y - 35, 15, 76);
  }
  ctx.fillStyle = nightmare ? "#ff304a" : "#75eff2";
  ctx.font = "900 10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(nightmare ? "BLACK DOCK" : "SAFE CARGO PICKUP", dock.x, dock.y - 35);
  ctx.fillStyle = nightmare ? "#3b0b14" : "#243f4d";
  ctx.fillRect(dock.x - 96, dock.y - 35, 7, 76);
  ctx.fillRect(dock.x + 89, dock.y - 35, 7, 76);
  ctx.fillStyle = nightmare ? "#ff1738" : "#ffdc67";
  ctx.beginPath();
  ctx.arc(dock.x - 92, dock.y - 36, 5, 0, Math.PI * 2);
  ctx.arc(dock.x + 92, dock.y - 36, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawScoldBot(): void {
  if (!hasScoldBot) return;
  const bot = getScoldBotPosition();
  const nightmare = isNightmareLevel();

  if (hasSuperScoldBot && elapsed < scoldBeamUntil) {
    const blastProgress = clamp(1 - (scoldBeamUntil - elapsed) / 0.9, 0, 1);
    ctx.save();
    ctx.strokeStyle = nightmare ? `rgba(255, 48, 74, ${0.8 - blastProgress * 0.6})` : `rgba(255, 230, 109, ${0.8 - blastProgress * 0.6})`;
    ctx.lineWidth = 8 - blastProgress * 5;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 45 + blastProgress * 390 - ring * 42;
      if (radius <= 0) continue;
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!hasSuperScoldBot && scoldTarget && elapsed < scoldBeamUntil) {
    ctx.save();
    ctx.strokeStyle = nightmare ? "#ff304a" : "#ffe66d";
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 7]);
    ctx.beginPath();
    ctx.moveTo(bot.x, bot.y - 8);
    ctx.lineTo(scoldTarget.x, scoldTarget.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(bot.x, bot.y + Math.sin(elapsed * 4) * 1.5);
  ctx.fillStyle = nightmare ? "#21070d" : "#526b77";
  ctx.strokeStyle = nightmare ? "#ff304a" : "#baf9ff";
  ctx.lineWidth = 3;
  roundedRect(-19, -25, 38, 39, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = nightmare ? "#ff1738" : "#8ff9f5";
  ctx.beginPath();
  ctx.arc(-7, -12, 4, 0, Math.PI * 2);
  ctx.arc(7, -12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = nightmare ? "#ff7285" : "#153746";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(9, 2);
  ctx.stroke();
  if (hasSuperScoldBot) {
    ctx.fillStyle = nightmare ? "#7e1225" : "#ffd84e";
    ctx.strokeStyle = nightmare ? "#ff667a" : "#5c4510";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(16, -5);
    ctx.lineTo(45, -19);
    ctx.lineTo(45, 15);
    ctx.lineTo(16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#310810" : "#594515";
    ctx.fillRect(42, -22, 8, 40);
  }
  ctx.strokeStyle = nightmare ? "#7d1929" : "#354e5a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-11, 15);
  ctx.lineTo(-14, 27);
  ctx.moveTo(11, 15);
  ctx.lineTo(14, 27);
  ctx.stroke();
  ctx.restore();

  if (elapsed < scoldBubbleUntil && scoldMessage) {
    const bubbleX = bot.x + 25;
    const bubbleY = bot.y - 73;
    ctx.save();
    ctx.fillStyle = nightmare ? "#25060c" : "#ffffff";
    ctx.strokeStyle = nightmare ? "#ff304a" : "#173746";
    ctx.lineWidth = 3;
    roundedRect(bubbleX, bubbleY, 175, 50, 13);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bubbleX + 18, bubbleY + 49);
    ctx.lineTo(bot.x + 8, bot.y - 25);
    ctx.lineTo(bubbleX + 39, bubbleY + 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#ff8b9a" : "#173746";
    ctx.font = "900 13px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(scoldMessage, bubbleX + 87, bubbleY + 30, 155);
    ctx.restore();
  }
}

function drawCargoShips(): void {
  if (!hasCargoDock) return;
  const dock = getCargoDockPosition();
  for (const ship of cargoShips) {
    const destination = ship.state === "collecting" && ship.target ? ship.target : dock;
    const angle = Math.atan2(destination.y - ship.y, destination.x - ship.x);
    const nightmare = isNightmareLevel();
    ctx.save();
    ctx.translate(ship.x, ship.y + Math.sin(elapsed * 3 + ship.bobOffset) * 2);
    ctx.rotate(angle);
    ctx.strokeStyle = nightmare ? "rgba(255, 38, 67, 0.28)" : "rgba(196, 247, 255, 0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-48, -15);
    ctx.lineTo(-74, -23);
    ctx.moveTo(-48, 15);
    ctx.lineTo(-74, 23);
    ctx.moveTo(-55, 0);
    ctx.lineTo(-83, 0);
    ctx.stroke();

    // Long ocean-going hull with a raised bow.
    ctx.fillStyle = nightmare ? "#110307" : "#324f60";
    ctx.strokeStyle = nightmare ? "#a71932" : "#9ceef0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-52, -21);
    ctx.lineTo(41, -21);
    ctx.lineTo(62, -8);
    ctx.lineTo(65, 0);
    ctx.lineTo(62, 8);
    ctx.lineTo(41, 21);
    ctx.lineTo(-52, 21);
    ctx.lineTo(-61, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stacked shipping containers make the ship readable even at a glance.
    const containerColors = nightmare ? ["#520c18", "#791126", "#3a070f"] : ["#e85d3f", "#e5b83d", "#3b9ec1", "#4f9b68"];
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        ctx.fillStyle = containerColors[(row * 3 + column) % containerColors.length] ?? containerColors[0] ?? "#e85d3f";
        const containerX = -17 + column * 19;
        const containerY = -17 + row * 18;
        ctx.fillRect(containerX, containerY, 16, 15);
        ctx.strokeStyle = nightmare ? "#b31b33" : "#193341";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(containerX, containerY, 16, 15);
        ctx.beginPath();
        ctx.moveTo(containerX + 5, containerY + 2);
        ctx.lineTo(containerX + 5, containerY + 13);
        ctx.moveTo(containerX + 11, containerY + 2);
        ctx.lineTo(containerX + 11, containerY + 13);
        ctx.stroke();
      }
    }

    // Bridge, windows, and twin smokestacks at the stern.
    ctx.fillStyle = nightmare ? "#3e0b15" : "#e7f4e8";
    ctx.fillRect(-48, -18, 25, 36);
    ctx.strokeStyle = nightmare ? "#a71932" : "#183542";
    ctx.strokeRect(-48, -18, 25, 36);
    ctx.fillStyle = nightmare ? "#ff1738" : "#68d8ed";
    ctx.fillRect(-43, -14, 8, 8);
    ctx.fillRect(-43, 6, 8, 8);
    ctx.fillStyle = nightmare ? "#1a0307" : "#273841";
    ctx.fillRect(-34, -12, 8, 7);
    ctx.fillRect(-34, 5, 8, 7);
    if (ship.cargo) {
      ctx.fillStyle = crateColor(ship.cargo);
      ctx.strokeStyle = "#241118";
      ctx.lineWidth = 2;
      ctx.fillRect(41, -13, 18, 26);
      ctx.strokeRect(41, -13, 18, 26);
    }
    if (nightmare) {
      ctx.fillStyle = "#ff1738";
      ctx.shadowColor = "#ff001e";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(55, -5, 3, 0, Math.PI * 2);
      ctx.arc(55, 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCraftingTable(): void {
  const raft = getRaftBounds();
  const x = raft.x + 28;
  const y = raft.y + 34;
  const nightmare = isNightmareLevel();
  ctx.fillStyle = nightmare ? "#19090c" : "#704322";
  ctx.fillRect(x, y, 58, 46);
  ctx.fillStyle = nightmare ? "#3f1018" : "#cf8b43";
  ctx.fillRect(x - 4, y - 5, 66, 13);
  ctx.strokeStyle = nightmare ? "#c3203a" : "#432615";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, 58, 46);
  ctx.fillStyle = nightmare ? "#ff2946" : "#f3d199";
  if (nightmare) {
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 9;
  }
  ctx.font = nightmare ? "900 24px serif" : "900 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(nightmare ? "⛧" : craftingTableLevel >= TECHNO_CRAFTING_LEVEL ? "TECH" : `LV${craftingTableLevel}`, x + 29, y + 33);
  ctx.shadowBlur = 0;
  if (craftingTableLevel >= TECHNO_CRAFTING_LEVEL) {
    ctx.strokeStyle = nightmare ? "#ff304a" : "#72f5ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 29, y - 5);
    ctx.lineTo(x + 29, y - 24);
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#ff1738" : "#ffe66d";
    ctx.beginPath();
    ctx.arc(x + 29, y - 27, 5 + Math.sin(elapsed * 5) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChests(): void {
  const raft = getRaftBounds();
  const visibleChests = Math.min(chestCount, 4);
  for (let index = 0; index < visibleChests; index += 1) {
    const x = raft.x + raft.width - 76 - (index % 2) * 50;
    const y = raft.y + 30 + Math.floor(index / 2) * 44;
    const nightmare = isNightmareLevel();
    ctx.fillStyle = nightmare ? "#21070d" : "#8a5429";
    ctx.fillRect(x, y, 42, 30);
    ctx.strokeStyle = nightmare ? "#9d1730" : "#3f2818";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, 42, 30);
    ctx.fillStyle = nightmare ? "#ff2946" : "#d7ad58";
    if (nightmare) {
      ctx.shadowColor = "#ff001e";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(x + 21, y + 11, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e3c8b0";
      for (let tooth = 0; tooth < 5; tooth += 1) {
        ctx.beginPath();
        ctx.moveTo(x + 5 + tooth * 8, y + 19);
        ctx.lineTo(x + 9 + tooth * 8, y + 27);
        ctx.lineTo(x + 13 + tooth * 8, y + 19);
        ctx.fill();
      }
    } else {
      ctx.fillRect(x + 17, y + 12, 8, 8);
    }
  }
}

function drawShopkeeper(): void {
  if (shopkeeperDeleted || !isShopkeeperHere()) return;
  const x = 690;
  const y = 320 + Math.sin(elapsed * 2) * 3;
  ctx.save();
  ctx.translate(x, y);
  const nightmare = isNightmareLevel();
  ctx.fillStyle = nightmare ? "#100307" : "#7b4926";
  ctx.beginPath();
  ctx.moveTo(-55, 8);
  ctx.lineTo(55, 8);
  ctx.lineTo(36, 30);
  ctx.lineTo(-38, 30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = nightmare ? "#741024" : "#3b2518";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = nightmare ? "#d8c8bd" : "#f0bd82";
  ctx.beginPath();
  ctx.arc(0, -21, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = nightmare ? "#22040b" : "#6b35a1";
  ctx.fillRect(-14, -7, 28, 30);
  ctx.fillStyle = nightmare ? "#080205" : "#ffd84e";
  ctx.beginPath();
  ctx.moveTo(-23, -32);
  ctx.lineTo(0, -57);
  ctx.lineTo(23, -32);
  ctx.closePath();
  ctx.fill();
  if (nightmare) {
    ctx.fillStyle = "#ff1738";
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-5, -23, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -23, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#6f0d1d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -13);
    ctx.quadraticCurveTo(0, -7, 9, -13);
    ctx.stroke();
  }
  ctx.fillStyle = nightmare ? "#ff9aa7" : "#ffffff";
  ctx.font = "900 12px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(nightmare ? "THE MERCHANT WAITS" : gameKind === "creative" ? "SHOP ALWAYS OPEN" : `SHOP ${Math.ceil(shopkeeperUntil - elapsed)}s`, 0, 49);
  ctx.restore();
}

function drawCrates(deliveredOnly: boolean): void {
  for (const crate of crates) {
    if (Boolean(crate.deliveredByCargoShip) !== deliveredOnly) continue;
    const bob = crate.deliveredByCargoShip ? 0 : Math.sin(elapsed * 2.5 + crate.bobOffset) * 4;
    const age = elapsed - crate.landedAt;
    ctx.save();
    ctx.translate(crate.x, crate.y + bob);
    if (age < 2.4) {
      const parachuteY = -82 + age * 28;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-17, -20);
      ctx.lineTo(-34, parachuteY + 15);
      ctx.moveTo(17, -20);
      ctx.lineTo(34, parachuteY + 15);
      ctx.stroke();
      ctx.fillStyle = crate.kind === "super"
        ? "#ffffff"
        : crate.kind === "hacker" ? "#4dff9b" : crate.kind === "rainbow" ? crateColor(crate) : crate.kind === "blood" ? "#4d000c" : crate.kind === "technology" ? "#7df5ff" : "#f5efe2";
      ctx.beginPath();
      ctx.arc(0, parachuteY, 38, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
    const color = crate.kind === "super"
      ? "#fff7a8"
      : crate.kind === "hacker" ? "#062e1f" : crate.kind === "rainbow" ? crateColor(crate) : crate.kind === "blood" ? "#760014" : crate.kind === "technology" ? "#237b91" : crate.kind === "wooden" ? "#9b5e2e" : crate.material?.color ?? "#a96b34";
    ctx.fillStyle = color;
    ctx.strokeStyle = crate.kind === "super" ? "#ffffff" : crate.kind === "hacker" ? "#4dff9b" : crate.kind === "rainbow" ? `hsl(${(elapsed * 120 + 180) % 360} 100% 78%)` : crate.kind === "blood" ? "#ff2748" : "#3c2b21";
    ctx.lineWidth = 4;
    if (crate.kind === "blood" || crate.kind === "rainbow" || crate.kind === "super" || crate.kind === "hacker") {
      ctx.shadowColor = crate.kind === "blood" ? "#ff001e" : crate.kind === "super" ? "#ffffff" : crateColor(crate);
      ctx.shadowBlur = 18 + Math.sin(elapsed * 5 + crate.bobOffset) * 5;
    }
    ctx.fillRect(-23, -20, 46, 40);
    ctx.strokeRect(-23, -20, 46, 40);
    ctx.beginPath();
    ctx.moveTo(-21, -18);
    ctx.lineTo(21, 18);
    ctx.moveTo(21, -18);
    ctx.lineTo(-21, 18);
    ctx.stroke();
    if (crate.kind === "blood") {
      ctx.fillStyle = "#b80b29";
      ctx.beginPath();
      ctx.arc(-13, 24, 5, 0, Math.PI * 2);
      ctx.arc(9, 27, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = crate.kind === "super" ? "#6d4800" : crate.kind === "hacker" ? "#4dff9b" : crate.kind === "blood" ? "#ffb4bf" : "#ffffff";
    ctx.font = "900 12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(
      crate.kind === "super" ? "SUPER" : crate.kind === "hacker" ? "HACK" : crate.kind === "rainbow" ? "50×" : crate.kind === "blood" ? "BLOOD" : crate.kind === "technology" ? "TECH" : crate.kind === "wooden" ? "?" : "DROP",
      0,
      5
    );
    ctx.restore();
  }
}

function drawPlayer(): void {
  if (playerDeleted) return;
  const flicker = elapsed < player.invincibleUntil && Math.floor(elapsed * 12) % 2 === 0;
  if (flicker) return;
  const swimming = !isInSafeZone(player.x, player.y);
  ctx.save();
  ctx.translate(player.x, player.y);
  const nightmare = isNightmareLevel();
  if (swimming) ctx.rotate(Math.sin(elapsed * 7) * 0.08);
  if (elapsed < shieldUntil) {
    ctx.strokeStyle = nightmare ? "rgba(255, 24, 55, 0.92)" : "rgba(105, 250, 255, 0.9)";
    ctx.lineWidth = nightmare ? 3 : 4;
    if (nightmare) {
      ctx.shadowColor = "#ff001e";
      ctx.shadowBlur = 13;
    }
    ctx.beginPath();
    ctx.arc(0, 0, 25 + Math.sin(elapsed * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    if (nightmare) {
      for (let vein = 0; vein < 6; vein += 1) {
        const angle = vein * Math.PI / 3 + elapsed * 0.12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
        ctx.quadraticCurveTo(Math.cos(angle + 0.35) * 20, Math.sin(angle + 0.35) * 20, Math.cos(angle) * 27, Math.sin(angle) * 27);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = nightmare ? "#d2c6c0" : "#f2bb87";
  ctx.beginPath();
  ctx.arc(0, -8, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = nightmare ? "#120309" : "#ff5e55";
  roundedRect(-11, 1, 22, 25, 7);
  ctx.fill();
  ctx.fillStyle = nightmare ? "#751021" : "#ffd84d";
  ctx.fillRect(-13, 4, 26, 7);
  if (nightmare) {
    ctx.fillStyle = "#ff1738";
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(-3.7, -10, 1.8, 0, Math.PI * 2);
    ctx.arc(3.7, -10, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1b050a";
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(0, 30);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
  }
  if (swimming) {
    ctx.strokeStyle = nightmare ? "#6f2733" : "#f2bb87";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.lineTo(-20, 15 + Math.sin(elapsed * 9) * 5);
    ctx.moveTo(8, 7);
    ctx.lineTo(20, 15 - Math.sin(elapsed * 9) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRemoteMultiplayerPlayer(): void {
  if (!remotePlayerState || performance.now() - remotePlayerState.updatedAt > 5000) return;
  const swimming = !isInSafeZone(remotePlayerState.x, remotePlayerState.y);
  ctx.save();
  ctx.translate(remotePlayerState.x, remotePlayerState.y);
  if (swimming) ctx.rotate(Math.sin(elapsed * 7 + 1.3) * 0.08);
  ctx.fillStyle = "#f2bb87";
  ctx.beginPath();
  ctx.arc(0, -8, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = remotePlayerState.player === 2 ? "#8e68e8" : "#ff5e55";
  roundedRect(-11, 1, 22, 25, 7);
  ctx.fill();
  ctx.fillStyle = "#8ff9f5";
  ctx.fillRect(-13, 4, 26, 7);
  if (swimming) {
    ctx.strokeStyle = "#f2bb87";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.lineTo(-20, 15 + Math.sin(elapsed * 9 + 1) * 5);
    ctx.moveTo(8, 7);
    ctx.lineTo(20, 15 - Math.sin(elapsed * 9 + 1) * 5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(4, 24, 38, 0.9)";
  roundedRect(-34, -42, 68, 18, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(`PLAYER ${remotePlayerState.player}`, 0, -29);
  ctx.restore();
}

function drawShark(): void {
  if (!sharkDeleted) drawSharkEntity(shark, 1);
  extraSharks.forEach((hunter, index) => drawSharkEntity(hunter, 0.82 + (index % 3) * 0.08));
}

function drawSharkEntity(hunter: SharkEntity, scale: number): void {
  const nightmare = isNightmareLevel();
  ctx.save();
  ctx.translate(hunter.x, hunter.y);
  ctx.rotate(hunter.angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = nightmare ? "#100509" : "#3d4650";
  ctx.strokeStyle = nightmare ? "#71101f" : "#929aa5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-50, -15);
  ctx.lineTo(-44, 0);
  ctx.lineTo(-50, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.lineTo(-13, -27);
  ctx.lineTo(12, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Messy, side-swept emo fringe. It deliberately falls over one eye.
  ctx.fillStyle = "#08080d";
  ctx.strokeStyle = nightmare ? "#50101d" : "#25232d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -10);
  ctx.bezierCurveTo(7, -24, 29, -22, 35, -9);
  ctx.lineTo(26, -12);
  ctx.lineTo(20, 5);
  ctx.lineTo(14, -8);
  ctx.lineTo(5, 1);
  ctx.lineTo(7, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, -12);
  ctx.quadraticCurveTo(18, -19, 31, -12);
  ctx.strokeStyle = nightmare ? "#7c1727" : "#4f485c";
  ctx.stroke();

  // Heavy eyeliner and a permanently unimpressed eye.
  ctx.fillStyle = nightmare ? "#ff1e38" : "#b88bd8";
  if (nightmare) {
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  ctx.arc(20, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#050509";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, -7);
  ctx.lineTo(25, -6);
  ctx.stroke();

  // Downturned mouth, tear-like makeup, and a tiny silver lip ring.
  ctx.strokeStyle = nightmare ? "#d72b3d" : "#17131d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(27, 9, 9, 3.75, 5.75);
  ctx.stroke();
  ctx.strokeStyle = nightmare ? "#8a1829" : "#624b75";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(17, 8);
  ctx.stroke();
  ctx.strokeStyle = "#d6d6df";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(33, 8, 3, 0.1, Math.PI * 1.4);
  ctx.stroke();

  // A broken-heart tattoo makes the whole school match.
  ctx.fillStyle = nightmare ? "#8c1426" : "#211827";
  ctx.font = "900 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("♥", -9, 5);
  ctx.strokeStyle = nightmare ? "#ef344b" : "#8a6a9a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, -1);
  ctx.lineTo(-7, 4);
  ctx.lineTo(-11, 8);
  ctx.stroke();
  ctx.restore();
}

function drawDecoy(): void {
  ctx.save();
  ctx.translate(75, HEIGHT - 75);
  const nightmare = isNightmareLevel();
  if (nightmare) ctx.rotate(Math.sin(elapsed * 8) * 0.08);
  ctx.fillStyle = nightmare ? "#18070b" : "#d68b45";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = nightmare ? "#a51629" : "#fff4c7";
  ctx.lineWidth = 3;
  if (nightmare) {
    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.lineTo(0, -28);
    ctx.lineTo(12, -12);
    ctx.moveTo(0, 17);
    ctx.lineTo(0, 31);
    ctx.moveTo(-11, 26);
    ctx.lineTo(11, 26);
    ctx.stroke();
    ctx.fillStyle = "#ff1738";
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-6, -3, 3, 0, Math.PI * 2);
    ctx.arc(6, -3, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-8, -7);
    ctx.lineTo(8, 7);
    ctx.moveTo(8, -7);
    ctx.lineTo(-8, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(): void {
  ctx.save();
  for (const particle of particles) {
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(): void {
  if (hudDeleted) return;
  const nightmare = isNightmareLevel();
  ctx.save();
  ctx.fillStyle = nightmare ? "rgba(25, 0, 5, 0.92)" : "rgba(2, 25, 40, 0.84)";
  ctx.fillRect(0, 0, WIDTH, 78);
  ctx.fillStyle = nightmare ? "#ffb3b3" : "#ffffff";
  ctx.font = "900 22px Trebuchet MS";
  ctx.textAlign = "left";
  const modeTag = nightmare ? "  NIGHTMARE" : gameKind === "creative" ? "  CREATIVE" : "  SURVIVAL";
  ctx.fillText(`${raftName.toUpperCase()}  •  LV.${raftLevel}${modeTag}${isHacker ? "  [HACKER]" : ""}`, 20, 31, 390);
  ctx.font = "900 18px Trebuchet MS";
  for (let index = 0; index < maxHearts; index += 1) {
    const filled = index < player.hearts;
    if (nightmare) {
      drawAnatomicalHeart(28 + index * 20, 53, filled, index);
    } else {
      ctx.fillStyle = filled ? (index >= 3 ? "#ffd84e" : "#ff8098") : "#66848c";
      ctx.fillText(filled ? "♥" : "♡", 20 + index * 20, 62);
    }
  }
  ctx.fillStyle = carriedCrates.length > 0 ? "#ffe66d" : "#9ac6ce";
  ctx.font = "900 12px Trebuchet MS";
  ctx.fillText(`CARGO: ${carriedCrates.length}`, 220, 58);
  ctx.fillStyle = "#ffcf83";
  ctx.fillText(
    gameKind === "creative" ? "FOOD: ∞" : `FOOD: ${foodHealing.length}${chestFoodHealing.length > 0 ? ` +${chestFoodHealing.length}` : ""}`,
    292,
    58
  );
  if (hasHuntingSpear) {
    ctx.fillStyle = "#d6e5e8";
    ctx.fillText(`SPEAR: ${spearDurability}/${SPEAR_MAX_DURABILITY}`, 220, 74);
  }
  if (hasFishingRod || fishCollection.size > 0) {
    ctx.fillStyle = "#8ff9f5";
    ctx.fillText(`FISH: ${getTotalFishCaught()}`, 310, 74);
  }
  if (terrainLevel > 0 || terrainGenerators > 0) {
    ctx.fillStyle = "#72f5ff";
    const surfacedRafts = sunkenRafts.filter((wreck) => elapsed >= wreck.raisedAt).length;
    ctx.fillText(`TERRAIN: ${terrainLevel} • RAFTS: ${surfacedRafts}/${sunkenRafts.length} UP • GENERATORS: ${gameKind === "creative" ? "∞" : terrainGenerators}`, 400, 58);
  }
  if (hasCargoDock) {
    const workingShips = cargoShips.filter((ship) => ship.state !== "docked").length;
    ctx.fillStyle = nightmare ? "#ff697a" : "#75eff2";
    ctx.fillText(`CARGO FLEET: ${cargoShipCount} • WORKING: ${workingShips}`, 400, 74);
  }

  const nextMaterial = materialProgression[progressionIndex];
  const seconds = Math.max(0, Math.ceil(nextSupplyAt - elapsed));
  ctx.textAlign = "center";
  ctx.fillStyle = nightmare ? "#ff4359" : "#8ff9f5";
  ctx.font = "900 14px Trebuchet MS";
  ctx.fillText(isNightmareLevel() ? "NEXT DROP: BLOOD CRATE" : nextMaterial ? `NEXT DROP: ${nextMaterial.name.toUpperCase()}` : "NEXT DROP: RANDOM MATERIAL", WIDTH / 2, 25);
  ctx.fillStyle = nightmare ? "#ffd1d1" : "#ffffff";
  ctx.font = "900 30px Trebuchet MS";
  ctx.fillText(formatTime(seconds), WIDTH / 2, 59);

  const materialColumns = [
    [
      { label: "WOOD", name: "Wood" },
      { label: "STONE", name: "Stone" },
      { label: "IRON", name: "Iron" },
      { label: "STEEL", name: "Steel" },
    ],
    [
      { label: "GOLD", name: "Gold" },
      { label: "CRYSTAL", name: "Crystal" },
      { label: "DIAMOND", name: "Diamond" },
      { label: "PLASMA", name: "Plasma" },
    ],
    [
      { label: "STAR", name: "Star Material" },
      { label: "GOD", name: "God Material" },
      { label: "INFERNAL", name: "Infernal Material" },
      { label: "TECH", name: "Technology Shards" },
    ],
  ];
  ctx.textAlign = "left";
  ctx.font = "900 10px Trebuchet MS";
  materialColumns.forEach((column, columnIndex) => {
    const x = 650 + columnIndex * 102;
    if (columnIndex > 0) {
      ctx.strokeStyle = nightmare ? "rgba(255, 67, 89, 0.35)" : "rgba(143, 249, 245, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 9, 11);
      ctx.lineTo(x - 9, 68);
      ctx.stroke();
    }
    column.forEach((material, rowIndex) => {
      ctx.fillStyle = nightmare ? (rowIndex % 2 === 0 ? "#ffd1d1" : "#d77b86") : rowIndex % 2 === 0 ? "#dffcff" : "#aedde5";
      const personal = inventory.get(material.name) ?? 0;
      const stored = chestInventory.get(material.name) ?? 0;
      ctx.fillText(
        gameKind === "creative" ? `${material.label}: ∞` : `${material.label}: ${personal}${stored > 0 ? `+${stored}` : ""}`,
        x,
        17 + rowIndex * 16
      );
    });
  });

  if (multiplayerRoomCode) {
    ctx.textAlign = "center";
    ctx.fillStyle = multiplayerConnected ? "#8ff9f5" : "#ffe56b";
    ctx.font = "900 10px Trebuchet MS";
    ctx.fillText(`P${multiplayerPlayerNumber} • ROOM ${multiplayerRoomCode}${multiplayerConnected ? " • LINKED" : " • WAITING"}`, 565, 15);
  }

  if (message && elapsed < messageUntil && mode === "playing") {
    ctx.textAlign = "center";
    ctx.font = "900 19px Trebuchet MS";
    const width = Math.min(720, ctx.measureText(message).width + 42);
    ctx.fillStyle = "rgba(2, 25, 40, 0.88)";
    roundedRect((WIDTH - width) / 2, HEIGHT - 58, width, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#ffe66d";
    ctx.fillText(message, WIDTH / 2, HEIGHT - 31);
  }
  ctx.restore();
}

function drawAnatomicalHeart(x: number, y: number, filled: boolean, index: number): void {
  const pulse = filled ? 1 + Math.max(0, Math.sin(elapsed * 5.2 - index * 0.32)) * 0.06 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = filled ? "#8f1025" : "rgba(29, 8, 13, 0.9)";
  ctx.strokeStyle = filled ? "#ff5368" : "#6d3b43";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = filled ? "#ff1738" : "transparent";
  ctx.shadowBlur = filled ? 5 : 0;
  ctx.beginPath();
  ctx.moveTo(-1, -7);
  ctx.bezierCurveTo(-7, -11, -11, -5, -9, 1);
  ctx.bezierCurveTo(-8, 6, -3, 10, 1, 12);
  ctx.bezierCurveTo(5, 8, 10, 4, 10, -2);
  ctx.bezierCurveTo(10, -8, 5, -10, 1, -6);
  ctx.bezierCurveTo(1, -2, -1, -2, -1, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = filled ? "#d6a0a5" : "#543139";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -7);
  ctx.quadraticCurveTo(-5, -13, -1, -16);
  ctx.moveTo(1, -6);
  ctx.quadraticCurveTo(1, -13, 5, -15);
  ctx.moveTo(4, -7);
  ctx.quadraticCurveTo(8, -12, 8, -15);
  ctx.stroke();

  ctx.strokeStyle = filled ? "rgba(255, 158, 168, 0.7)" : "rgba(97, 58, 66, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.quadraticCurveTo(-1, -1, -2, 7);
  ctx.moveTo(4, -5);
  ctx.quadraticCurveTo(1, 0, 3, 7);
  ctx.stroke();
  ctx.restore();
}

function drawCratePointers(): void {
  for (const crate of crates) {
    const d = distance(player.x, player.y, crate.x, crate.y);
    if (d < 145) continue;
    const angle = Math.atan2(crate.y - player.y, crate.x - player.x);
    ctx.save();
    ctx.translate(player.x + Math.cos(angle) * 48, player.y + Math.sin(angle) * 48);
    ctx.rotate(angle);
    ctx.fillStyle = crate.kind === "super" || crate.kind === "rainbow" || crate.kind === "hacker"
      ? crateColor(crate)
      : crate.kind === "blood" ? "#ff2748" : crate.kind === "technology" ? "#72f5ff" : "#ffe36c";
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCrafting(): void {
  ctx.save();
  const nightmare = isNightmareLevel();
  ctx.fillStyle = nightmare ? "rgba(19, 0, 4, 0.97)" : "rgba(1, 18, 30, 0.88)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  if (nightmare) {
    ctx.save();
    ctx.translate(WIDTH / 2, 325);
    ctx.rotate(elapsed * 0.025);
    ctx.strokeStyle = "rgba(150, 18, 39, 0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 230, 0, Math.PI * 2);
    for (let point = 0; point < 7; point += 1) {
      const angle = point * Math.PI * 4 / 7 - Math.PI / 2;
      const nextAngle = (point + 1) * Math.PI * 4 / 7 - Math.PI / 2;
      ctx.moveTo(Math.cos(angle) * 210, Math.sin(angle) * 210);
      ctx.lineTo(Math.cos(nextAngle) * 210, Math.sin(nextAngle) * 210);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = nightmare ? "#ff304a" : "#ffe4a3";
  if (nightmare) {
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 14;
  }
  ctx.font = "900 38px Trebuchet MS";
  const tableName = craftingTableLevel >= TECHNO_CRAFTING_LEVEL ? "TECHNO CRAFTING TABLE" : `CRAFTING TABLE LV.${craftingTableLevel}`;
  ctx.fillText(nightmare ? `THE RITUAL TABLE • LV.${craftingTableLevel}` : tableName, WIDTH / 2, 135);
  ctx.shadowBlur = 0;
  if (craftingTableLevel >= TECHNO_CRAFTING_LEVEL) {
    ctx.fillStyle = nightmare ? "#4a0914" : "#0d5e76";
    ctx.strokeStyle = nightmare ? "#ff304a" : "#8ff9f5";
    ctx.lineWidth = 2;
    roundedRect(775, 94, 155, 42, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = nightmare ? "#ffd1d6" : "#ffffff";
    ctx.font = "900 13px Trebuchet MS";
    ctx.fillText(craftingAutomationPage ? "← MAIN RECIPES" : "AUTOMATION →", 852, 120);
  }
  if (craftingAutomationPage) {
    ctx.fillStyle = nightmare ? "#ff8998" : "#8ff9f5";
    ctx.font = "900 22px Trebuchet MS";
    ctx.fillText(nightmare ? "AUTOMATED REAPING" : "AUTOMATION", WIDTH / 2, 178);
    drawRecipe(
      70,
      205,
      "1",
      nightmare ? "BLACK DOCK" : "CARGO DOCK",
      hasCargoDock ? "ALREADY BUILT" : gameKind === "creative" ? "FREE" : "12 Wood + 6 Steel + 4 Tech",
      "Receives returning cargo ships"
    );
    drawRecipe(
      365,
      205,
      "2",
      nightmare ? "HOLLOW CARGO SHIP" : "CARGO SHIP",
      !hasCargoDock ? "NEEDS A DOCK" : cargoShipCount >= MAX_CARGO_SHIPS ? "FLEET FULL" : gameKind === "creative" ? "FREE" : "10 Steel + 8 Tech",
      `${cargoShipCount}/${MAX_CARGO_SHIPS} ships collect crates automatically`
    );
    drawRecipe(
      660,
      205,
      "3",
      nightmare ? "HARVEST VAULT" : "STORAGE COMPARTMENT",
      hasStorageCompartment ? "ALREADY BUILT" : gameKind === "creative" ? "FREE" : "12 Steel + 10 Tech",
      hasStorageCompartment ? `${collectorDrops.filter((drop) => drop.onCompartment).length} harvest piles waiting` : "Keeps every bot delivery together"
    );
    drawRecipe(
      70,
      340,
      "4",
      nightmare ? "REAPER BOT" : "COLLECTOR BOT",
      collectorBotCount >= MAX_COLLECTOR_BOTS ? "BOT CREW FULL" : gameKind === "creative" ? "FREE" : "6 Steel + 6 Tech",
      `${collectorBotCount}/${MAX_COLLECTOR_BOTS} gather fruit, cows, and sheep`
    );
    drawRecipe(
      365,
      340,
      "5",
      nightmare ? "THE WARDEN" : "SCOLD BOT",
      hasScoldBot ? "ALREADY BUILT" : gameKind === "creative" ? "FREE" : "8 Steel + 8 Tech",
      hasScoldBot ? "Guarding the raft and scaring sharks" : "Attacks sharks with very stern words"
    );
    drawRecipe(
      660,
      340,
      "6",
      nightmare ? "VOICE OF THE DEEP" : "SUPER SCOLD BOT",
      !hasScoldBot ? "NEEDS SCOLD BOT" : hasSuperScoldBot ? "MAXIMUM LOUDNESS" : gameKind === "creative" ? "FREE" : "16 Steel + 16 Tech",
      hasSuperScoldBot ? "4s fear • then 3s cooldown" : "Megaphone blast • includes 3s cooldown"
    );
    drawRecipe(
      365,
      455,
      "7",
      nightmare ? "DEEP ANGLER" : "FISHER BOT",
      hasFisherBot ? "ALREADY BUILT" : gameKind === "creative" ? "FREE" : "10 Steel + 10 Tech",
      hasFisherBot ? `Index ${fishCollection.size}/${fishCatches.length} • catches every 20s` : "Fills your Fish Index while you explore"
    );
    ctx.fillStyle = nightmare ? "#b85b69" : "#b9e6ed";
    ctx.font = "700 13px Trebuchet MS";
    ctx.fillText("Press 1–7 or click a recipe  •  Tab switches pages  •  C closes", WIDTH / 2, 580);
    if (message && elapsed < messageUntil) {
      ctx.fillStyle = "#ffe56b";
      ctx.font = "900 12px Trebuchet MS";
      ctx.fillText(message, WIDTH / 2, 598, 850);
    }
    ctx.restore();
    return;
  }
  const woodCost = 8 * 2 ** expansionCount;
  const stoneCost = 2 * 2 ** expansionCount;
  const bridgeWood = 6;
  const bridgeStone = 2;
  const free = gameKind === "creative";
  const nextUpgradeMaterial = craftingTableUpgradeMaterials[craftingTableLevel - 1];
  drawRecipe(70, 165, "1", nightmare ? "LURE EFFIGY" : "SHARK DECOY", free ? "FREE" : "3 Wood", nightmare ? "It calls. The shark listens." : "Distracts shark for 15 seconds");
  drawRecipe(365, 165, "2", nightmare ? "VEIN SHIELD" : "TECH SHIELD", free ? "FREE" : "5 Tech Shards", nightmare ? "It hungers for one bite." : "Blocks one shark bite");
  drawRecipe(660, 165, "3", nightmare ? "LIVING RAFT" : "RAFT EXPANSION", free ? "FREE • UNLIMITED" : `${woodCost} Wood + ${stoneCost} Stone`, nightmare ? "Feed it. Let it grow." : free ? "Build as many as you want" : "Cost doubles every time");
  drawRecipe(
    70,
    290,
    "4",
    nightmare ? "BONE CAUSEWAY" : "RAFT / ISLAND BRIDGE",
    free ? "FREE" : `${bridgeWood} Wood + ${bridgeStone} Stone`,
    nightmare
      ? "A path that remembers walking."
      : bridgesBuilt >= ISLANDS.length && sunkenRafts.length > 0 ? "Connects the next surfaced raft" : "Connects the next island or raft"
  );
  drawRecipe(
    365,
    290,
    "5",
    nightmare ? "BARBED HARPOON" : "HUNTING SPEAR",
    free ? "FREE" : "8 Wood + 3 Iron",
    nightmare ? (hasHuntingSpear ? `${spearDurability}/${SPEAR_MAX_DURABILITY} tastes remain` : "It does not let go") : hasHuntingSpear ? `${spearDurability}/${SPEAR_MAX_DURABILITY} uses left` : "Lasts for 5 successful uses"
  );
  drawRecipe(660, 290, "6", nightmare ? "MIMIC CHEST" : "STORAGE CHEST", free ? "FREE" : "8 Wood", nightmare ? `${getChestUsed()}/${getChestCapacity()} swallowed` : `${getChestUsed()}/${getChestCapacity()} stored`);
  drawRecipe(
    70,
    415,
    "7",
    craftingTableLevel >= TECHNO_CRAFTING_LEVEL ? "TECHNO TABLE" : `TABLE LEVEL ${craftingTableLevel + 1}`,
    craftingTableLevel >= TECHNO_CRAFTING_LEVEL ? "MAX LEVEL" : free ? "FREE" : `4 ${nextUpgradeMaterial ?? "Material"}`,
    craftingTableLevel >= TECHNO_CRAFTING_LEVEL ? "Automation page unlocked" : "Upgrade with the next material"
  );
  ctx.fillStyle = nightmare ? "#b85b69" : "#b9e6ed";
  ctx.font = "700 15px Trebuchet MS";
  ctx.fillText(nightmare ? "Press 1–7 to assemble  •  Tab opens automated reaping  •  C closes" : "Press 1–7 or click  •  Tab opens Automation  •  C closes", WIDTH / 2, 548);
  if (message && elapsed < messageUntil) {
    ctx.fillStyle = "#ffe56b";
    ctx.font = "900 15px Trebuchet MS";
    ctx.fillText(message, WIDTH / 2, 568, 850);
  }
  ctx.restore();
}

function drawRecipe(x: number, y: number, key: string, title: string, cost: string, detail: string): void {
  const nightmare = isNightmareLevel();
  if (nightmare) {
    const cardGradient = ctx.createLinearGradient(x, y, x, y + 105);
    cardGradient.addColorStop(0, "#570817");
    cardGradient.addColorStop(0.58, "#2b050d");
    cardGradient.addColorStop(1, "#120307");
    ctx.fillStyle = cardGradient;
  } else {
    ctx.fillStyle = "#0a4c65";
  }
  ctx.strokeStyle = nightmare ? "#e3364e" : "#74eff0";
  ctx.lineWidth = 3;
  roundedRect(x, y, 230, 105, 14);
  ctx.fill();
  ctx.stroke();
  if (nightmare) {
    ctx.strokeStyle = "rgba(255, 64, 88, 0.38)";
    ctx.lineWidth = 2;
    for (let slash = 0; slash < 3; slash += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 198 + slash * 6, y + 8);
      ctx.lineTo(x + 185 + slash * 6, y + 35);
      ctx.stroke();
    }
    ctx.fillStyle = "#8e1027";
    ctx.beginPath();
    ctx.arc(x + 22, y + 105, 5, 0, Math.PI * 2);
    ctx.arc(x + 91, y + 108, 4, 0, Math.PI * 2);
    ctx.arc(x + 188, y + 106, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = nightmare ? "#ff4058" : "#ffe66d";
  if (nightmare) {
    ctx.shadowColor = "#ff001e";
    ctx.shadowBlur = 9;
  }
  ctx.font = "900 24px Trebuchet MS";
  ctx.fillText(key, x + 24, y + 29);
  ctx.shadowBlur = 0;
  ctx.fillStyle = nightmare ? "#ffd1d6" : "#ffffff";
  ctx.font = "900 15px Trebuchet MS";
  ctx.fillText(title, x + 128, y + 28, 190);
  ctx.fillStyle = nightmare ? "#e86c7b" : "#ffe4a3";
  ctx.font = "800 13px Trebuchet MS";
  ctx.fillText(cost, x + 115, y + 57, 215);
  ctx.fillStyle = nightmare ? "#a9787f" : "#b9e6ed";
  ctx.font = "700 12px Trebuchet MS";
  ctx.fillText(detail, x + 115, y + 84, 215);
}

function drawStorage(): void {
  const resourceNames = [
    "Wood",
    "Stone",
    "Iron",
    "Steel",
    "Gold",
    "Crystal",
    "Diamond",
    "Plasma",
    "Star Material",
    "God Material",
    "Infernal Material",
    "Technology Shards",
  ];
  ctx.save();
  ctx.fillStyle = isNightmareLevel() ? "rgba(24, 0, 5, 0.97)" : "rgba(1, 18, 30, 0.94)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe4a3";
  ctx.font = "900 36px Trebuchet MS";
  ctx.fillText(`CHEST STORAGE  ${getChestUsed()}/${getChestCapacity()}`, WIDTH / 2, 128);
  ctx.font = "900 18px Trebuchet MS";
  ctx.fillStyle = "#8ff9f5";
  ctx.fillText("PERSONAL INVENTORY", 285, 165);
  ctx.fillText(`CHESTS ×${chestCount}`, 675, 165);

  resourceNames.forEach((name, index) => {
    const column = index < 6 ? 0 : 1;
    const row = index % 6;
    const y = 205 + row * 43;
    const personalX = 105 + column * 185;
    const chestX = 500 + column * 185;
    ctx.textAlign = "left";
    ctx.fillStyle = "#dffcff";
    ctx.font = "800 14px Trebuchet MS";
    ctx.fillText(`${name}: ${inventory.get(name) ?? 0}/${STACK_LIMIT}`, personalX, y);
    ctx.fillStyle = "#ffe4a3";
    ctx.fillText(`${name}: ${chestInventory.get(name) ?? 0}`, chestX, y);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcf83";
  ctx.font = "900 16px Trebuchet MS";
  ctx.fillText(`Food: ${foodHealing.length}/${STACK_LIMIT}`, 285, 475);
  ctx.fillText(`Stored Food: ${chestFoodHealing.length}`, 675, 475);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 16px Trebuchet MS";
  ctx.fillText("Deposit Items: choose and type an amount   •   S: Store all   •   T: Take all   •   B: Close", WIDTH / 2, 525);
  ctx.restore();
}

function drawShop(): void {
  ctx.save();
  ctx.fillStyle = isNightmareLevel() ? "rgba(29, 0, 6, 0.97)" : "rgba(24, 13, 34, 0.95)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  ctx.textAlign = "center";
  ctx.fillStyle = isNightmareLevel() ? "#ff304a" : "#ffd84e";
  ctx.font = "900 38px Trebuchet MS";
  ctx.fillText(isNightmareLevel() ? "THE RED MERCHANT" : "TECHNOLOGY & SUPPLY SHOP", WIDTH / 2, 135);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 16px Trebuchet MS";
  ctx.fillText(
    isNightmareLevel()
      ? "It never leaves. It already knows what you came to buy."
      : gameKind === "creative"
      ? "Creative shop is always open  •  Available food: ∞"
      : `Leaves in ${Math.ceil(shopkeeperUntil - elapsed)} seconds  •  Available food: ${getTotalFoodCount()}`,
    WIDTH / 2,
    169
  );

  drawShopOffer(
    85,
    190,
    "1",
    "GOLDEN HEART",
    maxHearts >= MAX_HEARTS ? "All 10 hearts owned" : `${getGoldenHeartCost()} Food`,
    "Permanent +1 max heart"
  );
  drawShopOffer(355, 190, "2", "LUMBER PACK", "5 Food", "+10 Wood");
  drawShopOffer(625, 190, "3", "STONE PACK", "5 Food", "+8 Stone");
  drawShopOffer(85, 300, "4", "TECH PACK", "10 Food", "+5 Technology Shards");
  drawShopOffer(
    355,
    300,
    "5",
    "HUNTING SPEAR",
    "15 Food",
    hasHuntingSpear ? `Refill from ${spearDurability}/5 uses` : "New spear with 5 uses"
  );
  drawShopOffer(
    625,
    300,
    "6",
    "FISHING ROD",
    `${FISHING_ROD_COST} Food`,
    hasFishingRod ? `${getTotalFishCaught()} catches collected` : "Press R to cast from safety"
  );
  drawShopOffer(85, 410, "7", "METAL PACK", "25 Food", "+50 Iron and +50 Steel");
  drawShopOffer(355, 410, "8", "TERRAIN GENERATOR", "1 Technology Shard", "Huge zoom-out • 3 sunken rafts");
  drawShopOffer(625, 410, "9", "TIME WARPER", hasTimeWarper ? "INSTALLED" : "20 Technology Shards", "Trips cost 10 Tech • Past or future");

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 16px Trebuchet MS";
  ctx.fillText("Press 1–9 or click an item to buy  •  J, Escape, or CLOSE SHOP exits", WIDTH / 2, 535);
  ctx.restore();
}

function drawTimeWarperMenu(): void {
  ctx.save();
  ctx.fillStyle = "rgba(18, 4, 31, 0.96)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  ctx.textAlign = "center";
  ctx.fillStyle = "#d28cff";
  ctx.font = "900 38px Trebuchet MS";
  ctx.fillText("TIME WARPER", WIDTH / 2, 140);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 15px Trebuchet MS";
  ctx.fillText(`Universe: ${formatCosmicAge(cosmicTimeYears)} • Every trip costs 10 Technology Shards`, WIDTH / 2, 174);
  drawShopOffer(85, 190, "1", "BIG BANG", "10 Tech", "First moment of the universe");
  drawShopOffer(355, 190, "2", "−1 BILLION YEARS", "10 Tech", "Repeat until the Big Bang");
  drawShopOffer(625, 190, "3", "−3 MINUTES", "10 Tech", "Restore recorded raft history");
  drawShopOffer(85, 300, "4", "−10 SECONDS", "10 Tech", "See your recent past self");
  drawShopOffer(355, 300, "5", "+10 SECONDS", "10 Tech", "Advance nearby world timers");
  drawShopOffer(625, 300, "6", "+3 MINUTES", "10 Tech", "Instantly surface new wrecks");
  drawShopOffer(85, 410, "7", "+1 BILLION YEARS", "10 Tech", "Repeat until the Big Crunch");
  drawShopOffer(355, 410, "8", "THE PRESENT", "10 Tech", "Return to 13.8 billion years");
  drawShopOffer(625, 410, "9", "BIG CRUNCH", "10 Tech", "Last moment of the universe");
  ctx.fillStyle = "#ead7ff";
  ctx.font = "800 15px Trebuchet MS";
  ctx.fillText("Press 1–9 or click a destination • Escape closes", WIDTH / 2, 530);
  ctx.restore();
}

function drawCreativeCrateMenu(): void {
  ctx.save();
  ctx.fillStyle = "rgba(31, 4, 35, 0.96)";
  ctx.fillRect(0, 78, WIDTH, HEIGHT - 78);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff8ee8";
  ctx.font = "900 38px Trebuchet MS";
  ctx.fillText(gameKind === "creative" ? "CREATIVE CRATE SPAWNER" : "SURVIVAL CRATE SHOP", WIDTH / 2, 145);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 16px Trebuchet MS";
  ctx.fillText(
    gameKind === "creative"
      ? "Choose any crate type • The menu stays open for rapid spawning"
      : `Food available: ${getTotalFoodCount()} • Stored food counts too`,
    WIDTH / 2,
    184
  );
  const price = (amount: number): string => gameKind === "creative" ? "FREE" : `${amount} FOOD`;
  drawShopOffer(85, 220, "1", "SUPPLY CRATE", price(5), "Contains the current material tier");
  drawShopOffer(355, 220, "2", "WOODEN CRATE", price(10), "Crafting table, wood, and stone");
  drawShopOffer(625, 220, "3", "TECH CRATE", price(20), "Technology Shards");
  drawShopOffer(85, 355, "4", "BLOOD CRATE", price(35), "Nightmare-tier random rewards");
  drawShopOffer(355, 355, "5", "RAINBOW CRATE", price(50), "50 of everything");
  drawShopOffer(625, 355, "6", "SUPER CRATE", price(100), "100 of everything");
  ctx.fillStyle = "#ffe4fa";
  ctx.font = "800 15px Trebuchet MS";
  ctx.fillText("Press 1–6 or click • K or Escape closes", WIDTH / 2, 510);
  ctx.restore();
}

function drawShopOffer(
  x: number,
  y: number,
  key: string,
  title: string,
  cost: string,
  detail: string
): void {
  ctx.fillStyle = isNightmareLevel() ? "#4b0b18" : "#542f6e";
  ctx.strokeStyle = isNightmareLevel() ? "#ff4359" : "#ffd84e";
  ctx.lineWidth = 3;
  roundedRect(x, y, 250, 95, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffd84e";
  ctx.font = "900 26px Trebuchet MS";
  ctx.fillText(key, x + 28, y + 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 17px Trebuchet MS";
  ctx.fillText(title, x + 125, y + 28);
  ctx.fillStyle = "#ffe4a3";
  ctx.font = "900 16px Trebuchet MS";
  ctx.fillText(cost, x + 125, y + 55);
  ctx.fillStyle = "#bfe9ee";
  ctx.font = "800 13px Trebuchet MS";
  ctx.fillText(detail, x + 125, y + 80);
}

function drawSavingIndicator(): void {
  if (performance.now() >= savingIndicatorUntil) return;
  const time = performance.now() / 1000;
  ctx.save();
  ctx.translate(WIDTH - 78, HEIGHT - 96);
  ctx.fillStyle = "rgba(2, 25, 40, 0.9)";
  roundedRect(-54, -42, 108, 84, 14);
  ctx.fill();
  ctx.rotate(time * 7);
  ctx.translate(23, 0);
  ctx.rotate(-time * 7);
  ctx.fillStyle = "#8aa5b2";
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-25, -9);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-25, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("AUTOSAVING", WIDTH - 78, HEIGHT - 59);
  ctx.restore();
}

function drawWrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}

function drawOverlay(title: string, detail: string, action: string): void {
  ctx.save();
  ctx.fillStyle = isNightmareLevel() ? "rgba(20, 0, 5, 0.9)" : "rgba(1, 18, 30, 0.8)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = "center";
  ctx.fillStyle = isNightmareLevel() ? "#ff304a" : "#8ff9f5";
  ctx.font = "900 58px Trebuchet MS";
  ctx.fillText(title, WIDTH / 2, 218);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Trebuchet MS";
  ctx.fillText(detail, WIDTH / 2, 277);
  ctx.fillStyle = "#ffe56b";
  ctx.font = "900 21px Trebuchet MS";
  ctx.fillText(action, WIDTH / 2, 350);
  ctx.restore();
}

function drawMapViewLabel(): void {
  ctx.save();
  ctx.fillStyle = "rgba(1, 18, 30, 0.88)";
  ctx.strokeStyle = isNightmareLevel() ? "#ff304a" : "#7dffb2";
  ctx.lineWidth = 3;
  roundedRect(250, 500, 460, 72, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isNightmareLevel() ? "#ff8b9a" : "#d9ffe8";
  ctx.font = "900 20px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("FULL OCEAN MAP", WIDTH / 2, 529);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 13px Trebuchet MS";
  ctx.fillText("M or View Map closes • Pause menu buttons remain available", WIDTH / 2, 552);
  ctx.restore();
}

function burst(x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 135;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.55 + Math.random() * 0.5, color });
  }
}

function getRaftBounds(): { x: number; y: number; width: number; height: number } {
  const growth = Math.min(70, expansionCount * 14);
  return {
    x: RAFT.x - growth,
    y: RAFT.y - growth,
    width: RAFT.width + growth * 2,
    height: RAFT.height + growth * 2,
  };
}

function getScoldBotPosition(): { x: number; y: number } {
  const raft = getRaftBounds();
  return { x: raft.x + raft.width - 52, y: raft.y + 70 };
}

function getCargoDockPosition(): { x: number; y: number } {
  const raft = getRaftBounds();
  return { x: raft.x + raft.width / 2, y: raft.y + raft.height + 48 };
}

function getStorageCompartmentPosition(): { x: number; y: number } {
  const miniRaft = getStorageMiniRaftBounds();
  return { x: miniRaft.x + miniRaft.width / 2, y: miniRaft.y + miniRaft.height / 2 + 1 };
}

function getStorageMiniRaftBounds(): { x: number; y: number; width: number; height: number } {
  const raft = getRaftBounds();
  const width = 150;
  const height = 54;
  return {
    x: raft.x + raft.width / 2 - width / 2,
    y: raft.y - 72,
    width,
    height,
  };
}

function getCollectorBotHome(index: number, total: number): { x: number; y: number } {
  const raft = getRaftBounds();
  const centerX = hasStorageCompartment ? getStorageCompartmentPosition().x : raft.x + raft.width / 2;
  return {
    x: centerX + (index - (total - 1) / 2) * 22,
    y: hasStorageCompartment ? getStorageCompartmentPosition().y + 36 : raft.y + 28,
  };
}

function getCollectorBotRoute(islandIndex: number, returning: boolean, botIndex: number): Array<{ x: number; y: number }> {
  const island = ISLANDS[islandIndex];
  if (!island) return [];
  const bridge = getBridgeSegment(island);
  if (returning) {
    return [bridge.end, bridge.start, getCollectorBotHome(Math.max(0, botIndex), Math.max(1, collectorBots.length))];
  }
  return [bridge.start, bridge.end, { x: island.x, y: island.y - 4 }];
}

function getCargoShipDockSlot(index: number, total: number): { x: number; y: number } {
  const dock = getCargoDockPosition();
  return {
    x: dock.x + (index - (total - 1) / 2) * 66,
    y: dock.y + 34,
  };
}

function isOnRaft(x: number, y: number): boolean {
  if (homeRaftDeleted) return false;
  const raft = getRaftBounds();
  return x >= raft.x - 8 && x <= raft.x + raft.width + 8 && y >= raft.y - 8 && y <= raft.y + raft.height + 8;
}

function isOnCargoDock(x: number, y: number): boolean {
  if (!hasCargoDock) return false;
  const raft = getRaftBounds();
  const dock = getCargoDockPosition();
  return x >= dock.x - 99 && x <= dock.x + 99 && y >= raft.y + raft.height - 8 && y <= dock.y + 48;
}

function isOnIsland(x: number, y: number): boolean {
  if (!isIslandUnlocked()) return false;
  return ISLANDS.some((island) => isIslandVisible(island) && isInsideIsland(x, y, island));
}

function isOnRaftNetwork(x: number, y: number): boolean {
  return isOnRaft(x, y) || isOnStorageMiniRaft(x, y) || isOnCargoDock(x, y) || isOnIsland(x, y) || isOnBridge(x, y) || isOnGeneratedTerrain(x, y);
}

function isOnGeneratedTerrain(x: number, y: number): boolean {
  return sunkenRafts.some((wreck) =>
    elapsed >= wreck.raisedAt
    && x >= wreck.x - wreck.width / 2 - 8
    && x <= wreck.x + wreck.width / 2 + 8
    && y >= wreck.y - wreck.height / 2 - 8
    && y <= wreck.y + wreck.height / 2 + 8
  );
}

function isOnStorageMiniRaft(x: number, y: number): boolean {
  if (!hasStorageCompartment) return false;
  const raft = getRaftBounds();
  const miniRaft = getStorageMiniRaftBounds();
  const onPlatform = x >= miniRaft.x - 7
    && x <= miniRaft.x + miniRaft.width + 7
    && y >= miniRaft.y - 7
    && y <= miniRaft.y + miniRaft.height + 7;
  const onConnector = x >= miniRaft.x + miniRaft.width / 2 - 28
    && x <= miniRaft.x + miniRaft.width / 2 + 28
    && y >= miniRaft.y + miniRaft.height - 5
    && y <= raft.y + 8;
  return onPlatform || onConnector;
}

function isInSafeZone(x: number, y: number): boolean {
  return isOnRaftNetwork(x, y);
}

function isIslandUnlocked(): boolean {
  return endgameUnlocked && expansionCount >= 3;
}

function isIslandVisible(island: Island): boolean {
  // A deleted island stops rendering and stops being solid ground.
  if (deletedIslands.has(ISLANDS.indexOf(island))) return false;
  return endgameUnlocked && expansionCount >= island.requiredExpansions;
}

function isInsideIsland(x: number, y: number, island: Island): boolean {
  const dx = x - island.x;
  const dy = y - island.y;
  return (dx * dx) / (island.radiusX * island.radiusX) + (dy * dy) / (island.radiusY * island.radiusY) <= 1;
}

function isOnBridge(x: number, y: number): boolean {
  const onIslandBridge = isIslandUnlocked() && ISLANDS.slice(0, bridgesBuilt).some((island) => {
    if (!isIslandVisible(island)) return false;
    const { start, end } = getBridgeSegment(island);
    return distanceToSegment(x, y, start.x, start.y, end.x, end.y) <= BRIDGE_SAFE_HALF_WIDTH;
  });
  if (onIslandBridge) return true;
  return sunkenRafts.some((wreck) => {
    if (!wreck.bridgeBuilt || elapsed < wreck.raisedAt) return false;
    const { start, end } = getSunkenRaftBridgeSegment(wreck);
    return distanceToSegment(x, y, start.x, start.y, end.x, end.y) <= BRIDGE_SAFE_HALF_WIDTH;
  });
}

function getBridgeSegment(island: Island): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const raft = getRaftBounds();
  const goesRight = island.x >= WIDTH / 2;
  const start = {
    x: goesRight ? raft.x + raft.width - 8 : raft.x + 8,
    y: raft.y + raft.height / 2,
  };
  const angle = Math.atan2(island.y - start.y, island.x - start.x);
  return {
    start,
    end: {
      x: island.x - Math.cos(angle) * (island.radiusX - 10),
      y: island.y - Math.sin(angle) * (island.radiusY - 8),
    },
  };
}

function getSunkenRaftBridgeSegment(wreck: SunkenRaft): { start: { x: number; y: number }; end: { x: number; y: number } } {
  if (!wreck.bridgeSourceKind) assignSunkenRaftBridgeSource(wreck);
  const source = getSunkenRaftBridgeSource(wreck);
  const dx = wreck.x - source.x;
  const dy = wreck.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const startDistance = source.kind === "island"
    ? 1 / Math.sqrt((ux * ux) / (source.halfWidth ** 2) + (uy * uy) / (source.halfHeight ** 2))
    : getRectangleEdgeDistance(source.halfWidth, source.halfHeight, ux, uy);
  const endDistance = getRectangleEdgeDistance(wreck.width / 2, wreck.height / 2, ux, uy);
  return {
    start: { x: source.x + ux * startDistance, y: source.y + uy * startDistance },
    end: { x: wreck.x - ux * endDistance, y: wreck.y - uy * endDistance },
  };
}

function assignSunkenRaftBridgeSource(wreck: SunkenRaft): void {
  const targetIndex = sunkenRafts.indexOf(wreck);
  if (targetIndex < 0) return;
  const connectedIslands = ISLANDS
    .map((island, index) => ({ island, index }))
    .filter(({ island, index }) => index < bridgesBuilt && isIslandVisible(island));
  const connectedRafts = sunkenRafts
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => index < targetIndex && candidate.bridgeBuilt && elapsed >= candidate.raisedAt);

  if (targetIndex % 3 === 0 && connectedIslands.length > 0) {
    const nearest = connectedIslands.sort(
      (a, b) => distance(wreck.x, wreck.y, a.island.x, a.island.y) - distance(wreck.x, wreck.y, b.island.x, b.island.y)
    )[0];
    wreck.bridgeSourceKind = "island";
    wreck.bridgeSourceIndex = nearest?.index ?? 0;
    return;
  }
  if (connectedRafts.length > 0) {
    const nearest = connectedRafts.sort(
      (a, b) => distance(wreck.x, wreck.y, a.candidate.x, a.candidate.y) - distance(wreck.x, wreck.y, b.candidate.x, b.candidate.y)
    )[0];
    wreck.bridgeSourceKind = "raft";
    wreck.bridgeSourceIndex = nearest?.index ?? 0;
    return;
  }
  if (connectedIslands.length > 0) {
    const nearest = connectedIslands.sort(
      (a, b) => distance(wreck.x, wreck.y, a.island.x, a.island.y) - distance(wreck.x, wreck.y, b.island.x, b.island.y)
    )[0];
    wreck.bridgeSourceKind = "island";
    wreck.bridgeSourceIndex = nearest?.index ?? 0;
    return;
  }
  wreck.bridgeSourceKind = "main";
  wreck.bridgeSourceIndex = -1;
}

function getSunkenRaftBridgeSource(wreck: SunkenRaft): {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  kind: "rect" | "island";
} {
  if (wreck.bridgeSourceKind === "raft") {
    const sourceRaft = sunkenRafts[wreck.bridgeSourceIndex ?? -1];
    if (sourceRaft) return { x: sourceRaft.x, y: sourceRaft.y, halfWidth: sourceRaft.width / 2, halfHeight: sourceRaft.height / 2, kind: "rect" };
  }
  if (wreck.bridgeSourceKind === "island") {
    const island = ISLANDS[wreck.bridgeSourceIndex ?? -1];
    if (island) return { x: island.x, y: island.y, halfWidth: island.radiusX, halfHeight: island.radiusY, kind: "island" };
  }
  const raft = getRaftBounds();
  return {
    x: raft.x + raft.width / 2,
    y: raft.y + raft.height / 2,
    halfWidth: raft.width / 2,
    halfHeight: raft.height / 2,
    kind: "rect",
  };
}

function getRectangleEdgeDistance(halfWidth: number, halfHeight: number, ux: number, uy: number): number {
  return Math.min(
    Math.abs(ux) > 0.001 ? halfWidth / Math.abs(ux) : Infinity,
    Math.abs(uy) > 0.001 ? halfHeight / Math.abs(uy) : Infinity
  );
}

function getSunkenRaftConnectionLabel(wreck: SunkenRaft | undefined): string {
  if (!wreck) return "TO THE RESURFACED RAFT";
  const targetNumber = sunkenRafts.indexOf(wreck) + 1;
  if (wreck.bridgeSourceKind === "raft") return `FROM RAFT ${(wreck.bridgeSourceIndex ?? 0) + 1} TO RAFT ${targetNumber}`;
  if (wreck.bridgeSourceKind === "island") return `FROM ${ISLANDS[wreck.bridgeSourceIndex ?? -1]?.name ?? "AN ISLAND"} TO RAFT ${targetNumber}`;
  return `FROM THE MAIN RAFT TO RAFT ${targetNumber}`;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

function saveGame(): void {
  if (mode === "ready" || mode === "gameOver") return;
  const data: SaveData = {
    version: 1,
    saveFileName,
    raftName,
    gameKind,
    isHacker,
    sharkDeleted,
    homeRaftDeleted,
    shopkeeperDeleted,
    hudDeleted,
    oceanDeleted,
    playerDeleted,
    deletedIslands: [...deletedIslands],
    deletedGuiSelectors: [...deletedGuiSelectors],
    elapsed,
    nextSupplyIn: Math.max(0, nextSupplyAt - elapsed),
    nextRandomIn: Math.max(0, nextRandomAt - elapsed),
    progressionIndex,
    crates,
    carriedCrates,
    inventory: [...inventory.entries()],
    foodHealing,
    hearts: player.hearts,
    hasCraftingTable,
    craftingTableLevel,
    hasCargoDock,
    cargoShipCount,
    cargoShipCargo: cargoShips.flatMap((ship) => ship.cargo ? [ship.cargo] : []),
    hasScoldBot,
    hasSuperScoldBot,
    nextScoldIn: Math.max(0, nextScoldAt - elapsed),
    hasStorageCompartment,
    collectorBotCount,
    collectorBots,
    collectorDrops,
    nextCollectorRunIn: Math.max(0, nextCollectorRunAt - elapsed),
    raftLevel,
    expansionCount,
    endgameUnlocked,
    bridgesBuilt,
    coconutReadyIn: coconutReadyAt.map((readyAt) => readyAt - elapsed),
    playerX: player.x,
    playerY: player.y,
    sharkX: shark.x,
    sharkY: shark.y,
    sharkAngle: shark.angle,
    hasHuntingSpear,
    spearDurability,
    animalReadyIn: animalReadyAt.map((readyAt) => Math.max(0, readyAt - elapsed)),
    chestCount,
    chestInventory: [...chestInventory.entries()],
    chestFoodHealing,
    sharkFleeIn: Math.max(0, sharkFleeUntil - elapsed),
    maxHearts,
    nextShopkeeperIn: Math.max(0, nextShopkeeperAt - elapsed),
    shopkeeperRemaining: Math.max(0, shopkeeperUntil - elapsed),
    hasFishingRod,
    hasFisherBot,
    nextAutoFishIn: Math.max(0, nextAutoFishAt - elapsed),
    fisherBotCatches,
    hasTimeWarper,
    cosmicTimeYears,
    fishCollection: [...fishCollection.entries()],
    terrainGenerators,
    terrainLevel,
    sunkenRafts,
    extraSharks,
  };
  try {
    const saveKey = getSaveKey(currentSaveSlot);
    const previousRaw = localStorage.getItem(saveKey);
    const nextRaw = JSON.stringify(data);
    if (previousRaw && previousRaw !== nextRaw && parseSave(previousRaw)) {
      localStorage.setItem(getBackupSaveKey(currentSaveSlot), previousRaw);
    }
    localStorage.setItem(saveKey, nextRaw);
    savingIndicatorUntil = performance.now() + 1300;
    // Only the host broadcasts full snapshots. When both sides did it, each
    // player's autosave overwrote the other's crates — which is why freshly
    // spawned crates vanished a moment later.
    if (multiplayerConnected && multiplayerIsHost) sendMultiplayerMessage("state", data);
  } catch {
    showMessage("Autosave could not be written.", 3);
  }
}

function restoreAutosave(): void {
  const saveKey = getSaveKey(currentSaveSlot);
  let raw = localStorage.getItem(saveKey);
  if (!parseSave(raw)) {
    const backupRaw = localStorage.getItem(getBackupSaveKey(currentSaveSlot));
    if (parseSave(backupRaw)) {
      raw = backupRaw;
      localStorage.setItem(saveKey, backupRaw ?? "");
    }
  }
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1 || typeof data.elapsed !== "number" || !Array.isArray(data.inventory)) return;
    gameKind = data.gameKind === "creative" ? "creative" : "survival";
    isHacker = data.isHacker === true;
    sharkDeleted = data.sharkDeleted === true;
    homeRaftDeleted = data.homeRaftDeleted === true;
    shopkeeperDeleted = data.shopkeeperDeleted === true;
    hudDeleted = data.hudDeleted === true;
    oceanDeleted = data.oceanDeleted === true;
    playerDeleted = data.playerDeleted === true;
    deletedIslands.clear();
    for (const index of data.deletedIslands ?? []) deletedIslands.add(index);
    deletedGuiSelectors.clear();
    for (const selector of data.deletedGuiSelectors ?? []) deletedGuiSelectors.add(selector);
    applyDeletedGui();
    saveFileName = sanitizeName(data.saveFileName, `Save ${currentSaveSlot}`);
    raftName = sanitizeName(data.raftName, "Home Raft");
    elapsed = data.elapsed;
    nextSupplyAt = elapsed + (data.nextSupplyIn ?? SUPPLY_INTERVAL);
    nextRandomAt = elapsed + (data.nextRandomIn ?? 35);
    progressionIndex = clamp(Math.floor(data.progressionIndex ?? 0), 0, materialProgression.length);
    crates = Array.isArray(data.crates) ? data.crates : [];
    carriedCrates = Array.isArray(data.carriedCrates) ? data.carriedCrates : [];
    chestCount = Math.max(0, Math.floor(data.chestCount ?? 0));
    chestInventory.clear();
    if (Array.isArray(data.chestInventory)) {
      for (const entry of data.chestInventory) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number") {
          chestInventory.set(entry[0], Math.max(0, Math.floor(entry[1])));
        }
      }
    }
    chestFoodHealing.length = 0;
    if (Array.isArray(data.chestFoodHealing)) {
      chestFoodHealing.push(...data.chestFoodHealing.filter((value) => value === 1 || value === 99));
    }
    inventory.clear();
    for (const entry of data.inventory) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && entry[0] !== "Food") {
        inventory.set(entry[0], Math.max(0, Math.floor(entry[1])));
      }
    }
    foodHealing.length = 0;
    if (Array.isArray(data.foodHealing)) {
      foodHealing.push(...data.foodHealing.filter((value) => value === 1 || value === 99));
    }
    inventory.set("Food", foodHealing.length);
    maxHearts = clamp(Math.floor(data.maxHearts ?? 3), 3, MAX_HEARTS);
    player.hearts = clamp(Math.floor(data.hearts ?? 3), 1, maxHearts);
    hasCraftingTable = data.hasCraftingTable === true;
    craftingTableLevel = hasCraftingTable
      ? clamp(Math.floor(data.craftingTableLevel ?? (gameKind === "creative" ? TECHNO_CRAFTING_LEVEL : 1)), 1, TECHNO_CRAFTING_LEVEL)
      : 0;
    hasCargoDock = data.hasCargoDock === true && craftingTableLevel >= TECHNO_CRAFTING_LEVEL;
    cargoShipCount = hasCargoDock ? clamp(Math.floor(data.cargoShipCount ?? 0), 0, MAX_CARGO_SHIPS) : 0;
    cargoShips = [];
    hasScoldBot = data.hasScoldBot === true && craftingTableLevel >= TECHNO_CRAFTING_LEVEL;
    hasSuperScoldBot = hasScoldBot && data.hasSuperScoldBot === true;
    nextScoldAt = elapsed + Math.max(
      0,
      data.nextScoldIn ?? (hasSuperScoldBot ? SUPER_SCOLD_BOT_INTERVAL : SCOLD_BOT_INTERVAL)
    );
    scoldBubbleUntil = 0;
    scoldBeamUntil = 0;
    scoldMessage = "";
    scoldTarget = null;
    hasStorageCompartment = data.hasStorageCompartment === true && craftingTableLevel >= TECHNO_CRAFTING_LEVEL;
    collectorBotCount = craftingTableLevel >= TECHNO_CRAFTING_LEVEL
      ? clamp(Math.floor(data.collectorBotCount ?? 0), 0, MAX_COLLECTOR_BOTS)
      : 0;
    const savedCollectorBots = Array.isArray(data.collectorBots) ? data.collectorBots : [];
    collectorBots = [];
    collectorDrops = Array.isArray(data.collectorDrops)
      ? data.collectorDrops.filter((drop): drop is CollectorDrop =>
          typeof drop?.x === "number"
          && typeof drop.y === "number"
          && (drop.healing === 1 || drop.healing === 99)
          && typeof drop.count === "number"
          && drop.count > 0
          && ["coconut", "blood-orange", "cow", "sheep"].includes(drop.source)
        )
      : [];
    nextCollectorRunAt = elapsed + Math.max(0, data.nextCollectorRunIn ?? COLLECTOR_INTERVAL);
    expansionCount = clamp(Math.floor(data.expansionCount ?? 0), 0, gameKind === "creative" ? 100000 : 12);
    raftLevel = Math.max(1, Math.floor(data.raftLevel ?? expansionCount + 1));
    syncCollectorBots();
    for (const savedBot of savedCollectorBots) {
      const cargo = savedBot?.cargo;
      const islandIndex = Math.floor(savedBot?.targetIslandIndex ?? -1);
      if (
        cargo
        && islandIndex >= 0
        && islandIndex < ISLANDS.length
        && (cargo.healing === 1 || cargo.healing === 99)
        && typeof cargo.count === "number"
        && cargo.count > 0
      ) {
        placeCollectorDrop(islandIndex, cargo.healing, Math.floor(cargo.count), cargo.source, !hasStorageCompartment);
      }
    }
    if (hasStorageCompartment) moveCollectorDropsToCompartment();
    endgameUnlocked = data.endgameUnlocked === true;
    bridgesBuilt = clamp(Math.floor(data.bridgesBuilt ?? 0), 0, ISLANDS.length);
    coconutReadyAt = ISLANDS.map((_, index) => elapsed + (data.coconutReadyIn?.[index] ?? 0));
    hasHuntingSpear = data.hasHuntingSpear === true;
    spearDurability = hasHuntingSpear
      ? clamp(Math.floor(data.spearDurability ?? SPEAR_MAX_DURABILITY), 1, SPEAR_MAX_DURABILITY)
      : 0;
    hasFishingRod = data.hasFishingRod === true;
    hasFisherBot = data.hasFisherBot === true && craftingTableLevel >= TECHNO_CRAFTING_LEVEL;
    nextAutoFishAt = elapsed + Math.max(0, data.nextAutoFishIn ?? FISHER_BOT_INTERVAL);
    fisherBotCatches = Array.isArray(data.fisherBotCatches)
      ? data.fisherBotCatches.filter((name): name is string => typeof name === "string" && fishCatches.some((fish) => fish.name === name))
      : [];
    hasTimeWarper = data.hasTimeWarper === true;
    cosmicTimeYears = clamp(data.cosmicTimeYears ?? PRESENT_UNIVERSE_AGE, 0, BIG_CRUNCH_YEAR);
    timeWarperOpen = false;
    creativeCrateMenuOpen = false;
    timeSnapshots = [];
    nextTimeSnapshotAt = elapsed;
    pastSelfEcho = null;
    fishCollection.clear();
    if (Array.isArray(data.fishCollection)) {
      for (const entry of data.fishCollection) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number") {
          fishCollection.set(entry[0], Math.max(0, Math.floor(entry[1])));
        }
      }
    }
    fishingUntil = 0;
    terrainGenerators = Math.max(0, Math.floor(data.terrainGenerators ?? 0));
    terrainLevel = Math.max(0, Math.floor(data.terrainLevel ?? 0));
    terrainAnimationUntil = 0;
    const savedSunkenRafts = Array.isArray(data.sunkenRafts)
      ? data.sunkenRafts.filter((wreck): wreck is SunkenRaft =>
          typeof wreck?.x === "number"
          && typeof wreck.y === "number"
          && typeof wreck.width === "number"
          && typeof wreck.height === "number"
          && typeof wreck.raisedAt === "number"
          && typeof wreck.bridgeBuilt === "boolean"
          && typeof wreck.bobOffset === "number"
        ).slice(0, MAX_SUNKEN_RAFTS)
      : [];
    sunkenRafts = savedSunkenRafts;
    if (sunkenRafts.length === 0 && terrainLevel > 0) {
      const migrationCount = Math.min(MAX_SUNKEN_RAFTS, terrainLevel * RAFTS_PER_TERRAIN_GENERATOR);
      const unsinkTime = gameKind === "creative" ? SUNKEN_RAFT_CREATIVE_TIME : SUNKEN_RAFT_SURVIVAL_TIME;
      sunkenRafts = Array.from({ length: migrationCount }, (_, index) => createSunkenRaft(index, elapsed + unsinkTime));
    }
    for (const wreck of sunkenRafts) {
      if (wreck.bridgeBuilt && !wreck.bridgeSourceKind) assignSunkenRaftBridgeSource(wreck);
    }
    // Terrain Generators no longer create additional sharks. Old generated swarms are retired on load.
    extraSharks = [];
    animalReadyAt = ISLANDS.map((_, index) => elapsed + Math.max(0, data.animalReadyIn?.[index] ?? 0));
    const terrainMargin = terrainLevel > 0 ? Math.min(900, 500 + terrainLevel * 120) : 0;
    player.x = clamp(data.playerX ?? WIDTH / 2, 20 - terrainMargin, WIDTH - 20 + terrainMargin);
    player.y = clamp(data.playerY ?? HEIGHT / 2, 78 - terrainMargin, HEIGHT - 20 + terrainMargin);
    shark.x = clamp(data.sharkX ?? 110, SHARK_EDGE_PADDING, WIDTH - SHARK_EDGE_PADDING);
    shark.y = clamp(data.sharkY ?? 120, 78 + SHARK_EDGE_PADDING, HEIGHT - SHARK_EDGE_PADDING);
    shark.angle = data.sharkAngle ?? 0;
    sharkFleeUntil = elapsed + Math.max(0, data.sharkFleeIn ?? 0);
    nextShopkeeperAt = elapsed + Math.min(SHOPKEEPER_INTERVAL, Math.max(0, data.nextShopkeeperIn ?? SHOPKEEPER_INTERVAL));
    shopkeeperUntil = elapsed + Math.max(0, data.shopkeeperRemaining ?? 0);
    syncCargoShips();
    const restoredCargo = Array.isArray(data.cargoShipCargo) ? data.cargoShipCargo.slice(0, cargoShips.length) : [];
    restoredCargo.forEach((cargo, index) => {
      const ship = cargoShips[index];
      if (!ship) return;
      ship.cargo = cargo;
      ship.state = "returning";
      ship.x = clamp(cargo.x, 30, WIDTH - 30);
      ship.y = clamp(cargo.y, 100, HEIGHT - 30);
    });
    mode = "paused";
    restoredAutosave = true;
    updatePauseButton();
    updateShopkeeperButton();
    updateTerrainButton();
    updateTimeWarperButton();
    updateCreativeCrateSpawnerButton();
    if (pendingMultiplayerState) applyMultiplayerState(pendingMultiplayerState);
    if (multiplayerConnected && multiplayerIsHost) saveGame();
  } catch {
    showMessage("SAVE FILE NEEDS RECOVERY. YOUR DATA WAS NOT DELETED.", 5);
  }
}

function createBubbles(count: number): Bubble[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * WIDTH,
    y: 80 + Math.random() * (HEIGHT - 80),
    radius: 2 + Math.random() * 6,
    speed: 9 + Math.random() * 22,
    opacity: 0.1 + Math.random() * 0.22,
  }));
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function roundedRect(x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isNightmareLevel(): boolean {
  return saveSelected && raftLevel >= 1000;
}

function syncNightmareTheme(): void {
  const active = isNightmareLevel();
  const uiMode = active ? "nightmare" : gameKind;
  if (document.body.dataset["sharksUiMode"] === uiMode) return;
  document.body.dataset["sharksUiMode"] = uiMode;
  document.body.classList.toggle("level-1000-horror", active);
  const instructions = document.querySelector<HTMLElement>(".instructions");
  if (instructions) {
    instructions.textContent = active
      ? "Move: WASD/arrows · Hold Space: flee faster · R: fish · G: terrain generator · K: crates · E: eat · C: ritual table · B: mimic chests · J: red merchant · F: blood oranges · H: attack/hunt · P: pause"
      : "Move: WASD/arrows · Hold Space: speed boost · R: fish · G: terrain generator · K: crates · E: eat · C: craft · B: chest · J: shop · F: coconuts · H: attack/hunt · P: pause";
  }
  const harvestButton = document.querySelector<HTMLButtonElement>("[data-action='harvest']");
  harvestButton?.setAttribute("aria-label", active ? "Harvest blood oranges" : "Harvest coconuts");
  const statusLabel = document.querySelector<HTMLElement>(".shopkeeper-status-label");
  if (statusLabel) statusLabel.textContent = active ? "The Red Merchant" : "Technology Merchant";
  const breadInstruction = document.querySelector<HTMLElement>(".bread-tray span");
  if (breadInstruction) {
    breadInstruction.textContent = active
      ? "Drag the breathing bread into the toothed machine when the Glitched Fish loses its shape."
      : "Drag this bread into the Glitched Fish when it becomes a toaster!";
  }
}

function frame(timestamp: number): void {
  const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  if (gameDeleted) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    requestAnimationFrame(frame);
    return;
  }
  update(dt);
  syncNightmareTheme();
  draw();
  updateShopkeeperCounter();
  requestAnimationFrame(frame);
}

function updateShopkeeperCounter(): void {
  const counter = document.getElementById("shopkeeper-counter");
  if (!counter) return;
  if (!saveSelected) {
    counter.textContent = "Choose a save file to begin";
    return;
  }
  if (isNightmareLevel()) {
    counter.textContent = `Save ${currentSaveSlot} • It never leaves • It is waiting`;
    return;
  }
  if (isHacker) {
    counter.textContent = `Save ${currentSaveSlot} • Hacker Mode (${gameKind === "creative" ? "Creative" : "Survival"}) • Owner only`;
    return;
  }
  if (gameKind === "creative") {
    counter.textContent = `Save ${currentSaveSlot} • Creative Mode • Shop always open`;
    return;
  }
  if (mode === "ready") {
    counter.textContent = "Arrives 5:00 after you begin";
    return;
  }
  if (isShopkeeperHere()) {
    counter.textContent = `Shopkeeper is here — leaves in ${formatTime(Math.max(0, Math.ceil(shopkeeperUntil - elapsed)))}`;
  } else {
    counter.textContent = `Returns in ${formatTime(Math.max(0, Math.ceil(nextShopkeeperAt - elapsed)))}`;
  }
}

restoreRecoveredSaveOne();
migrateLegacySave();
renderSaveSlots();
requestAnimationFrame(frame);
