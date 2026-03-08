import type { ColorTheme, GrowthStage, PetCondition } from "../model/types";
import { isMillionaireMode, isNu11Mode } from "./theme";
import type { Rgb } from "./utils";

export function getBandaidStyle(stage: GrowthStage, theme?: ColorTheme) {
  if (isNu11Mode(theme)) {
    return {
      name: "Cursed Bandage",
      color: [20, 20, 25] as [number, number, number],
      pattern: "runes",
      description: "A black bandage covered in glowing red runes...",
    };
  }
  if (isMillionaireMode(theme)) {
    if (stage === "baby") {
      return {
        name: "Budget Bandage",
        color: [210, 210, 210] as [number, number, number],
        pattern: "plain",
        description: "A plain bandage. It does the job.",
      };
    }
    if (stage === "child") {
      return {
        name: "Sticker Bandage",
        color: [200, 230, 210] as [number, number, number],
        pattern: "stars",
        description: "A simple bandage with a tiny star sticker.",
      };
    }
    if (stage === "teen") {
      return {
        name: "Designer Bandage",
        color: [255, 220, 140] as [number, number, number],
        pattern: "logo",
        description: "Limited edition. Naturally.",
      };
    }
    return {
      name: "Diamond Bandage",
      color: [220, 255, 255] as [number, number, number],
      pattern: "gems",
      description: "Ridiculously fancy. Ridiculously effective.",
    };
  }
  if (stage === "baby" || stage === "child") {
    return {
      name: "Sparkly Band-Aid",
      color: [255, 182, 193] as [number, number, number],
      pattern: "hearts",
      description: "A cute sparkly band-aid with hearts!",
    };
  }
  return {
    name: "Skull Band-Aid",
    color: [80, 60, 80] as [number, number, number],
    pattern: "skulls",
    description: "A spooky band-aid with skulls!",
  };
}

export function getDoctorTheme(stage: GrowthStage, theme?: ColorTheme) {
  if (isNu11Mode(theme)) {
    return {
      name: "XYY4$992WQERS",
      background: [5, 5, 10] as [number, number, number],
      accent: [139, 0, 0] as [number, number, number],
      equipmentColor: [30, 80, 30] as [number, number, number],
      description: "The void clinic awaits... XYY4$992WQERS will see you now.",
      doctorStyle: "void",
      reward: "Void candy",
    };
  }
  if (isMillionaireMode(theme)) {
    if (stage === "baby" || stage === "child") {
      return {
        name: "Community Clinic",
        background: [235, 245, 235] as [number, number, number],
        accent: [120, 170, 140] as [number, number, number],
        equipmentColor: [190, 190, 190] as [number, number, number],
        description: "A small clinic. It's simple, but it helps.",
        doctorStyle: "community",
        reward: "tiny sticker",
      };
    }
    if (stage === "teen") {
      return {
        name: "Private Clinic",
        background: [225, 255, 235] as [number, number, number],
        accent: [255, 220, 140] as [number, number, number],
        equipmentColor: [210, 210, 210] as [number, number, number],
        description: "A bright lobby and a quiet waiting room.",
        doctorStyle: "private",
        reward: "gold sticker",
      };
    }
    return {
      name: "Concierge Doctor",
      background: [210, 250, 225] as [number, number, number],
      accent: [255, 220, 125] as [number, number, number],
      equipmentColor: [220, 240, 230] as [number, number, number],
      description: "VIP care. No waiting. No worries.",
      doctorStyle: "concierge",
      reward: "diamond badge",
    };
  }
  if (stage === "baby" || stage === "child") {
    return {
      name: "Friendly Pediatrician",
      background: [230, 245, 255] as [number, number, number],
      accent: [255, 182, 193] as [number, number, number],
      equipmentColor: [100, 200, 255] as [number, number, number],
      description: "A cheerful, colorful clinic!",
      doctorStyle: "friendly",
      reward: "star sticker",
    };
  }
  return {
    name: "Dr. Spooky's Clinic",
    background: [40, 30, 50] as [number, number, number],
    accent: [100, 255, 100] as [number, number, number],
    equipmentColor: [80, 80, 80] as [number, number, number],
    description: "A creepy doctor's office...",
    doctorStyle: "creepy",
    reward: "eyeball candy",
  };
}

