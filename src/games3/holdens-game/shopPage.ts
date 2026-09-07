import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { buy, coins, glitchUnlocked, owned, skins, wear, wornSkin } from "./shop";

installOofShortcut();
installForceRefreshHotkey();

const list = document.querySelector<HTMLUListElement>("#skins");
const purse = document.querySelector<HTMLElement>("#purse-count");
const note = document.querySelector<HTMLParagraphElement>("#shop-note");

function powers(skin: typeof skins[number]): string[] {
  const out: string[] = [];
  if (skin.speed > 1) out.push(`${Math.round((skin.speed - 1) * 100)}% faster`);
  if (skin.speed < 1) out.push(`${Math.round((1 - skin.speed) * 100)}% slower`);
  if (skin.fogBonus > 0) out.push(`sees ${skin.fogBonus} tiles further`);
  if (skin.iceGrip) out.push("grips ice");
  if (skin.windProof) out.push("ignores wind");
  if (skin.waterProof) out.push("swims freely");
  if (skin.shield > 0) out.push(`${skin.shield} free hit`);
  if (skin.phase) out.push("walks through walls");
  return out;
}

function render(): void {
  if (!list || !purse) return;
  purse.textContent = String(coins());
  const have = owned();
  const worn = wornSkin();
  list.replaceChildren();

  skins.filter((skin) => !skin.secret || glitchUnlocked()).forEach((skin) => {
    const mine = have.includes(skin.id);
    const on = worn.id === skin.id;

    const item = document.createElement("li");
    item.className = "skin";
    item.classList.toggle("is-worn", on);

    const swatch = document.createElement("span");
    swatch.className = "skin-swatch";
    swatch.style.background = skin.colour;

    const text = document.createElement("div");
    text.className = "skin-text";
    const name = document.createElement("p");
    name.className = "skin-name";
    name.textContent = skin.name;
    const blurb = document.createElement("p");
    blurb.className = "skin-blurb";
    blurb.textContent = skin.blurb;
    const tags = document.createElement("p");
    tags.className = "skin-tags";
    tags.textContent = powers(skin).join(" · ") || "no powers";
    text.append(name, blurb, tags);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "skin-buy";
    action.textContent = on ? "Worn" : mine ? "Wear it" : `${skin.price} coins`;
    action.disabled = on;
    action.dataset["id"] = skin.id;
    action.dataset["act"] = mine ? "wear" : "buy";
    if (!mine && coins() < skin.price) action.classList.add("is-short");

    item.append(swatch, text, action);
    list.append(item);
  });
}

list?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-id]") : null;
  if (!target) return;
  const id = target.dataset["id"] ?? "";
  if (target.dataset["act"] === "wear") {
    wear(id);
    if (note) note.textContent = "Skin changed. It applies in every world.";
  } else {
    const result = buy(id);
    if (note) note.textContent = result.ok ? "Bought. Press again to wear it." : result.reason ?? "";
  }
  render();
});

render();
