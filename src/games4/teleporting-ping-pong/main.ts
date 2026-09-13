import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { HEIGHT, PingPongMatch, WIDTH, otherSide, type Side } from "./game";
import {
  BADGE_ROLES,
  canBanRecords,
  canReportRecords,
  checkProof,
  creatorId,
  fingerprintOf,
  grantableRoles,
  iAmCreator,
  isBadgeRole,
  isCreatorKey,
  isModeratorRole,
  loadIdentity,
  myFingerprint,
  myPublicKey,
  proveNonce,
  randomNonce,
  sanitizePublicKey,
  verifyGrant,
  type BadgeRole,
  type PublicKeyParts,
  type RecordActionKind,
} from "./identity";
import {
  BADGE_LABELS,
  actOnRecord,
  addToInbox,
  answerInvite,
  createGrant,
  flaggedCategories,
  flaggedPlayerIds,
  grantToShare,
  inbox,
  loadModeratorRole,
  myBadge,
  myPowerRole,
  pendingInviteFor,
  queueInvite,
  receiveRecordActions,
  recordActionsToShare,
  setCreatorBadge,
  takeInvite,
} from "./moderators";
import { findOpponent, type MatchLink, type NetMessage } from "./net";
import {
  BIO_PHRASES,
  MAX_BIO_PHRASES,
  leaderboard,
  loadProfile,
  rememberPlayer,
  renameProfile,
  sanitizeStats,
  searchPlayers,
  setBio,
  setProfileId,
  updateProfile,
  type BioPhrase,
  type LeaderboardCategory,
  type PlayerEntry,
  type PlayerStats,
  type You,
} from "./stats";

installOofShortcut();
installForceRefreshHotkey();

const SOLO_WIN_SCORE = 11;
const TOURNAMENT_WIN_SCORE = 7;
const SEND_INTERVAL_SECONDS = 1 / 30;
const OPPONENT_TIMEOUT_MS = 6000;
const MESSAGE_NOTE = "📬 You got a message! Check the lobby.";
const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  teleports: "Top Teleports",
  gamesWon: "Top Games Won",
  tournamentsWon: "Top Tournaments",
};
const RECORD_ACTION_WORDS: Record<RecordActionKind, { icon: string; confirm: string; verb: string; done: string }> = {
  ban: { icon: "🚫", confirm: "Ban?", verb: "Ban", done: "banned" },
  report: { icon: "⚠️", confirm: "Report?", verb: "Report", done: "reported" },
};
const RECORD_ACTION_HELP: Record<RecordActionKind, string> = {
  ban: "You can ban hacked records: press 🚫 next to one, then press it again to be sure. ⚠️ means a moderator reported it. Bans spread to everyone you play in a tournament.",
  report:
    "You can report records that look hacked: press ⚠️ next to one, then press it again to be sure. Leaderboard Moderators see your report once it reaches them through tournaments.",
};

function element<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
}

const canvas = element("game", HTMLCanvasElement);
const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Canvas 2D is not supported");
}
const ctx: CanvasRenderingContext2D = context;

