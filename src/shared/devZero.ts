// dev.0 is the very first Oscar's Games: version zero, from before any of the
// games on the hub. Everything got built on top of it and it was left behind,
// broken. That's why the hub title keeps glitching into its name, and why it
// crashes everything when you poke it. Flip its broken zeros back into ones
// and it's rebuilt as dev.1, which is friendly.

export const DEV_ZERO_REBUILT_KEY = "hub-dev0-rebuilt";

const BROKEN_PIECES = 10;
// How often each unfixed zero skitters somewhere else.
const SKITTER_MS = 1100;

const STORY = [
  "I was the first Oscar's Games.",
  "Version zero. Before every game on that page.",
  "Then everything got built on top of me, and I got left down here. Broken.",
  "Fix me, and I'll stop crashing everything.",
];

export function isDevZeroRebuilt(): boolean {
  return localStorage.getItem(DEV_ZERO_REBUILT_KEY) === "true";
}

// Takes over the crash lockout once its countdown runs out: dev.0 tells you
// who it is, then you catch its zeros. `finish` closes the lockout.
export function runDevZeroRebuild(lockout: HTMLElement, finish: () => void): void {
  for (const child of Array.from(lockout.children)) {
    if (!child.classList.contains("crash-lockout-static")) child.remove();
  }

  const title = document.createElement("p");
  title.className = "crash-lockout-title";
  title.textContent = "dev.0";
  const story = document.createElement("div");
  story.className = "dev-zero-story";
  const field = document.createElement("div");
  field.className = "dev-zero-field";
  field.hidden = true;
  const status = document.createElement("p");
  status.className = "crash-lockout-detail";
  const leave = document.createElement("button");
  leave.type = "button";
  leave.className = "dev-zero-leave";
  leave.textContent = "Leave it broken";
  leave.addEventListener("click", finish);
  lockout.append(title, story, field, status, leave);

  // The story types itself out one line at a time, then the zeros show up.
  let line = 0;
  const nextLine = (): void => {
    if (line >= STORY.length) {
      startCatching();
      return;
    }
    const text = document.createElement("p");
    text.className = "dev-zero-line";
    story.appendChild(text);
    const words = STORY[line] ?? "";
    line += 1;
    let shown = 0;
    const type = (): void => {
      shown += 1;
      text.textContent = words.slice(0, shown);
      if (shown < words.length) window.setTimeout(type, 38);
      else window.setTimeout(nextLine, 700);
    };
    type();
  };
  nextLine();

  function startCatching(): void {
    field.hidden = false;
    let fixed = 0;
    status.textContent = `CLICK THE ZEROS · 0 / ${BROKEN_PIECES} FIXED`;

    const timers: number[] = [];
    for (let index = 0; index < BROKEN_PIECES; index += 1) {
      const piece = document.createElement("button");
      piece.type = "button";
      piece.className = "dev-zero-piece";
      piece.textContent = "0";
      piece.setAttribute("aria-label", "Broken piece of dev.0");
      field.appendChild(piece);

      const skitter = (): void => {
        piece.style.left = `${4 + Math.random() * 88}%`;
        piece.style.top = `${4 + Math.random() * 80}%`;
      };
      skitter();
      // Staggered so they don't all jump at once.
      const timer = window.setInterval(skitter, SKITTER_MS + Math.random() * 600);
      timers.push(timer);

      piece.addEventListener("click", () => {
        window.clearInterval(timer);
        piece.disabled = true;
        piece.textContent = "1";
        piece.classList.add("is-fixed");
        fixed += 1;
        status.textContent = `CLICK THE ZEROS · ${fixed} / ${BROKEN_PIECES} FIXED`;
        if (fixed === BROKEN_PIECES) rebuilt();
      });
    }

    function rebuilt(): void {
      timers.forEach((timer) => window.clearInterval(timer));
      localStorage.setItem(DEV_ZERO_REBUILT_KEY, "true");
      lockout.classList.add("is-rebuilt");
      title.textContent = "dev.1";
      story.replaceChildren();
      const thanks = document.createElement("p");
      thanks.className = "dev-zero-line";
      thanks.textContent = "REBUILT. Thank you. I'll keep the games running from down here now.";
      story.appendChild(thanks);
      status.textContent = "dev.0 → dev.1";
      leave.textContent = "Back to Oscar's Games";
    }
  }
}

// Once dev.0 is rebuilt, poking the glitching title gets a hello instead of a
// crash.
export function showDevOneHello(title: HTMLElement): void {
  document.querySelector(".dev-one-hello")?.remove();
  const bubble = document.createElement("p");
  bubble.className = "dev-one-hello";
  bubble.textContent = "dev.1: All fixed. Everything's running fine down here.";
  title.insertAdjacentElement("afterend", bubble);
  window.setTimeout(() => bubble.remove(), 3500);
}
