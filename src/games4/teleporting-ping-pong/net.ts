import { Peer, type DataConnection } from "peerjs";
import type { MatchSnapshot } from "./game";
import type { BadgeRole, Grant, PublicKeyParts, RecordAction } from "./identity";
import type { PlayerStats } from "./stats";

// Everyone looking for a tournament match tries to grab this one address. Whoever gets it
// waits there. The next player finds it taken, so they knock and leave their own address.
const QUEUE_ID = "teleporting-ping-pong-tournament-queue";
// If a knock doesn't turn into a match by then, the other player probably got someone else.
const RETRY_MS = 6000;

// Everything here comes from another player's computer, so check it before trusting it.
export type NetMessage =
  | {
      t: "hello";
      stats: PlayerStats;
      publicKey: PublicKeyParts | null;
      grant: Grant | null;
      creatorBadge: BadgeRole | null;
      nonce: string;
      bans: RecordAction[];
      reports: RecordAction[];
    }
  | { t: "proof"; signature: string }
  | { t: "invite"; grant: Grant }
  | { t: "paddle"; x: number; y: number; power: number }
  | { t: "state"; snapshot: MatchSnapshot }
  | { t: "bye" };

export interface MatchLink {
  role: "host" | "guest";
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): void;
  onClose(handler: () => void): void;
  close(): void;
}

interface SearchOptions {
  onStatus: (text: string) => void;
  onFound: (link: MatchLink) => void;
}

export function findOpponent({ onStatus, onFound }: SearchOptions): { cancel(): void } {
  const me = new Peer();
  let waitingRoom: Peer | null = null;
  let retryTimer = 0;
  let done = false;

  const showOffline = (): void =>
    onStatus("Can't reach the tournament. Check that the internet is working, then try again.");

  const leaveWaitingRoom = (): void => {
    waitingRoom?.destroy();
    waitingRoom = null;
    window.clearTimeout(retryTimer);
  };

  const retrySoon = (): void => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      if (!done) claimWaitingRoom();
    }, RETRY_MS);
  };

  const matched = (connection: DataConnection, role: MatchLink["role"]): void => {
    if (done) {
      connection.close();
      return;
    }
    done = true;
    leaveWaitingRoom();
    onFound(makeLink(me, connection, role));
  };

  const claimWaitingRoom = (): void => {
    leaveWaitingRoom();
    onStatus("Looking for another player...");
    const room = new Peer(QUEUE_ID);
    waitingRoom = room;

    room.on("open", () => onStatus("Waiting for another player to join the tournament..."));
    room.on("connection", (knock) => {
      knock.on("data", (data) => {
        const peerId = (data as { t?: unknown; peerId?: unknown } | null)?.peerId;
        if (done || waitingRoom !== room || typeof peerId !== "string") return;
        leaveWaitingRoom();
        onStatus("Found another player! Connecting...");
        const connection = me.connect(peerId, { reliable: true });
        connection.on("open", () => matched(connection, "host"));
        retrySoon();
      });
    });
    room.on("error", (error) => {
      if (waitingRoom !== room) return;
      if (error.type !== "unavailable-id") {
        showOffline();
        return;
      }
      // Someone is already waiting, so knock on their door with our own address.
      leaveWaitingRoom();
      onStatus("Found another player! Connecting...");
      const knock = me.connect(QUEUE_ID, { reliable: true });
      knock.on("open", () => knock.send({ t: "join", peerId: me.id }));
      retrySoon();
    });
  };

  me.on("open", claimWaitingRoom);
  me.on("connection", (connection) => {
    connection.on("open", () => matched(connection, "guest"));
  });
  me.on("error", (error) => {
    // Knocking on a player who already left is expected; the retry takes care of it.
    if (error.type === "peer-unavailable" || done) return;
    showOffline();
  });

  return {
    cancel() {
      if (done) return;
      done = true;
      leaveWaitingRoom();
      me.destroy();
    },
  };
}

function makeLink(peer: Peer, connection: DataConnection, role: MatchLink["role"]): MatchLink {
  const messageHandlers: ((message: NetMessage) => void)[] = [];
  const closeHandlers: (() => void)[] = [];
  let closed = false;

  connection.on("data", (data) => {
    if (closed || !data || typeof data !== "object" || typeof (data as { t?: unknown }).t !== "string") return;
    messageHandlers.forEach((handler) => handler(data as NetMessage));
  });
  const handleClose = (): void => {
    if (closed) return;
    closed = true;
    closeHandlers.forEach((handler) => handler());
  };
  connection.on("close", handleClose);
  connection.on("error", handleClose);

  return {
    role,
    send(message) {
      if (!closed && connection.open) connection.send(message);
    },
    onMessage(handler) {
      messageHandlers.push(handler);
    },
    onClose(handler) {
      closeHandlers.push(handler);
    },
    close() {
      closed = true;
      connection.close();
      peer.destroy();
    },
  };
}