const pauseButton = element("pause-button", HTMLButtonElement);
const leaveButton = element("leave-button", HTMLButtonElement);
const playerName = element("player-name", HTMLElement);
const playerBadge = element("player-badge", HTMLElement);
const playerStats = element("player-stats", HTMLElement);
const playerPowers = element("player-powers", HTMLElement);
const playerBio = element("player-bio", HTMLElement);
const lobbyNotice = element("lobby-notice", HTMLElement);
const creatorBadgeRow = element("creator-badge-row", HTMLElement);
const creatorBadgeSelect = element("creator-badge-select", HTMLSelectElement);
const messagesButton = element("messages-button", HTMLButtonElement);
const backToGameButton = element("back-to-game-button", HTMLButtonElement);
const tournamentStatus = element("tournament-status", HTMLElement);
const leaderboardsNotice = element("leaderboards-notice", HTMLElement);
const moderatorHelp = element("moderator-help", HTMLElement);
const searchInput = element("search-input", HTMLInputElement);
const searchSuggestions = element("search-suggestions", HTMLUListElement);
const searchEmpty = element("search-empty", HTMLElement);
const playerCard = element("player-card", HTMLElement);
const playerCardName = element("player-card-name", HTMLElement);
const playerCardRole = element("player-card-role", HTMLElement);
const playerCardStats = element("player-card-stats", HTMLElement);
const playerCardFlags = element("player-card-flags", HTMLElement);
const playerCardBio = element("player-card-bio", HTMLUListElement);
const inviteControls = element("invite-controls", HTMLElement);
const inviteRoleSelect = element("invite-role", HTMLSelectElement);
const inviteStatus = element("invite-status", HTMLElement);
const inboxList = element("inbox-list", HTMLUListElement);
const inboxEmpty = element("inbox-empty", HTMLElement);
const messagesNotice = element("messages-notice", HTMLElement);
const bioChoices = element("bio-choices", HTMLElement);
const bioCount = element("bio-count", HTMLElement);
const boardLists: Record<LeaderboardCategory, HTMLOListElement> = {
  teleports: element("board-teleports", HTMLOListElement),
  gamesWon: element("board-games-won", HTMLOListElement),
  tournamentsWon: element("board-tournaments-won", HTMLOListElement),
};
const overlays = {
  pause: element("pause-menu", HTMLElement),
  lobby: element("lobby", HTMLElement),
  tournament: element("tournament", HTMLElement),
  leaderboards: element("leaderboards", HTMLElement),
  search: element("search", HTMLElement),
  messages: element("messages", HTMLElement),
  bio: element("bio", HTMLElement),
};
type Overlay = keyof typeof overlays;

// What the other tournament player says about themselves, before they've proved it.
interface OpponentClaim {
  stats: PlayerStats;
  publicKey: PublicKeyParts | null;
  grant: unknown;
  creatorBadge: unknown;
}

let link: MatchLink | null = null;
let tournamentSearch: { cancel(): void } | null = null;
let openOverlay: Overlay | null = null;
let matchKind: "solo" | "tournament" = "solo";
let lastHeardAt = 0;
let sendTimer = 0;
let opponentClaim: OpponentClaim | null = null;
let opponentProof: unknown = null;
let sentNonces: string[] = [];
let gotMessageDuringMatch = false;
let selectedPlayer: PlayerEntry | null = null;
let creatorPlayerId: string | null = null;

const identityReady = loadIdentity().then(async (fingerprint) => {
  if (fingerprint) setProfileId(fingerprint);
  creatorPlayerId = await creatorId();
  await loadModeratorRole();
});

let match = createSoloMatch();

function showOverlay(name: Overlay | null): void {
  (Object.keys(overlays) as Overlay[]).forEach((key) => {
    overlays[key].hidden = key !== name;
  });
  if (openOverlay !== null && name === null) match.settleLocalPaddle();
  openOverlay = name;
  refreshCornerButtons();
}

// The pause button stays locked until you've won a game.
function refreshCornerButtons(): void {
  pauseButton.hidden = link !== null || openOverlay !== null || loadProfile().gamesWon === 0;
  leaveButton.hidden = link === null || openOverlay !== null;
}

function createSoloMatch(): PingPongMatch {
  const solo = new PingPongMatch(ctx, {
    mode: "solo",
    localSide: "left",
    names: { left: "You", right: "CPU" },
    winScore: SOLO_WIN_SCORE,
    onTeleport: recordTeleport,
    onGameOver: (winner) => handleGameOver(winner === "left"),
  });
  solo.gameOverHint = "Click to play again";
  return solo;
}

function startSoloGame(): void {
  leaveOnlineMatch(false);
  matchKind = "solo";
  match = createSoloMatch();
  showOverlay(null);
}

function recordTeleport(): void {
  updateProfile((profile) => {
    profile.teleports += 1;
  });
}

function handleGameOver(won: boolean): void {
  const tournament = matchKind === "tournament";
  const firstWin = loadProfile().gamesWon === 0;
  if (won) {
    updateProfile((stats) => {
      stats.gamesWon += 1;
      if (tournament) stats.tournamentsWon += 1;
    });
  }

  const notes: string[] = [];
  if (won && tournament) notes.push("🏆 You won the tournament!");
  if (won && firstWin) notes.push("🔓 You unlocked the pause button!");
  if (gotMessageDuringMatch) notes.push(MESSAGE_NOTE);
  match.gameOverNote = notes.join("  ");

  // Send the final stats so the other player's leaderboards are up to date.
  if (link) void sendHello(link);
  refreshCornerButtons();
}

