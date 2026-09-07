import type { WorldControl } from "./engine";
import { addCoins, coins } from "./shop";

interface Command {
  name: string;
  usage: string;
  blurb: string;
  run: (args: string[], world: WorldControl, print: (line: string) => void) => void;
}

const commands: Command[] = [
  {
    name: "help", usage: "help", blurb: "list every command",
    run: (_a, _w, print) => {
      print("commands:");
      commands.forEach((c) => print(`  ${c.usage.padEnd(18)} ${c.blurb}`));
    },
  },
  {
    name: "creative101", usage: "creative101", blurb: "creative mode: no death, build walls",
    run: (args, world, print) => {
      if (args[0] !== undefined && args[0] !== "101") { print("just type: creative101"); return; }
      world.setCreative(true);
      print("CREATIVE 101 ON.");
      print("  nothing can hurt you. you walk through walls.");
      print("  click the map to build a wall. shift-click or right-click to remove one.");
      print("  your edits are saved. type survival to go back, wipe to undo them.");
    },
  },
  {
    name: "survival", usage: "survival", blurb: "back to a level that can kill you",
    run: (_a, world, print) => { world.setCreative(false); print("survival. it can reach you again."); },
  },
  {
    name: "wipe", usage: "wipe", blurb: "undo every wall you built here",
    run: (_a, world, print) => print(`${world.clearEdits()} edits undone. reload to see it clean.`),
  },
  {
    name: "keys", usage: "keys", blurb: "every key, every door open",
    run: (_a, world, print) => { world.giveKeys(); print("all doors open."); },
  },
  {
    name: "speed", usage: "speed <n>", blurb: "how fast you move, 1 is normal",
    run: (args, world, print) => {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) { print("speed needs a number, like: speed 2"); return; }
      world.setSpeedScale(n);
      print(`speed ${n}.`);
    },
  },
  {
    name: "fog", usage: "fog <n|off>", blurb: "how far you can see",
    run: (args, world, print) => {
      if (args[0] === "off") { world.setFog(0); print("fog off."); return; }
      if (args[0] === "auto") { world.setFog(null); print("fog back to normal."); return; }
      const n = Number(args[0]);
      if (!Number.isFinite(n)) { print("fog needs a number, or off, or auto"); return; }
      world.setFog(n);
      print(`fog ${n}.`);
    },
  },
  {
    name: "tp", usage: "tp <x> <y>", blurb: "jump somewhere. the map is 40 by 28",
    run: (args, world, print) => {
      const x = Number(args[0]);
      const y = Number(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { print("tp needs two numbers, like: tp 20 14"); return; }
      print(world.teleport(x, y) ? `at ${x},${y}.` : "that is off the map.");
    },
  },
  {
    name: "coins", usage: "coins <n>", blurb: "put coins in your pocket",
    run: (args, _w, print) => {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) { print(`you have ${coins()} coins.`); return; }
      print(`${addCoins(n)} coins.`);
    },
  },
  {
    name: "clear", usage: "clear", blurb: "empty this window",
    run: (_a, _w, _print) => {
      const log = document.querySelector<HTMLElement>("#console-log");
      log?.replaceChildren();
    },
  },
];

export function startConsole(world: WorldControl): void {
  const form = document.querySelector<HTMLFormElement>("#console-form");
  const input = document.querySelector<HTMLInputElement>("#console-input");
  const log = document.querySelector<HTMLElement>("#console-log");
  if (!form || !input || !log) return;

  const print = (line: string): void => {
    const row = document.createElement("p");
    row.className = "console-line";
    // Set as text, never markup: this is whatever someone typed.
    row.textContent = line;
    log.append(row);
    log.scrollTop = log.scrollHeight;
  };

  print("type help");

  const history: string[] = [];
  let seek = -1;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    input.value = "";
    if (!raw) return;
    history.push(raw);
    seek = -1;
    print(`> ${raw}`);

    const [first, ...rest] = raw.split(/\s+/);
    let name = (first ?? "").toLowerCase();
    let args = rest;
    // "creative 101" still works for anyone who types it with the space.
    if (name === "creative" && rest[0] === "101") {
      name = "creative101";
      args = [];
    } else if (name === "creative") {
      print("just type: creative101");
      return;
    }
    const command = commands.find((c) => c.name === name);
    if (!command) {
      print(`no command called "${name}". type help`);
      return;
    }
    command.run(args, world, print);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (history.length === 0) return;
    seek = event.key === "ArrowUp"
      ? Math.min(history.length - 1, seek + 1)
      : Math.max(-1, seek - 1);
    input.value = seek < 0 ? "" : history[history.length - 1 - seek] ?? "";
  });
}
