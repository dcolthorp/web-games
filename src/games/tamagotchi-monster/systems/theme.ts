import type { ColorTheme, GrowthStage } from "../model/types";
import { clamp, lerpColor, type Rgb } from "./utils";

type Palette = {
  background_light: Rgb;
  background_medium: Rgb;
  accent: Rgb;
  accent_secondary: Rgb;
  text: Rgb;
  button: Rgb;
  button_hover: Rgb;
  pet_body: Rgb;
  pet_accent: Rgb;
  cheeks: Rgb;
};

export type ThemeColors = {
  background: Rgb;
  accent: Rgb;
  text: Rgb;
  button: Rgb;
  button_hover: Rgb;
};

export type PetColors = {
  body: Rgb;
  spots?: Rgb;
  outline?: Rgb;
  eyes?: Rgb;
  eye_shine?: Rgb;
  mouth?: Rgb;
  cheeks?: Rgb;
  teeth?: Rgb;
  claws?: Rgb;
};

const PASTEL_PALETTES: Record<ColorTheme, Palette> = {
  blue: {
    background_light: [224, 240, 255],
    background_medium: [200, 225, 245],
    accent: [100, 180, 255],
    accent_secondary: [255, 215, 0],
    text: [40, 60, 100],
    button: [173, 216, 230],
    button_hover: [135, 190, 220],
    pet_body: [200, 220, 255],
    pet_accent: [150, 200, 255],
    cheeks: [255, 200, 200],
  },
  pink: {
    background_light: [255, 228, 236],
    background_medium: [255, 210, 225],
    accent: [255, 130, 170],
    accent_secondary: [255, 215, 0],
    text: [100, 50, 80],
    button: [255, 182, 193],
    button_hover: [255, 150, 170],
    pet_body: [255, 210, 230],
    pet_accent: [255, 170, 200],
    cheeks: [255, 150, 180],
  },
  green: {
    background_light: [220, 245, 220],
    background_medium: [200, 235, 200],
    accent: [100, 200, 130],
    accent_secondary: [255, 235, 59],
    text: [50, 80, 50],
    button: [180, 220, 180],
    button_hover: [150, 200, 150],
    pet_body: [200, 240, 210],
    pet_accent: [150, 220, 170],
    cheeks: [255, 200, 200],
  },
  purple: {
    background_light: [240, 225, 255],
    background_medium: [225, 200, 245],
    accent: [180, 130, 255],
    accent_secondary: [255, 200, 100],
    text: [80, 50, 100],
    button: [210, 180, 230],
    button_hover: [190, 160, 210],
    pet_body: [230, 210, 255],
    pet_accent: [200, 170, 240],
    cheeks: [255, 190, 210],
  },
  orange: {
    background_light: [255, 240, 220],
    background_medium: [255, 225, 200],
    accent: [255, 170, 100],
    accent_secondary: [255, 220, 100],
    text: [100, 70, 40],
    button: [255, 210, 170],
    button_hover: [255, 190, 140],
    pet_body: [255, 220, 190],
    pet_accent: [255, 190, 150],
    cheeks: [255, 180, 170],
  },
  black: {
    background_light: [16, 16, 16],
    background_medium: [26, 26, 26],
    accent: [139, 0, 0],
    accent_secondary: [57, 255, 20],
    text: [192, 192, 192],
    button: [40, 20, 20],
    button_hover: [60, 30, 30],
    pet_body: [60, 60, 70],
    pet_accent: [30, 30, 35],
    cheeks: [80, 20, 20],
  },
};

let currentTheme: ColorTheme = "blue";

export function setCurrentTheme(theme: ColorTheme): void {
  currentTheme = theme;
}

export function getCurrentTheme(): ColorTheme {
  return currentTheme;
}

export function isNu11Mode(theme?: ColorTheme): boolean {
  return (theme ?? currentTheme) === "black";
}

export function isMillionaireMode(theme?: ColorTheme): boolean {
  return (theme ?? currentTheme) === "green";
}