function you(): You {
  return { badge: myBadge(), verified: myFingerprint() !== null };
}

function statsLine(stats: PlayerStats): string {
  return `🌀 ${stats.teleports} teleports · 🏓 ${stats.gamesWon} games won · 🏆 ${stats.tournamentsWon} tournaments won`;
}

function powersText(role: BadgeRole | null): string {
  const powers: string[] = [];
  if (canBanRecords(role)) powers.push("ban hacked leaderboard records");
  else if (canReportRecords(role)) powers.push("report records that look hacked");
  if (grantableRoles(role).length > 0) powers.push("make other players moderators");
  return powers.length > 0 ? `⚡ Your powers: ${powers.join(" and ")}.` : "";
}

function withArticle(label: string): string {
  return `${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`;
}

function badgeElement(badge: BadgeRole): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `badge badge-${badge}`;
  span.textContent = "M";
  span.title = BADGE_LABELS[badge];
  span.setAttribute("aria-label", BADGE_LABELS[badge]);
  return span;
}

function nameWithBadge(entry: PlayerEntry): HTMLSpanElement {
  const wrapper = document.createElement("span");
  wrapper.append(entry.stats.name);
  if (entry.badge) wrapper.append(badgeElement(entry.badge));
  if (entry.isYou) wrapper.append(" (you)");
  return wrapper;
}

function makeButton(content: string | Node, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.append(content);
  button.addEventListener("click", onClick);
  return button;
}

function fillRoleSelect(select: HTMLSelectElement, roles: readonly BadgeRole[]): void {
  select.replaceChildren(
    ...roles.map((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = BADGE_LABELS[role];
      return option;
    })
  );
}

function openLobby(notice = ""): void {
  tournamentSearch?.cancel();
  tournamentSearch = null;
  const profile = loadProfile();
  const badge = myBadge();
  const powers = powersText(myPowerRole());
  playerName.textContent = profile.name;
  playerBadge.replaceChildren(...(badge ? [badgeElement(badge)] : []));
  playerStats.textContent = statsLine(profile);
  playerBio.textContent = profile.bio.length > 0 ? profile.bio.map((phrase) => BIO_PHRASES[phrase]).join(" · ") : "No bio yet.";
  playerPowers.textContent = powers;
  playerPowers.hidden = powers === "";
  lobbyNotice.textContent = notice;
  lobbyNotice.hidden = notice === "";
  creatorBadgeRow.hidden = !iAmCreator();
  creatorBadgeSelect.value = badge ?? "creator";
  const messageCount = inbox().length;
  messagesButton.hidden = messageCount === 0;
  messagesButton.textContent = `📬 Messages (${messageCount})`;
  backToGameButton.hidden = matchKind !== "solo" || match.isOver();
  showOverlay("lobby");
}

function showLeaderboards(notice = ""): void {
  const yourBadge = you();
  const role = myPowerRole();
  // Moderators who can ban get 🚫. Everyone else with a badge gets ⚠️ to report.
  const recordAction: RecordActionKind | null = canBanRecords(role) ? "ban" : canReportRecords(role) ? "report" : null;
  (Object.keys(boardLists) as LeaderboardCategory[]).forEach((category) => {
    // Reports are only shown to moderators.
    const reported = role ? flaggedPlayerIds("report", category) : new Set<string>();
    const rows = leaderboard(category, yourBadge, flaggedPlayerIds("ban", category)).map((entry) => {
      const row = document.createElement("li");
      row.classList.toggle("is-you", entry.isYou);
      const value = document.createElement("strong");
      value.textContent = String(entry.stats[category]);
      row.append(value);
      if (recordAction && !entry.isYou && entry.stats.id !== creatorPlayerId) {
        row.append(recordActionButton(recordAction, entry, category));
      }
      row.append(nameWithBadge(entry));
      if (reported.has(entry.stats.id)) row.append(reportFlag());
      return row;
    });
    boardLists[category].replaceChildren(...rows);
  });
  leaderboardsNotice.textContent = notice;
  leaderboardsNotice.hidden = notice === "";
  moderatorHelp.textContent = recordAction ? RECORD_ACTION_HELP[recordAction] : "";
  moderatorHelp.hidden = recordAction === null;
  showOverlay("leaderboards");
}

