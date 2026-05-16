import { MOD_OOF_KEY, MOD_TM_DANCER_KEY, MOD_TM_MORE_ANIMATIONS_KEY, isModEnabled, setModEnabled } from "../shared/mods";
import { installOofShortcut } from "../shared/oofShortcut";
import oofIconUrl from "../shared/images/oof.svg";

installOofShortcut();
import {
  OUMG_GAME_ID,
  OUMG_MAZE_X_DLC_ID,
  consumeBeatCredit,
  getBeatCredits,
  isDlcPurchased,
  isDlcUnlocked,
  setDlcEnabled,
  unlockDlc,
} from "../shared/dlc";

interface Mod {
  id: string;
  name: string;
  blurb: string;
  target: string;
  storageKey: string;
  iconUrl?: string;
}

interface Dlc {
  id: string;
  name: string;
  blurb: string;
  target: string;
  gameId: string;
}

const dlcs: Dlc[] = [
  {
    id: OUMG_MAZE_X_DLC_ID,
    name: "MAZE_X",
    blurb: "Something is whispering through the walls. Plays a found-tape transmission while you play.",
    target: "Oscar's Untitled Maze Game",
    gameId: OUMG_GAME_ID,
  },
];

const mods: Mod[] = [
  {
    id: "tm-more-animations",
    name: "More Animations",
    blurb: "Gives your Tamagotchi Monster extra idle moves: sway, spin, wiggle, hop.",
    target: "Tamagotchi Monster",
    storageKey: MOD_TM_MORE_ANIMATIONS_KEY,
  },
  {
    id: "oof",
    name: "OOF",
    blurb: "While on, type /oof anywhere to teleport to Roblox.",
    target: "Anywhere",
    storageKey: MOD_OOF_KEY,
    iconUrl: oofIconUrl,
  },
  {
    id: "tm-dancer",
    name: "Dancer",
    blurb: "Name your monster \"dancer\" and it becomes a mannequin. Dance gets creepier each evolution.",
    target: "Tamagotchi Monster",
    storageKey: MOD_TM_DANCER_KEY,
  },
];

function renderModList(): void {
  const list = document.getElementById("mod-list");
  if (!list) return;

  if (mods.length === 0) {
    list.innerHTML = '<li class="empty-state">No mods yet.</li>';
    return;
  }

  list.innerHTML = mods
    .map((mod) => {
      const enabled = isModEnabled(mod.storageKey);
      const icon = mod.iconUrl
        ? `<img class="mod-icon" src="${mod.iconUrl}" alt="" aria-hidden="true" />`
        : "";
      return `
        <li>
          <button class="mod-card" data-mod-id="${mod.id}" data-storage-key="${mod.storageKey}" aria-pressed="${enabled}">
            <span class="game-card-top">
              <span class="game-tag">${mod.target}</span>
              <span class="mod-toggle">${enabled ? "ON" : "OFF"}</span>
            </span>
            ${icon}
            <span class="game-title">${mod.name}</span>
            <span class="game-blurb">${mod.blurb}</span>
          </button>
        </li>
      `;
    })
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".mod-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset["storageKey"];
      if (!key) return;
      const next = !isModEnabled(key);
      setModEnabled(key, next);
      renderModList();
    });
  });
}

function renderDlcList(): void {
  const list = document.getElementById("dlc-list");
  if (!list) return;

  if (dlcs.length === 0) {
    list.innerHTML = '<li class="empty-state">No DLCs yet.</li>';
    return;
  }

  list.innerHTML = dlcs
    .map((dlc) => {
      const purchased = isDlcPurchased(dlc.id);
      const enabled = isDlcUnlocked(dlc.id);
      const credits = getBeatCredits(dlc.gameId);
      let state: "locked" | "available" | "on" | "off";
      let tagText: string;
      let help: string;
      if (purchased) {
        state = enabled ? "on" : "off";
        tagText = enabled ? "ON" : "OFF";
        help = enabled ? "Click to disable this DLC." : "Click to re-enable this DLC.";
      } else if (credits > 0) {
        state = "available";
        tagText = `${credits} credit${credits === 1 ? "" : "s"}`;
        help = `Click to spend 1 credit and unlock. (${credits} available)`;
      } else {
        state = "locked";
        tagText = "LOCKED";
        help = `Beat ${dlc.target} to earn an unlock credit.`;
      }
      return `
        <li>
          <button class="dlc-card" data-state="${state}" data-dlc-id="${dlc.id}" data-game-id="${dlc.gameId}" aria-pressed="${enabled}">
            <span class="game-card-top">
              <span class="game-tag">${dlc.target}</span>
              <span class="dlc-state-tag">${tagText}</span>
            </span>
            <span class="game-title">${dlc.name}</span>
            <span class="game-blurb">${dlc.blurb}</span>
            <span class="dlc-help">${help}</span>
          </button>
        </li>
      `;
    })
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".dlc-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dlcId = btn.dataset["dlcId"];
      const gameId = btn.dataset["gameId"];
      if (!dlcId || !gameId) return;
      if (isDlcPurchased(dlcId)) {
        setDlcEnabled(dlcId, !isDlcUnlocked(dlcId));
        renderDlcList();
        return;
      }
      if (!consumeBeatCredit(gameId)) return;
      unlockDlc(dlcId);
      renderDlcList();
    });
  });
}

renderModList();
renderDlcList();