export function getThemeColors(stage: GrowthStage, theme: ColorTheme): ThemeColors {
  const palette = PASTEL_PALETTES[theme];
  if (theme === "black") {
    return {
      background: palette.background_light,
      accent: palette.accent_secondary,
      text: palette.text,
      button: palette.button,
      button_hover: palette.button_hover,
    };
  }
  if (isMillionaireMode(theme)) {
    const light = palette.background_light;
    const medium = palette.background_medium;
    const gold = palette.accent_secondary;
    const green = palette.accent;
    const teenBg = lerpColor(medium, [150, 200, 150], 0.5);
    const monsterBg = lerpColor(medium, [130, 185, 135], 0.7);
    const background =
      stage === "egg"
        ? light
        : stage === "baby"
          ? light
          : stage === "child"
            ? medium
            : stage === "teen"
              ? teenBg
              : monsterBg;
    const accent = stage === "baby" ? green : gold;
    return {
      background,
      accent,
      text: palette.text,
      button: palette.button,
      button_hover: palette.button_hover,
    };
  }
  if (stage === "egg") {
    return {
      background: palette.background_light,
      accent: palette.accent_secondary,
      text: palette.text,
      button: palette.button,
      button_hover: palette.button_hover,
    };
  }
  if (stage === "baby") {
    return {
      background: palette.background_light,
      accent: palette.accent,
      text: palette.text,
      button: palette.button,
      button_hover: palette.button_hover,
    };
  }
  if (stage === "child") {
    return {
      background: palette.background_medium,
      accent: palette.accent_secondary,
      text: palette.text,
      button: palette.button,
      button_hover: palette.button_hover,
    };
  }
  if (stage === "teen") {
    return {
      background: [225, 190, 231],
      accent: [255, 152, 0],
      text: [70, 50, 70],
      button: [200, 160, 210],
      button_hover: [180, 140, 190],
    };
  }
  return {
    background: [74, 20, 140],
    accent: [118, 255, 3],
    text: [200, 220, 200],
    button: [100, 50, 120],
    button_hover: [130, 70, 150],
  };
}

export function getPetColors(stage: GrowthStage, theme: ColorTheme): PetColors {
  const palette = PASTEL_PALETTES[theme];
  if (theme === "black") {
    return {
      body: palette.pet_body,
      spots: palette.pet_accent,
      outline: [20, 20, 25],
      eyes: [255, 50, 50],
      eye_shine: [255, 100, 100],
      mouth: [80, 20, 20],
      cheeks: palette.cheeks,
      teeth: [180, 180, 170],
      claws: [30, 20, 30],
    };
  }
  if (isMillionaireMode(theme)) {
    return {
      body: [205, 235, 200],
      spots: [255, 216, 120],
      outline: [120, 150, 120],
      eyes: [40, 50, 40],
      eye_shine: [255, 255, 255],
      mouth: [120, 90, 60],
      cheeks: [215, 235, 210],
      teeth: [255, 255, 235],
      claws: [140, 120, 80],
    };
  }
  if (stage === "egg") {
    const accent = palette.pet_accent;
    return {
      body: palette.pet_body,
      spots: palette.pet_accent,
      outline: [clamp(accent[0] - 50, 0, 255), clamp(accent[1] - 50, 0, 255), clamp(accent[2] - 50, 0, 255)],
    };
  }
  if (stage === "baby") {
    return {
      body: palette.pet_body,
      eyes: [40, 40, 40],
      eye_shine: [255, 255, 255],
      mouth: [255, 150, 150],
      cheeks: palette.cheeks,
    };
  }
  if (stage === "child") {
    return {
      body: palette.pet_body,
      eyes: [40, 40, 40],
      eye_shine: [255, 255, 255],
      mouth: [200, 100, 100],
      cheeks: palette.cheeks,
      teeth: [255, 255, 255],
    };
  }
  if (stage === "teen") {
    return {
      body: [180, 160, 200],
      eyes: [60, 20, 20],
      eye_shine: [255, 200, 200],
      mouth: [150, 80, 80],
      teeth: [240, 240, 230],
    };
  }
  return {
    body: [80, 60, 100],
    eyes: [255, 50, 50],
    eye_shine: [255, 150, 100],
    mouth: [100, 20, 20],
    teeth: [200, 200, 180],
    claws: [60, 40, 60],
  };
}

export function getBackgroundColor(stage: GrowthStage, theme?: ColorTheme): Rgb {
  return getThemeColors(stage, theme ?? currentTheme).background;
}

export function getAccentColor(stage: GrowthStage, theme?: ColorTheme): Rgb {
  return getThemeColors(stage, theme ?? currentTheme).accent;
}

export function getTextColor(stage: GrowthStage, theme?: ColorTheme): Rgb {
  return getThemeColors(stage, theme ?? currentTheme).text;
}

export function getButtonColor(stage: GrowthStage, theme?: ColorTheme): Rgb {
  return getThemeColors(stage, theme ?? currentTheme).button;
}

export function getButtonHoverColor(stage: GrowthStage, theme?: ColorTheme): Rgb {
  return getThemeColors(stage, theme ?? currentTheme).button_hover;
}

export function getTransitionBackground(
  fromStage: GrowthStage,
  toStage: GrowthStage,
  progress: number,
  theme?: ColorTheme
): Rgb {
  const t = clamp(progress, 0, 1);
  const from = getBackgroundColor(fromStage, theme);
  const to = getBackgroundColor(toStage, theme);
  return lerpColor(from, to, t);
}