// Takes two presses, so a moderator can't ban or report a record by accident.
function recordActionButton(
  kind: RecordActionKind,
  entry: PlayerEntry,
  category: LeaderboardCategory
): HTMLButtonElement {
  const words = RECORD_ACTION_WORDS[kind];
  const record = `${entry.stats.name}'s ${CATEGORY_LABELS[category]} record`;
  let armed = false;
  const button = makeButton(words.icon, "record-action-button", () => {
    if (!armed) {
      armed = true;
      button.textContent = words.confirm;
      return;
    }
    button.disabled = true;
    void actOnRecord(kind, entry.stats.id, category).then((done) => {
      showLeaderboards(done ? `${words.icon} You ${words.done} ${record}.` : `That record couldn't be ${words.done}.`);
    });
  });
  button.title = `${words.verb} ${record}`;
  return button;
}

function reportFlag(): HTMLSpanElement {
  const flag = document.createElement("span");
  flag.className = "report-flag";
  flag.textContent = " ⚠️";
  flag.title = "A moderator reported this record";
  return flag;
}

function openBioEditor(): void {
  renderBioEditor();
  showOverlay("bio");
}

function renderBioEditor(notice = ""): void {
  const chosen = loadProfile().bio;
  bioChoices.replaceChildren(
    ...(Object.keys(BIO_PHRASES) as BioPhrase[]).map((phrase) => {
      const picked = chosen.includes(phrase);
      const button = makeButton(BIO_PHRASES[phrase], picked ? "bio-choice is-chosen" : "bio-choice", () =>
        toggleBioPhrase(phrase)
      );
      button.setAttribute("aria-pressed", String(picked));
      return button;
    })
  );
  bioCount.textContent = notice || `Pick up to ${MAX_BIO_PHRASES}. (${chosen.length}/${MAX_BIO_PHRASES} picked)`;
}

function toggleBioPhrase(phrase: BioPhrase): void {
  const chosen = loadProfile().bio;
  if (chosen.includes(phrase)) {
    setBio(chosen.filter((picked) => picked !== phrase));
    renderBioEditor();
  } else if (chosen.length >= MAX_BIO_PHRASES) {
    renderBioEditor(`You already picked ${MAX_BIO_PHRASES}. Tap one to take it off first.`);
  } else {
    setBio([...chosen, phrase]);
    renderBioEditor();
  }
}

function openSearch(): void {
  searchInput.value = "";
  renderSuggestions();
  showOverlay("search");
  searchInput.focus();
}

function renderSuggestions(): void {
  // A new search clears the last player you looked at, so their card doesn't hang around under the wrong name.
  selectedPlayer = null;
  playerCard.hidden = true;
  const matches = searchPlayers(searchInput.value, you());
  searchSuggestions.replaceChildren(
    ...matches.map((entry) => {
      const item = document.createElement("li");
      item.append(makeButton(nameWithBadge(entry), "suggestion", () => showPlayerCard(entry)));
      return item;
    })
  );
  searchEmpty.hidden = searchInput.value.trim() === "" || matches.length > 0;
}

