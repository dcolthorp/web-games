// Every question from the Python game, lifted straight out of
// kids-games/roblox_trivia.py so not a word of it got retyped wrong.

export interface Question {
  question: string;
  options: string[];
  answer: number;
  successMessage?: string;
  failureMessage?: string;
  // ULTIMATE borrows every other mode's questions and paints each one in
  // the colours of wherever it came from.
  sourceDifficulty?: string;
}

export interface Difficulty {
  name: string;
  color: string;
  hidden: boolean;
  questions: Question[];
}

export const DIFFICULTIES: Record<string, Difficulty> = {
  "Tutorial": {
    name: "Tutorial",
    color: "#ffffff",
    hidden: false,
    questions: [
      {
        question: "This is a tutorial. Just click option A",
        options: ["A", "B", "C", "D"],
        answer: 0,
        successMessage: "Great job!",
      },
      {
        question: "Now click option B",
        options: ["A", "B", "C", "D"],
        answer: 1,
        successMessage: "Great job!",
      },
      {
        question: "Next, click option C",
        options: ["A", "B", "C", "D"],
        answer: 2,
        successMessage: "Great job!",
      },
      {
        question: "Finally, click option D",
        options: ["A", "B", "C", "D"],
        answer: 3,
        successMessage: "Great job!",
      },
    ],
  },
  "Easy": {
    name: "Easy",
    color: "#00c800",
    hidden: false,
    questions: [
      {
        question: "Which Roblox game involves adopting pets and building homes?",
        options: ["Brookhaven RP", "Adopt Me!", "Royale High", "Pet Simulator X"],
        answer: 1,
      },
      {
        question: "Which game is known for naval combat and Devil Fruit powers?",
        options: ["Blox Fruits", "Blade Ball", "Tower of Hell", "Anime Last Stand"],
        answer: 0,
      },
      {
        question: "Which relaxing farming sim set a concurrency record in 2025?",
        options: ["Grow a Garden", "Farm World", "Island Royale", "Greenlands"],
        answer: 0,
      },
      {
        question: "Which open-world roleplay game lets you own houses and cars?",
        options: ["Brookhaven RP", "Royale High", "Adopt Me!", "MeepCity"],
        answer: 0,
      },
      {
        question: "Which obby game challenges players with a tower with no checkpoints?",
        options: ["Tower of Hell", "Speed Run 4", "Jailbreak", "Blade Ball"],
        answer: 0,
      },
      {
        question: "Which tower-defense style game features anime characters?",
        options: ["Anime Last Stand", "Anime Adventures", "Blox Fruits", "Hero Tale"],
        answer: 0,
      },
      {
        question: "Which PvP game has players deflecting projectiles with swords?",
        options: ["Blade Ball", "Arsenal", "Murder Mystery 2", "Bad Business"],
        answer: 0,
      },
      {
        question: "Which game tasks innocents and sheriffs to stop a killer?",
        options: ["Murder Mystery 2", "Brookhaven RP", "Piggy", "Arsenal"],
        answer: 0,
      },
      {
        question: "Which game has players collecting coins to hatch and trade pets?",
        options: ["Pet Simulator X", "Adopt Me!", "Royale High", "Bee Swarm Simulator"],
        answer: 0,
      },
      {
        question: "Which fantasy high school roleplay game lets you attend classes?",
        options: ["Royale High", "Brookhaven RP", "Adopt Me!", "Bloxburg"],
        answer: 0,
      },
    ],
  },
  "Intermediate": {
    name: "Intermediate",
    color: "#dcdc00",
    hidden: false,
    questions: [
      {
        question: "In which year was Roblox officially released to the public?",
        options: ["2004", "2005", "2006", "2007"],
        answer: 2,
      },
      {
        question: "What is the name of Roblox's virtual currency?",
        options: ["Robux", "V-Bucks", "Minecoins", "Gold"],
        answer: 0,
      },
      {
        question: "Which character is often called the classic Roblox 'noob'?",
        options: ["Guest 666", "Noob", "Bacon Hair", "Builderman"],
        answer: 1,
      },
      {
        question: "Which scripting language is primarily used on Roblox?",
        options: ["Python", "Lua", "JavaScript", "C#"],
        answer: 1,
      },
      {
        question: "Which Roblox event lets developers showcase virtual items for sale?",
        options: ["Egg Hunt", "DevEx", "UGC", "Bloxy Awards"],
        answer: 2,
      },
      {
        question: "What is the maximum number of friends a user can have on Roblox (2025)?",
        options: ["100", "200", "500", "1000"],
        answer: 3,
      },
    ],
  },
  "Hard": {
    name: "Hard",
    color: "#c80000",
    hidden: false,
    questions: [
      {
        question: "Which service allows Roblox games to store permanent cross-server data?",
        options: ["TeleportService", "BadgeService", "DataStoreService", "InsertService"],
        answer: 2,
      },
      {
        question: "What is the name of the Roblox physics engine introduced in 2016?",
        options: ["Havok", "PBD", "Fe", "Quantum"],
        answer: 1,
      },
      {
        question: "Which Roblox property determines how far a light reaches?",
        options: ["Brightness", "Range", "Angle", "ShadowSoftness"],
        answer: 1,
      },
      {
        question: "Which event replaced the Bloxy Awards in 2023?",
        options: ["Innovation Awards", "Creator Awards", "Builder Awards", "Metaverse Awards"],
        answer: 0,
      },
      {
        question: "What is the current maximum concurrent players allowed on a Roblox server?",
        options: ["50", "100", "200", "700"],
        answer: 2,
      },
      {
        question: "What does 'FE' stand for in Roblox security context?",
        options: ["Front-End", "Filtering Enabled", "Fast Execution", "Full Encryption"],
        answer: 1,
      },
    ],
  },
  "Impossible": {
    name: "Impossible",
    color: "#c800c8",
    hidden: false,
    questions: [
      {
        question: "Which internal bytecode instruction does Roblox Lua use for table traversal?",
        options: ["GETTABLE", "ITERSTEPI", "FORGLOOP", "SETLIST"],
        answer: 2,
      },
      {
        question: "How many triangles are in the default Roblox 'Head' mesh (R15) after 2022 update?",
        options: ["116", "248", "512", "1024"],
        answer: 1,
      },
      {
        question: "What is the hexadecimal asset ID of the classic 'Rocket Launcher' gear?",
        options: ["0x2d3aa", "0x77d77", "0x4b42d", "0x5f1ad"],
        answer: 2,
      },
      {
        question: "Which secret key combination opens the Roblox Studio microprofiler?",
        options: ["Ctrl+Shift+F3", "Ctrl+Alt+P", "Alt+Shift+F6", "Ctrl+Shift+Alt+F7"],
        answer: 0,
      },
      {
        question: "Roblox's FFlag 'StudioMeshPartUseCage' defaulted to true in which week of 2023?",
        options: ["W05", "W13", "W27", "W42"],
        answer: 3,
      },
      {
        question: "What is the internal codename for Roblox's streaming enabled tech?",
        options: ["Influx", "FISSURE", "Federation", "Nebula"],
        answer: 0,
      },
    ],
  },
  "God Mode": {
    name: "God Mode",
    color: "#ffffff",
    hidden: true,
    questions: [
      {
        question: "What decimal number equals hexadecimal 0x2F?",
        options: ["31", "47", "63", "127"],
        answer: 1,
      },
      {
        question: "Which ASCII character has decimal code 47?",
        options: ["_", "/", "?", "\\"],
        answer: 1,
      },
      {
        question: "Which RunService event fires AFTER the physics simulation step completes?",
        options: ["Stepped", "Heartbeat", "RenderStepped", "PostSimulation"],
        answer: 1,
      },
      {
        question: "In Roblox Luau, which operator performs floor (integer) division?",
        options: ["/", "//", "%", "^"],
        answer: 1,
      },
      {
        question: "In Luau, what does `typeof(Instance.new(\"Part\"))` return?",
        options: ["\"Part\"", "\"BasePart\"", "\"Instance\"", "\"userdata\""],
        answer: 2,
      },
      {
        question: "Which API is the modern replacement for legacy `FindPartOnRay` style raycasts?",
        options: ["Workspace:Raycast", "Workspace:CastRay", "RunService:Raycast", "PhysicsService:Raycast"],
        answer: 0,
      },
      {
        question: "Which constructor creates a coordinate frame from a position and a target point?",
        options: ["CFrame.new(pos, target)", "CFrame.lookAt(pos, target)", "CFrame.fromAxisAngle(pos, target)", "CFrame.fromMatrix(pos, target)"],
        answer: 1,
      },
      {
        question: "Where do Roblox 'Attributes' come from (the API behind GetAttribute/SetAttribute)?",
        options: ["AttributesService", "CollectionService", "Instance built-in methods", "ReplicatedStorage"],
        answer: 2,
      },
      {
        question: "Which service is responsible for tagging Instances via `AddTag` and `GetTagged`?",
        options: ["TagService", "CollectionService", "HttpService", "InsertService"],
        answer: 1,
      },
      {
        question: "What does `CollectionService:GetTagged(\"X\")` return?",
        options: ["A dictionary of Instances keyed by name", "A single Instance", "An array (table) of Instances", "A Signal you connect to"],
        answer: 2,
      },
      {
        question: "Which API is used to preload assets so they are available before gameplay?",
        options: ["ContentProvider:PreloadAsync", "InsertService:Preload", "AssetService:Warmup", "HttpService:PreloadAsync"],
        answer: 0,
      },
      {
        question: "Which property prevents a Part from being replicated to clients while it exists on the server?",
        options: ["CanQuery", "Archivable", "ReplicationFocus", "No such property"],
        answer: 3,
      },
    ],
  },
  "???": {
    name: "???",
    color: "#000000",
    hidden: true,
    questions: [
      {
        question: "Which coding platform did the developers use to make roblox?",
        options: ["Notepad++", "Visual Studio", "Vim", "Eclipse"],
        answer: 1,
      },
      {
        question: "What was Roblox called during its beta phase?",
        options: ["Dynablocks", "Robloxia", "BloxWorld", "Brickplace"],
        answer: 0,
      },
      {
        question: "In what year did Roblox officially adopt its current name?",
        options: ["2004", "2005", "2006", "2007"],
        answer: 1,
      },
      {
        question: "Which engine does Roblox use for rendering graphics?",
        options: ["Unity", "Unreal", "Custom", "CryEngine"],
        answer: 2,
      },
      {
        question: "Which language powers Roblox scripting?",
        options: ["Python", "Lua", "C#", "Java"],
        answer: 1,
      },
    ],
  },
  "Trophy Mode": {
    name: "Trophy Mode",
    color: "#ffc828",
    hidden: true,
    questions: [
      {
        question: "In Grow a Garden's Bloom Finale event, which crop turned into golden petals when fully watered?",
        options: ["Sunflower", "Carrot", "Turnip", "Cucumber"],
        answer: 0,
      },
      {
        question: "What special mechanic was added during Grow a Garden's Night Market event?",
        options: ["Glow fertilizer that doubled growth at night", "Shared sprinklers across plots", "Pet bees that followed players", "Weather votes every minute"],
        answer: 0,
      },
      {
        question: "How did players trigger the Meteor Shower during Grow a Garden's Sky Seeds event?",
        options: ["Lighting three bonfires", "Buying the meteor rod", "Completing the windmill puzzle", "Feeding ten birds"],
        answer: 0,
      },
      {
        question: "When the Disco Drop timer hit zero in Steal a Brainrot, what changed on the map?",
        options: ["Every chest became a music crate", "The map turned grayscale", "Players lost half their cash", "Abilities were frozen for 30 seconds"],
        answer: 0,
      },
      {
        question: "Which limited gadget was rewarded for surviving the Neon Storm event in Steal a Brainrot?",
        options: ["Shock Baton", "Prismatic Scanner", "Brainshield Drone", "Glitched Umbrella"],
        answer: 3,
      },
      {
        question: "During the Heist Relay weekend in Steal a Brainrot, what bonus did the second runner grant the squad?",
        options: ["20% speed for 30 seconds", "Double cash on the next grab", "A free respawn token", "Revealed every camera"],
        answer: 1,
      },
    ],
  },
  "Prismatic": {
    name: "Prismatic",
    color: "#ffffff",
    hidden: true,
    questions: [
      {
        question: "True or False: Roblox supports HDR rendering natively.",
        options: ["True", "False", "Only in Studio", "Depends on OS"],
        answer: 1,
      },
      {
        question: "Which Roblox API can dynamically change part colors at runtime?",
        options: ["TweenService", "ColorService", "Lighting", "RunService"],
        answer: 0,
      },
      {
        question: "What is the maximum numeric value for BrickColor IDs?",
        options: ["1023", "255", "999", "127"],
        answer: 0,
      },
      {
        question: "Which shader technique simulates rainbows via refraction?",
        options: ["Bloom", "Fresnel", "Chromatic Aberration", "Phong"],
        answer: 2,
      },
      {
        question: "Which event fires every render frame?",
        options: ["Stepped", "Heartbeat", "RenderStepped", "Updated"],
        answer: 2,
      },
    ],
  },
  "Divine": {
    name: "Divine",
    color: "#ffc800",
    hidden: true,
    questions: [
      {
        question: "Which ancient Roblox myth involves fire-themed ruins?",
        options: ["John Doe", "1x1x1x1", "Telamon", "The Hunger"],
        answer: 3,
      },
      {
        question: "Which particle emitter property controls flame height?",
        options: ["Size", "Speed", "Lifetime", "Spread"],
        answer: 2,
      },
      {
        question: "Which 2024 update revamped Roblox's material system?",
        options: ["Material3", "MeshMaterials", "PBR2", "Surface2"],
        answer: 0,
      },
      {
        question: "Which limited hat is known as the \"Lord of the Federation\"?",
        options: ["Dominus Empyreus", "Dominus Astra", "Dominus Infernus", "Dominus Frigidus"],
        answer: 2,
      },
      {
        question: "Maximum heat value before a part ignites using Fire object?",
        options: ["10", "25", "50", "No limit"],
        answer: 3,
      },
    ],
  },
  "Coming Soon": {
    name: "Coming Soon",
    color: "#ffff00",
    hidden: true,
    questions: [
      {
        question: "Do you know what's coming in future updates?",
        options: ["Yes", "No", "Maybe", "It's a secret"],
        answer: 3,
      },
    ],
  },
};

