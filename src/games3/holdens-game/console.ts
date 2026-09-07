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
    name: "creative", usage: "creative101", blurb: "creative mode: no death, build walls",
    run: (args, world, print) => {
      if (args[0] !== "101") { print("just type: creative101"); return; }
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
    name: "speed", usage: "speed2", blurb: "how fast you move, 1 is normal",
    run: (args, world, print) => {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) { print("speed needs a number, like: speed2"); return; }
      world.setSpeedScale(n);
      print(`speed ${n}.`);
    },
  },
  {
    name: "fog", usage: "fog5 / fogoff / fogauto", blurb: "how far you can see",
    run: (args, world, print) => {
      if (args[0] === "off") { world.setFog(0); print("fog off."); return; }
      if (args[0] === "auto") { world.setFog(null); print("fog back to normal."); return; }
      const n = Number(args[0]);
      if (!Number.isFinite(n)) { print("try fog5, fogoff or fogauto"); return; }
      world.setFog(n);
      print(`fog ${n}.`);
    },
  },
  {
    name: "tp", usage: "tp20,14", blurb: "jump somewhere. the map is 40 by 28",
    run: (args, world, print) => {
      const x = Number(args[0]);
      const y = Number(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) { print("tp needs two numbers, like: tp20,14"); return; }
      print(world.teleport(x, y) ? `at ${x},${y}.` : "that is off the map.");
    },
  },
  {
    name: "coins", usage: "coins25", blurb: "put coins in your pocket",
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

    // Everything works as one word: creative101, speed2, fogoff, tp20,14.
    // Spaces are fine too, for anyone who prefers them.
    const parse = (text: string): { name: string; args: string[] } => {
      if (/\s/.test(text)) {
        const [head, ...tail] = text.split(/\s+/);
        return { name: (head ?? "").toLowerCase(), args: tail };
      }
      const glued = text.toLowerCase();
      const match = commands
        .map((c) => c.name)
        .filter((n) => glued.startsWith(n))
        .sort((a, b) => b.length - a.length)[0];
      if (!match) return { name: glued, args: [] };
      const rest = glued.slice(match.length);
      return { name: match, args: rest.match(/[a-z]+|[0-9]+(?:\.[0-9]+)?/g) ?? [] };
    };

    const { name, args } = parse(raw);
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