function showPlayerCard(entry: PlayerEntry): void {
  selectedPlayer = entry;
  playerCardName.replaceChildren(nameWithBadge(entry));
  playerCardRole.textContent = entry.badge ? BADGE_LABELS[entry.badge] : "Player";
  playerCardStats.textContent = statsLine(entry.stats);
  playerCardBio.replaceChildren(
    ...entry.stats.bio.map((phrase) => {
      const line = document.createElement("li");
      line.textContent = BIO_PHRASES[phrase];
      return line;
    })
  );
  playerCardBio.hidden = entry.stats.bio.length === 0;

  const flags: string[] = [];
  const banned = flaggedCategories("ban", entry.stats.id);
  if (banned.length > 0) flags.push(`🚫 Banned records: ${banned.map((c) => CATEGORY_LABELS[c]).join(", ")}`);
  const reported = myPowerRole()
    ? flaggedCategories("report", entry.stats.id).filter((category) => !banned.includes(category))
    : [];
  if (reported.length > 0) flags.push(`⚠️ Reported records: ${reported.map((c) => CATEGORY_LABELS[c]).join(", ")}`);
  playerCardFlags.textContent = flags.join(" · ");
  playerCardFlags.hidden = flags.length === 0;

  // Only players who proved who they are can get invites, since the badge is locked to their key.
  // The Creator already has every badge, so nobody invites them.
  const grantable = grantableRoles(myPowerRole());
  const canInvite = grantable.length > 0 && !entry.isYou && entry.verified && entry.stats.id !== creatorPlayerId;
  inviteControls.hidden = !canInvite;
  if (canInvite) fillRoleSelect(inviteRoleSelect, grantable);
  const pending = pendingInviteFor(entry.stats.id);
  inviteStatus.textContent = pending
    ? `An invite to be ${withArticle(BADGE_LABELS[pending.role])} is waiting to be delivered.`
    : "";
  playerCard.hidden = false;
}

function sendInvite(): void {
  const role = inviteRoleSelect.value;
  if (!selectedPlayer || !isModeratorRole(role) || !grantableRoles(myPowerRole()).includes(role)) return;
  queueInvite(selectedPlayer.stats.id, role);
  inviteStatus.textContent = `Invite saved! ${selectedPlayer.stats.name} will get it the next time you two are matched in a tournament.`;
}

function openMessages(): void {
  renderInbox();
  showOverlay("messages");
}

function renderInbox(notice = ""): void {
  const invites = inbox();
  inboxList.replaceChildren(
    ...invites.map((invite) => {
      const label = BADGE_LABELS[invite.grant.role];
      const inviter = invite.grant.parent ? withArticle(BADGE_LABELS[invite.grant.parent.role]) : "the Creator";
      const item = document.createElement("li");
      const text = document.createElement("p");
      text.append(
        `${invite.grant.parent ? "📨" : "👑"} ${invite.fromName}, ${inviter}, invited you to be ${withArticle(label)} `,
        badgeElement(invite.grant.role),
        ". Do you want to be one?"
      );
      const actions = document.createElement("div");
      actions.className = "invite-actions";
      actions.append(
        makeButton("Yes!", "big-button", () => {
          answerInvite(invite, true);
          renderInbox(`You're now ${withArticle(label)}!`);
        }),
        makeButton("No thanks", "big-button", () => {
          answerInvite(invite, false);
          renderInbox();
        })
      );
      item.append(text, actions);
      return item;
    })
  );
  messagesNotice.textContent = notice;
  messagesNotice.hidden = notice === "";
  inboxEmpty.hidden = invites.length > 0;
}

function startTournamentSearch(): void {
  tournamentStatus.textContent = "Looking for another player...";
  showOverlay("tournament");
  tournamentSearch = findOpponent({
    onStatus: (text) => {
      tournamentStatus.textContent = text;
    },
    onFound: startOnlineMatch,
  });
}

function startOnlineMatch(newLink: MatchLink): void {
  tournamentSearch = null;
  link = newLink;
  matchKind = "tournament";
  opponentClaim = null;
  opponentProof = null;
  sentNonces = [];
  gotMessageDuringMatch = false;
  const localSide: Side = newLink.role === "host" ? "left" : "right";
  const names: Record<Side, string> = { left: "Opponent", right: "Opponent" };
  names[localSide] = loadProfile().name;
  match = new PingPongMatch(ctx, {
    mode: newLink.role,
    localSide,
    names,
    winScore: TOURNAMENT_WIN_SCORE,
    onTeleport: recordTeleport,
    onGameOver: (winner) => handleGameOver(winner === localSide),
  });
  match.gameOverHint = "Click to go back to the lobby";
  lastHeardAt = performance.now();
  sendTimer = 0;
  newLink.onMessage((message) => handleNetMessage(newLink, message, otherSide(localSide)));
  newLink.onClose(() => handleOpponentGone(newLink));
  void sendHello(newLink);
  showOverlay(null);
}

