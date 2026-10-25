export {};

// A round button with a little piece of lined paper on it, on every page, just
// above the Credits button. It opens the Message Board: type anything, hit
// Post, and everybody playing sees it straight away. The dev server keeps the
// posts (see the "message-board" plugin in vite.config.ts) and only lets Oscar
// post; everybody else only sees the posts, not the box to write in. Penelope
// can post too from Oscar's computer: her button turns the box pink and signs
// the post with her name, and her posts are pink so everybody knows it was her.

type Author = "Oscar" | "Penelope";
type Post = { id: string; author?: Author; text: string; postedAt: number };

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .open { position: fixed; z-index: 2147483600; top: 8px; right: 200px; width: 42px; height: 42px; display: grid; place-items: center; border: 2px solid rgba(255,255,255,.55); border-radius: 50%; padding: 0; background: rgba(0,0,0,.6); cursor: pointer; }
  .open:hover, .open:focus-visible { background: #000; border-color: #fff; outline: none; }
  .open[hidden] { display: none; }
  .open svg { width: 22px; height: 26px; }
  .screen { position: fixed; z-index: 2147483600; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.65); font-family: "Trebuchet MS", sans-serif; animation: fade-in 200ms ease-out; }
  .screen[hidden] { display: none; }
  .board { position: relative; width: min(560px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; gap: 14px; padding: 22px; border-radius: 18px; background: #fffdf3; color: #1d2433; box-shadow: 0 18px 60px rgba(0,0,0,.45); }
  h2 { margin: 0; padding-right: 40px; font: 900 30px/1.05 Impact, Haettenschweiler, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
  .close { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border: 2px solid #1d2433; border-radius: 50%; background: #fff; color: #1d2433; font: 800 16px/1 "Trebuchet MS", sans-serif; cursor: pointer; }
  form[hidden] { display: none; }
  form { display: flex; flex-direction: column; gap: 8px; }
  textarea { width: 100%; min-height: 76px; resize: vertical; border: 2px solid #c9cfdc; border-radius: 12px; padding: 10px 12px; font: 16px/1.4 "Trebuchet MS", sans-serif; color: inherit; background: #fff; }
  textarea:focus { outline: none; border-color: #3a6df0; }
  .writer { position: relative; }
  .writer textarea { padding-top: 30px; }
  .name-tag { position: absolute; top: 9px; left: 14px; font: 800 13px/1 "Trebuchet MS", sans-serif; letter-spacing: .04em; color: #3a6df0; pointer-events: none; }
  form.as-penelope textarea { background: #fff0f7; border-color: #f2b8d6; }
  form.as-penelope textarea:focus { border-color: #e0539b; }
  form.as-penelope .name-tag { color: #d0377f; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .status { color: #6b7385; font-size: 13px; }
  .post { border: 0; border-radius: 999px; padding: 9px 22px; background: #3a6df0; color: #fff; font: 800 15px "Trebuchet MS", sans-serif; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
  .post:disabled { opacity: .5; cursor: default; }
  .list { flex: 1; min-height: 80px; overflow-y: auto; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .list li { padding: 10px 14px; border-radius: 12px; background: repeating-linear-gradient(#fff 0 23px, #dbe4f5 23px 24px); border: 1px solid #e3e6ee; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 16px; line-height: 24px; }
  .list li.by-penelope { background: repeating-linear-gradient(#fff0f7 0 23px, #f6cfe2 23px 24px); border-color: #f2b8d6; }
  .list .author { display: block; color: #3a6df0; font-weight: 800; font-size: 13px; line-height: 20px; }
  .list li.by-penelope .author { color: #d0377f; }
  .list time { display: block; margin-top: 4px; color: #8a91a2; font-size: 12px; line-height: 1.2; }
  .list li.new { animation: pop 500ms ease-out; }
  .empty { color: #6b7385; text-align: center; padding: 18px 0; }
  .penelope { margin-right: auto; border: 2px solid #c05bd6; border-radius: 999px; padding: 7px 14px; background: #fbeefe; color: #8a2fa0; font: 800 13px "Trebuchet MS", sans-serif; cursor: pointer; }
  .penelope:hover, .penelope:focus-visible { background: #f3d6fa; outline: none; }
  @keyframes fade-in { from { opacity: 0; } }
  @keyframes pop { from { background: #fff3a6; transform: scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .screen, .list li.new { animation: none; } }
`;

// A sheet of paper with a folded corner and lines of writing on it.
const PAPER_ICON = `
  <svg viewBox="0 0 22 26" aria-hidden="true">
    <path d="M2 1.5h12.5L20 7v17.5H2z" fill="#fff" stroke="#fff" stroke-linejoin="round"/>
    <path d="M14.5 1.5V7H20" fill="#cfd6e4" stroke="#9aa3b5" stroke-width="1" stroke-linejoin="round"/>
    <path d="M5 10h12M5 13.5h12M5 17h12M5 20.5h8" stroke="#3a6df0" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
`;

const host = document.createElement("div");
host.className = "site-message-board";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <style>${STYLE}</style>
  <button type="button" class="open" aria-label="Message board" title="Message board">${PAPER_ICON}</button>
  <div class="screen" role="dialog" aria-label="Message board" hidden>
    <div class="board">
      <h2>Message Board</h2>
      <button type="button" class="close" aria-label="Close">✕</button>
      <form hidden>
        <div class="writer">
          <span class="name-tag">Oscar</span>
          <textarea maxlength="500" placeholder="Write anything! Like: I made a new game, it's called…"></textarea>
        </div>
        <div class="row">
          <button type="button" class="penelope">This is Penelope</button>
          <span class="status"></span>
          <button type="submit" class="post">Post</button>
        </div>
      </form>
      <ul class="list"></ul>
    </div>
  </div>
`;
document.body.appendChild(host);

const openButton = shadow.querySelector<HTMLButtonElement>(".open")!;
const screen = shadow.querySelector<HTMLDivElement>(".screen")!;
const closeButton = shadow.querySelector<HTMLButtonElement>(".close")!;
const form = shadow.querySelector<HTMLFormElement>("form")!;
const textarea = shadow.querySelector<HTMLTextAreaElement>("textarea")!;
const postButton = shadow.querySelector<HTMLButtonElement>(".post")!;
const status = shadow.querySelector<HTMLSpanElement>(".status")!;
const list = shadow.querySelector<HTMLUListElement>(".list")!;
const penelopeButton = shadow.querySelector<HTMLButtonElement>(".penelope")!;
const nameTag = shadow.querySelector<HTMLSpanElement>(".name-tag")!;

// Whoever is writing. The board always opens as Oscar; Penelope's button
// switches to her, and pressing it again switches back.
let author: Author = "Oscar";

penelopeButton.addEventListener("click", () => {
  setAuthor(author === "Penelope" ? "Oscar" : "Penelope");
  textarea.focus();
});

function setAuthor(next: Author): void {
  author = next;
  nameTag.textContent = next;
  form.classList.toggle("as-penelope", next === "Penelope");
  penelopeButton.textContent = next === "Penelope" ? "This is Oscar" : "This is Penelope";
}

let posts: Post[] = [];

openButton.addEventListener("click", (event) => {
  event.stopPropagation();
  showBoard();
});
closeButton.addEventListener("click", hideBoard);
screen.addEventListener("click", (event) => {
  if (event.target === screen) hideBoard();
});
// Keep the game underneath from reacting to typing on the board.
for (const type of ["keydown", "keyup", "keypress"]) {
  screen.addEventListener(type, (event) => {
    event.stopPropagation();
    if (type === "keydown" && (event as KeyboardEvent).key === "Escape") hideBoard();
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitPost();
});
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

// New posts from anybody show up the moment they're posted.
if (import.meta.hot) {
  import.meta.hot.on("message-board:post", (post: Post) => addPost(post));
}

async function showBoard(): Promise<void> {
  screen.hidden = false;
  openButton.hidden = true;
  setAuthor("Oscar");
  closeButton.focus();
  try {
    const response = await fetch("/api/message-board");
    if (!response.ok) throw new Error(String(response.status));
    const board = (await response.json()) as { posts: Post[]; canPost: boolean };
    posts = board.posts;
    form.hidden = !board.canPost;
    status.textContent = "";
    if (board.canPost) textarea.focus();
  } catch {
    posts = [];
    form.hidden = true;
  }
  renderPosts();
}

function hideBoard(): void {
  screen.hidden = true;
  openButton.hidden = false;
}

async function submitPost(): Promise<void> {
  const text = textarea.value.trim();
  if (!text) return;
  postButton.disabled = true;
  status.textContent = "Posting…";
  try {
    const response = await fetch("/api/message-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, author }),
    });
    if (!response.ok) throw new Error(String(response.status));
    addPost((await response.json()) as Post);
    textarea.value = "";
    status.textContent = "Posted!";
  } catch {
    status.textContent = "Couldn't post. Try again?";
  } finally {
    postButton.disabled = false;
    textarea.focus();
  }
}

function addPost(post: Post): void {
  if (posts.some((existing) => existing.id === post.id)) return;
  posts.push(post);
  if (!screen.hidden) renderPosts(post.id);
}

// Newest posts at the top.
function renderPosts(newId?: string): void {
  if (posts.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nothing here yet. Check back soon!";
    list.replaceChildren(empty);
    return;
  }
  const items = [...posts].reverse().map((post) => {
    const item = document.createElement("li");
    const by = post.author ?? "Oscar";
    item.classList.toggle("by-penelope", by === "Penelope");
    item.classList.toggle("new", post.id === newId);
    const name = document.createElement("span");
    name.className = "author";
    name.textContent = by;
    item.append(name, post.text);
    const time = document.createElement("time");
    time.dateTime = new Date(post.postedAt).toISOString();
    time.textContent = new Date(post.postedAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    item.appendChild(time);
    return item;
  });
  list.replaceChildren(...items);
}