export function getDentistTheme(stage: GrowthStage, theme?: ColorTheme) {
  if (isNu11Mode(theme)) {
    return {
      name: "The Fang Keeper",
      background: [10, 5, 15] as [number, number, number],
      accent: [139, 0, 0] as [number, number, number],
      chairColor: [20, 15, 25] as [number, number, number],
      toolColor: [80, 0, 0] as [number, number, number],
      equipmentColor: [80, 0, 0] as [number, number, number],
      description: "The Fang Keeper's lair... Your fangs will be examined.",
      dentistStyle: "keeper",
      reward: "Tooth from the void",
    };
  }
  if (isMillionaireMode(theme)) {
    if (stage === "baby" || stage === "child") {
      return {
        name: "Neighborhood Dentist",
        background: [250, 255, 250] as [number, number, number],
        accent: [120, 170, 140] as [number, number, number],
        chairColor: [210, 230, 220] as [number, number, number],
        toolColor: [180, 180, 180] as [number, number, number],
        equipmentColor: [180, 180, 180] as [number, number, number],
        description: "A small office with a friendly smile.",
        dentistStyle: "friendly",
        reward: "new toothbrush",
      };
    }
    if (stage === "teen") {
      return {
        name: "Whitening Studio",
        background: [245, 255, 250] as [number, number, number],
        accent: [255, 220, 140] as [number, number, number],
        chairColor: [220, 245, 235] as [number, number, number],
        toolColor: [200, 200, 200] as [number, number, number],
        equipmentColor: [200, 200, 200] as [number, number, number],
        description: "Bright lights, clean tools, polished results.",
        dentistStyle: "studio",
        reward: "whitening kit",
      };
    }
    return {
      name: "Diamond Dental",
      background: [225, 255, 245] as [number, number, number],
      accent: [255, 220, 125] as [number, number, number],
      chairColor: [210, 245, 235] as [number, number, number],
      toolColor: [220, 240, 235] as [number, number, number],
      equipmentColor: [220, 240, 235] as [number, number, number],
      description: "Luxury polishing. Glittering smiles.",
      dentistStyle: "luxury",
      reward: "diamond floss",
    };
  }
  if (stage === "baby" || stage === "child") {
    return {
      name: "Happy Smiles Dental",
      background: [255, 250, 240] as [number, number, number],
      accent: [255, 215, 0] as [number, number, number],
      chairColor: [173, 216, 230] as [number, number, number],
      toolColor: [192, 192, 192] as [number, number, number],
      equipmentColor: [192, 192, 192] as [number, number, number],
      description: "A friendly dental office!",
      dentistStyle: "friendly",
      reward: "new toothbrush",
    };
  }
  return {
    name: "Fang Fixer's Den",
    background: [30, 30, 40] as [number, number, number],
    accent: [100, 255, 100] as [number, number, number],
    chairColor: [50, 40, 60] as [number, number, number],
    toolColor: [100, 200, 100] as [number, number, number],
    equipmentColor: [100, 200, 100] as [number, number, number],
    description: "A gothic dental chair awaits...",
    dentistStyle: "gothic",
    reward: "bone toothpick",
  };
}

export function isSpookyMedical(stage: GrowthStage, theme?: ColorTheme): boolean {
  if (isNu11Mode(theme)) return true;
  if (isMillionaireMode(theme)) return false;
  return stage === "teen" || stage === "monster";
}