export function isSpookyStage(stage: GrowthStage, theme?: ColorTheme): boolean {
  if (isNu11Mode(theme)) return true;
  if (isMillionaireMode(theme)) return false;
  return stage === "teen" || stage === "monster";
}

export function getDecorationTypes(stage: GrowthStage, theme?: ColorTheme): string[] {
  if (isNu11Mode(theme)) return ["drips", "floating_eyes", "void_symbols", "tendrils"];
  if (isMillionaireMode(theme)) {
    const map: Record<GrowthStage, string[]> = {
      egg: ["sparkles", "coins"],
      baby: ["coins", "sparkles"],
      child: ["coins", "bills"],
      teen: ["bills", "diamonds"],
      monster: ["diamonds", "coins", "bills"],
      shadow: ["coins", "diamonds"],
      specter: ["coins", "diamonds"],
      wraith: ["coins", "diamonds"],
      phantom: ["coins", "diamonds"],
      revenant: ["coins", "diamonds"],
      nightmare: ["coins", "diamonds"],
      void_walker: ["coins", "diamonds"],
      abyss: ["coins", "diamonds"],
      eldritch: ["coins", "diamonds"],
      corrupted: ["coins", "diamonds"],
      xyy4: ["coins", "diamonds"],
    };
    return map[stage] ?? ["coins", "sparkles"];
  }
  const map: Record<GrowthStage, string[]> = {
    egg: ["hearts", "stars", "sparkles"],
    baby: ["hearts", "flowers", "sparkles"],
    child: ["stars", "swirls", "sparkles"],
    teen: ["shadows", "mist"],
    monster: ["cobwebs", "bones", "drips"],
    shadow: ["drips", "floating_eyes", "void_symbols"],
    specter: ["drips", "floating_eyes", "void_symbols"],
    wraith: ["drips", "floating_eyes", "void_symbols"],
    phantom: ["drips", "floating_eyes", "void_symbols"],
    revenant: ["drips", "floating_eyes", "void_symbols"],
    nightmare: ["drips", "floating_eyes", "void_symbols"],
    void_walker: ["drips", "floating_eyes", "void_symbols"],
    abyss: ["drips", "floating_eyes", "void_symbols"],
    eldritch: ["drips", "floating_eyes", "void_symbols"],
    corrupted: ["drips", "floating_eyes", "void_symbols"],
    xyy4: ["drips", "floating_eyes", "void_symbols"],
  };
  return map[stage] ?? [];
}

export function getParticleTypes(stage: GrowthStage, theme?: ColorTheme): string[] {
  if (isNu11Mode(theme)) return ["drip", "void_spark"];
  if (isMillionaireMode(theme)) {
    const map: Record<GrowthStage, string[]> = {
      egg: ["glint"],
      baby: ["glint"],
      child: ["glint"],
      teen: ["glint"],
      monster: ["glint"],
      shadow: ["glint"],
      specter: ["glint"],
      wraith: ["glint"],
      phantom: ["glint"],
      revenant: ["glint"],
      nightmare: ["glint"],
      void_walker: ["glint"],
      abyss: ["glint"],
      eldritch: ["glint"],
      corrupted: ["glint"],
      xyy4: ["glint"],
    };
    return map[stage] ?? ["glint"];
  }
  const map: Record<GrowthStage, string[]> = {
    egg: ["sparkle"],
    baby: ["sparkle", "heart"],
    child: ["sparkle"],
    teen: ["mist"],
    monster: ["drip", "smoke"],
    shadow: ["drip", "void_spark"],
    specter: ["drip", "void_spark"],
    wraith: ["drip", "void_spark"],
    phantom: ["drip", "void_spark"],
    revenant: ["drip", "void_spark"],
    nightmare: ["drip", "void_spark"],
    void_walker: ["drip", "void_spark"],
    abyss: ["drip", "void_spark"],
    eldritch: ["drip", "void_spark"],
    corrupted: ["drip", "void_spark"],
    xyy4: ["drip", "void_spark"],
  };
  return map[stage] ?? ["sparkle"];
}

export function getAmbientDarkness(stage: GrowthStage, theme?: ColorTheme): number {
  if (isNu11Mode(theme)) return 0.7;
  if (isMillionaireMode(theme)) return 0;
  const map: Record<GrowthStage, number> = {
    egg: 0,
    baby: 0,
    child: 0.1,
    teen: 0.3,
    monster: 0.5,
    shadow: 0.7,
    specter: 0.7,
    wraith: 0.7,
    phantom: 0.7,
    revenant: 0.7,
    nightmare: 0.7,
    void_walker: 0.7,
    abyss: 0.7,
    eldritch: 0.7,
    corrupted: 0.7,
    xyy4: 0.7,
  };
  return map[stage] ?? 0;
}