// The order the modes are listed in, and what has to be perfect before each
// one shows up at all.
export const BASE_ORDER = ["Tutorial", "Easy", "Intermediate", "Hard", "Impossible"];
export const ULTIMATE_SOURCES = [
  "Tutorial",
  "Easy",
  "Intermediate",
  "Hard",
  "Impossible",
  "???",
  "Trophy Mode",
  "Prismatic",
  "Divine",
  "Coming Soon",
];

// ULTIMATE is every question in the game, one after another, each still
// wearing the colours of the mode it came from.
export function ultimateQuestions(): Question[] {
  const questions: Question[] = [];
  for (const source of ULTIMATE_SOURCES) {
    for (const question of DIFFICULTIES[source]?.questions ?? []) {
      questions.push({ ...question, sourceDifficulty: source });
    }
  }
  return questions;
}

export const EXTRA_MODES = ["Prismatic", "Divine", "Coming Soon"];

// The story the ERROR page tells, one paragraph at a time.
export const ERROR_PARAGRAPHS = [
  "At first, there was nothing. Silence across the grid, a canvas waiting for meaning.",
  "Then two builders\u2014Oscar and dad\u2014forged the ultimate Roblox Trivia, and the world had its first heartbeat.",
  "Whispers stirred. A mystery flickered into being: the secret ??? mode, hiding in plain sight.",
  "Brilliance scattered into facets\u2014Prismatic and Divine\u2014extra modes shimmering at the edges of reality.",
  "A prophecy was pinned to the horizon: Coming Soon, a banner of ambition yet to arrive.",
  "Endless challenge unfolded: Infinite Mode, where questions marched on without end.",
  "And now\u2026 the ERROR. A rupture turned revelation, a backstage of updates told as legend.",
];