export function getConditionIndicator(
  condition: PetCondition,
  stage: GrowthStage,
  theme?: ColorTheme
): { icon: string | null; color: Rgb | null; message: string; buttonText: string } {
  const isNu11 = isNu11Mode(theme);
  const spooky = isSpookyMedical(stage, theme);
  if (isNu11) {
    return {
      none: { icon: null, color: null, message: "", buttonText: "" },
      minor_ouchie: {
        icon: "bandaid",
        color: [139, 0, 0] as Rgb,
        message: "The wound calls for a cursed bandage...",
        buttonText: "Apply Curse",
      },
      bigger_injury: {
        icon: "doctor",
        color: [139, 0, 0] as Rgb,
        message: "XYY4$992WQERS awaits in the void...",
        buttonText: "Enter the Void",
      },
      dental_problem: {
        icon: "tooth",
        color: [80, 0, 0] as Rgb,
        message: "The Fang Keeper demands your presence...",
        buttonText: "Summon Keeper",
      },
    }[condition];
  }
  return {
    none: { icon: null, color: null, message: "", buttonText: "" },
    minor_ouchie: {
      icon: "bandaid",
      color: [255, 100, 100] as Rgb,
      message: spooky ? "Ouch! Needs a spooky patch!" : "Ouch! Needs a band-aid!",
      buttonText: spooky ? "Apply Patch" : "Apply Band-Aid",
    },
    bigger_injury: {
      icon: "doctor",
      color: [255, 50, 50] as Rgb,
      message: spooky ? "Injured! Time for Dr. Spooky!" : "Injured! Time for the doctor!",
      buttonText: spooky ? "Visit Dr. Spooky" : "Visit Doctor",
    },
    dental_problem: {
      icon: "tooth",
      color: [255, 255, 100] as Rgb,
      message: spooky ? "Fang trouble! Visit the Fang Fixer!" : "Tooth trouble! Visit the dentist!",
      buttonText: spooky ? "Visit Fang Fixer" : "Visit Dentist",
    },
  }[condition];
}

export function getTreatmentSteps(condition: PetCondition, stage: GrowthStage, theme?: ColorTheme): string[] {
  const isNu11 = isNu11Mode(theme);
  const isMillionaire = isMillionaireMode(theme);
  if (condition === "minor_ouchie") {
    if (isNu11) {
      return ["The wound glows faintly...", "Apply the Cursed Bandage", "The runes pulse with power!"];
    }
    if (isMillionaire) {
      if (stage === "baby" || stage === "child") {
        return ["Show the boo-boo", "Apply a simple bandage", "All better!"];
      }
      return ["Call the concierge", "Apply a designer bandage", "Back to business!"];
    }
    if (stage === "baby" || stage === "child") {
      return ["Show the ouchie", "Apply sparkly band-aid", "Kiss it better!"];
    }
    return ["Examine the wound", "Apply skull band-aid", "All patched up!"];
  }
  if (condition === "bigger_injury") {
    if (isNu11) {
      return [
        "Enter the void clinic...",
        "XYY4$992WQERS examines you",
        "Apply suspicious green potion",
        "Leech therapy complete!",
      ];
    }
    if (isMillionaire) {
      if (stage === "baby" || stage === "child") {
        return ["Arrive at the clinic", "Quick check-up", "Carefully wrap it", "Get a tiny sticker"];
      }
      return ["Arrive at the private clinic", "VIP examination", "Premium treatment", "Signed off with a gold badge"];
    }
    if (stage === "baby" || stage === "child") {
      return ["Arrive at clinic", "Doctor examination", "Apply treatment", "Get a star sticker!"];
    }
    return ["Enter the dark clinic", "Creepy examination", "Mysterious treatment", "Receive eyeball candy!"];
  }
  if (condition === "dental_problem") {
    if (isNu11) {
      return [
        "Descend into the Keeper's lair",
        "The Fang Keeper inspects your fangs",
        "Ancient fang restoration ritual",
        "Your fangs absorb the void!",
      ];
    }
    if (isMillionaire) {
      if (stage === "baby" || stage === "child") {
        return ["Sit in the chair", "Open wide!", "Fix the tooth", "Shiny smile!"];
      }
      return ["Sit in the deluxe chair", "Open wide!", "Polish and repair", "Diamond-bright smile!"];
    }
    if (stage === "baby" || stage === "child") {
      return ["Sit in the dental chair", "Open wide!", "Fix the tooth", "Sparkly clean smile!"];
    }
    return ["Enter the gothic chamber", "Bare your fangs!", "Fang repair in progress", "Fangs restored!"];
  }
  return [];
}
