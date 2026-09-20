import { Peer, type DataConnection } from "peerjs";

export type Handler = (from: string, body: unknown) => void;

export interface Link {
  send(to: string, body: unknown): void;
  close(): void;
}

interface Options {
  roomName: string;
  onMessage: Handler;
  onStatus: (text: string) => void;
  onReady?: () => void;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
}

// The room name doubles as the address, so joining means typing the name the
// host said out loud. Everyone has to land on the same id for that to work.
export function roomPeerId(roomName: string): string {
  const slug = roomName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `draw-and-swap-${slug || "room"}`;
}

interface Envelope {
  to: string;
  from: string;
  body: unknown;
}

function openChannel(id: string, self: string, onMessage: Handler): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(id);
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const envelope = event.data as Partial<Envelope> | null;
    if (!envelope || typeof envelope.from !== "string" || envelope.from === self) return;
    if (envelope.to !== self && envelope.to !== "*") return;
    onMessage(envelope.from, envelope.body);
  });
  return channel;
}

// Two pipes at once: PeerJS reaches other computers, the BroadcastChannel
// reaches other tabs on this one. Drawings are big, so guests always answer
// down whichever pipe their first message came in on.
export function openHost({ roomName, onMessage, onStatus, onReady, onLeave }: Options): Link {
  const hostId = roomPeerId(roomName);
  const connections = new Map<string, DataConnection>();
  const channel = openChannel(hostId, hostId, onMessage);

  const peer = new Peer(hostId);
  peer.on("open", () => {
    onStatus(`Room is open. Others join by typing "${roomName}".`);
    onReady?.();
  });
  peer.on("connection", (connection) => {
    connections.set(connection.peer, connection);
    connection.on("data", (data) => onMessage(connection.peer, data));
    connection.on("close", () => {
      connections.delete(connection.peer);
      onLeave?.(connection.peer);
    });
  });
  peer.on("error", (error) => {
    onStatus(
      error.type === "unavailable-id"
        ? "Somebody already has a room with that name. Pick a different one."
        : "Can't reach the internet, so only this computer can join."
    );
    onReady?.();
  });

  return {
    send(to, body) {
      if (to === "*") {
        for (const connection of connections.values()) connection.send(body);
        channel?.postMessage({ to: "*", from: hostId, body } satisfies Envelope);
        return;
      }
      const connection = connections.get(to);
      if (connection) connection.send(body);
      else channel?.postMessage({ to, from: hostId, body } satisfies Envelope);
    },
    close() {
      channel?.close();
      peer.destroy();
    },
  };
}

export function openGuest({ roomName, onMessage, onStatus, onReady }: Options): Link {
  const hostId = roomPeerId(roomName);
  const selfId = `artist-${Math.random().toString(36).slice(2, 10)}`;
  const channel = openChannel(hostId, selfId, onMessage);
  let connection: DataConnection | null = null;
  // Whichever pipe the first message goes down is the one the host knows this
  // player by, so every later message has to take the same route.
  let pinned: "peer" | "channel" | null = null;
  let ready = false;

  const announceReady = (): void => {
    if (ready) return;
    ready = true;
    onReady?.();
  };

  const peer = new Peer();
  peer.on("open", () => {
    const attempt = peer.connect(hostId, { reliable: true });
    connection = attempt;
    attempt.on("open", () => {
      onStatus("Connected to the room.");
      announceReady();
    });
    attempt.on("data", (data) => onMessage(hostId, data));
    attempt.on("close", () => onStatus("The room closed."));
  });
  peer.on("error", () => {
    onStatus("No room by that name online. If they're on this computer, this still works.");
    announceReady();
  });
  // Same-computer play never opens a peer connection, so don't wait forever.
  window.setTimeout(announceReady, 2500);

  return {
    send(_to, body) {
      const usePeer = pinned ? pinned === "peer" : Boolean(connection?.open);
      pinned = usePeer ? "peer" : "channel";
      if (usePeer && connection) connection.send(body);
      else channel?.postMessage({ to: hostId, from: selfId, body } satisfies Envelope);
    },
    close() {
      channel?.close();
      peer.destroy();
    },
  };
}