// Each hello carries fresh random letters for the other player to sign, which proves they own their key.
async function sendHello(activeLink: MatchLink): Promise<void> {
  await identityReady;
  if (link !== activeLink) return;
  const nonce = randomNonce();
  sentNonces = [...sentNonces.slice(-2), nonce];
  activeLink.send({
    t: "hello",
    stats: loadProfile(),
    publicKey: myPublicKey(),
    grant: grantToShare(),
    creatorBadge: iAmCreator() ? myBadge() : null,
    nonce,
    bans: recordActionsToShare("ban"),
    reports: recordActionsToShare("report"),
  });
}

function handleNetMessage(fromLink: MatchLink, message: NetMessage, opponentSide: Side): void {
  if (link !== fromLink) return;
  lastHeardAt = performance.now();
  switch (message.t) {
    case "hello": {
      const stats = sanitizeStats(message.stats);
      if (!stats) return;
      match.setName(opponentSide, stats.name);
      opponentClaim = {
        stats,
        publicKey: sanitizePublicKey(message.publicKey),
        grant: message.grant,
        creatorBadge: message.creatorBadge,
      };
      void answerChallenge(fromLink, message.nonce);
      void verifyOpponent(fromLink);
      // Bans and reports carry their own signatures, so they can be checked no matter who passed them along.
      void receiveRecordActions("ban", message.bans);
      void receiveRecordActions("report", message.reports);
      break;
    }
    case "proof":
      opponentProof = message.signature;
      void verifyOpponent(fromLink);
      break;
    case "invite":
      void receiveInvite(fromLink, message.grant);
      break;
    case "paddle":
      if (fromLink.role === "host") match.setRemotePaddle(message.x, message.y, message.power);
      break;
    case "state":
      if (fromLink.role === "guest") match.applySnapshot(message.snapshot);
      break;
    case "bye":
      handleOpponentGone(fromLink);
      break;
  }
}

async function answerChallenge(activeLink: MatchLink, nonce: unknown): Promise<void> {
  await identityReady;
  const signature = await proveNonce(nonce);
  if (signature && link === activeLink) activeLink.send({ t: "proof", signature });
}

async function verifyOpponent(activeLink: MatchLink): Promise<void> {
  await identityReady;
  const claim = opponentClaim;
  const proof = opponentProof;
  if (!claim || link !== activeLink) return;
  if (!claim.publicKey || proof === null || !myFingerprint()) {
    rememberPlayer(claim.stats, null, false);
    return;
  }

  const publicKey = claim.publicKey;
  if ((await fingerprintOf(publicKey)) !== claim.stats.id) return;
  let proven = false;
  for (const nonce of [...sentNonces]) {
    if (await checkProof(publicKey, nonce, proof)) {
      proven = true;
      break;
    }
  }
  if (!proven) return;

  const badge = isCreatorKey(publicKey)
    ? isBadgeRole(claim.creatorBadge)
      ? claim.creatorBadge
      : "creator"
    : ((await verifyGrant(claim.grant, claim.stats.id))?.role ?? null);
  rememberPlayer(claim.stats, badge, true);
  if (grantableRoles(myPowerRole()).length > 0) await deliverInvite(activeLink, claim.stats.id);
}

async function deliverInvite(activeLink: MatchLink, playerId: string): Promise<void> {
  if (link !== activeLink) return;
  const invite = takeInvite(playerId);
  if (!invite) return;
  const grant = await createGrant(playerId, invite.role);
  if (grant && link === activeLink) activeLink.send({ t: "invite", grant });
  else queueInvite(playerId, invite.role);
}

async function receiveInvite(activeLink: MatchLink, grant: unknown): Promise<void> {
  await identityReady;
  const fingerprint = myFingerprint();
  const checked = fingerprint ? await verifyGrant(grant, fingerprint) : null;
  if (!checked) return;
  addToInbox({ grant: checked, fromName: opponentClaim?.stats.name ?? "A moderator" });
  if (link !== activeLink) return;
  if (match.isOver()) match.gameOverNote = [match.gameOverNote, MESSAGE_NOTE].filter(Boolean).join("  ");
  else gotMessageDuringMatch = true;
}

function handleOpponentGone(goneLink: MatchLink): void {
  if (link !== goneLink) return;
  const finished = match.isOver();
  leaveOnlineMatch(false);
  // After the match is over, stay on the results until they click.
  if (!finished) returnToLobby("Your opponent left the match.");
}

function leaveOnlineMatch(sayBye: boolean): void {
  if (!link) return;
  const closing = link;
  link = null;
  if (sayBye) closing.send({ t: "bye" });
  // Give the goodbye a moment to go out before hanging up.
  window.setTimeout(() => closing.close(), sayBye ? 200 : 0);
  refreshCornerButtons();
}

function returnToLobby(notice = ""): void {
  leaveOnlineMatch(true);
  matchKind = "solo";
  match = createSoloMatch();
  openLobby(notice);
}

function syncOnlineMatch(activeLink: MatchLink, dt: number, now: number): void {
  sendTimer -= dt;
  if (sendTimer <= 0) {
    sendTimer = SEND_INTERVAL_SECONDS;
    if (activeLink.role === "host") {
      activeLink.send({ t: "state", snapshot: match.takeSnapshot() });
    } else {
      const paddle = match.getLocalPaddle();
      activeLink.send({ t: "paddle", x: paddle.x, y: paddle.y, power: paddle.power });
    }
  }
  if (now - lastHeardAt > OPPONENT_TIMEOUT_MS) handleOpponentGone(activeLink);
}

function toCanvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

fillRoleSelect(creatorBadgeSelect, BADGE_ROLES);

window.addEventListener("pointermove", (event) => {
  const point = toCanvasPoint(event);
  match.setLocalPointer(point.x, point.y);
});
canvas.addEventListener("pointerdown", (event) => {
  const point = toCanvasPoint(event);
  match.setLocalPointer(point.x, point.y);
  if (!match.isOver()) return;
  if (matchKind === "tournament") returnToLobby();
  else startSoloGame();
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (openOverlay === "pause") showOverlay(null);
  else if (openOverlay === null && !pauseButton.hidden) showOverlay("pause");
});

pauseButton.addEventListener("click", () => showOverlay("pause"));
leaveButton.addEventListener("click", () => returnToLobby("You left the match."));
element("resume-button", HTMLButtonElement).addEventListener("click", () => showOverlay(null));
element("lobby-button", HTMLButtonElement).addEventListener("click", () => openLobby());
backToGameButton.addEventListener("click", () => showOverlay(null));
element("rename-button", HTMLButtonElement).addEventListener("click", () => {
  renameProfile();
  openLobby();
});
creatorBadgeSelect.addEventListener("change", () => {
  if (isBadgeRole(creatorBadgeSelect.value)) setCreatorBadge(creatorBadgeSelect.value);
  openLobby();
});
messagesButton.addEventListener("click", openMessages);
element("play-cpu-button", HTMLButtonElement).addEventListener("click", startSoloGame);
element("tournament-button", HTMLButtonElement).addEventListener("click", startTournamentSearch);
element("leaderboards-button", HTMLButtonElement).addEventListener("click", () => showLeaderboards());
element("search-button", HTMLButtonElement).addEventListener("click", openSearch);
element("edit-bio-button", HTMLButtonElement).addEventListener("click", openBioEditor);
element("bio-done-button", HTMLButtonElement).addEventListener("click", () => openLobby());
element("cancel-tournament-button", HTMLButtonElement).addEventListener("click", () => openLobby());
element("leaderboards-back-button", HTMLButtonElement).addEventListener("click", () => openLobby());
element("search-back-button", HTMLButtonElement).addEventListener("click", () => openLobby());
element("messages-back-button", HTMLButtonElement).addEventListener("click", () => openLobby());
element("send-invite-button", HTMLButtonElement).addEventListener("click", sendInvite);
searchInput.addEventListener("input", renderSuggestions);
searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const firstMatch = searchPlayers(searchInput.value, you())[0];
  if (firstMatch) showPlayerCard(firstMatch);
});

let lastFrameTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  // You can't pause someone else's game, so tournament matches always keep going.
  if (openOverlay === null || link) match.update(dt);
  match.draw();
  if (link) syncOnlineMatch(link, dt, now);
  requestAnimationFrame(frame);
}

refreshCornerButtons();
requestAnimationFrame(frame);
