// Security notice: User credentials, tokens, cookies, and message contents must never be logged.

import { z } from "zod";
import nextAuthJwt from "next-auth/jwt";

const { getToken } = nextAuthJwt;

// Must match meetingRoom() in src/lib/socket.ts
const roomName = (code) => `meeting:${code}`;

// ---------- payload schemas (client -> server) ----------
const code = z.string().trim().min(1, "meetingCode is required").max(64);
const sdpOrCandidate = z.record(z.string(), z.unknown());

const schemas = {
  "join-meeting": z.object({
    meetingCode: code,
    userId: z.string().optional(), // accepted for compatibility; the server uses the verified session instead
    userName: z.string().trim().min(1, "userName is required").max(50),
    isGuest: z.boolean().optional(), // ignored; the server decides from the session
  }),
  offer: z.object({ to: z.string().min(1), offer: sdpOrCandidate, meetingCode: code }),
  answer: z.object({ to: z.string().min(1), answer: sdpOrCandidate }),
  "ice-candidate": z.object({ to: z.string().min(1), candidate: sdpOrCandidate }),
  "send-message": z.object({
    meetingCode: code,
    content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message too long"),
    userId: z.string().optional(), // ignored
    userName: z.string().optional(), // ignored
  }),
  "media-state": z.object({ meetingCode: code, audio: z.boolean(), video: z.boolean() }),
  "toggle-audio": z.object({ meetingCode: code, enabled: z.boolean() }),
  "toggle-video": z.object({ meetingCode: code, enabled: z.boolean() }),
};

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function withTimeout(promise, ms, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      if (timer.unref) timer.unref();
    }),
  ]);
}

function sanitizeExtra(extra) {
  if (!extra || typeof extra !== "object") return undefined;
  const safe = {};
  if (typeof extra.room === "string") safe.room = extra.room;
  if (typeof extra.count === "number") safe.count = extra.count;
  if (typeof extra.to === "string") safe.to = extra.to;
  if (typeof extra.meetingCode === "string") safe.meetingCode = extra.meetingCode;
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function logSocket(event, socketId, outcome, extra) {
  if (process.env.DEBUG_SOCKET === "1") {
    const safe = sanitizeExtra(extra);
    if (safe !== undefined) {
      console.log(`[socket] ${event} socket=${socketId} outcome=${outcome}`, safe);
    } else {
      console.log(`[socket] ${event} socket=${socketId} outcome=${outcome}`);
    }
  }
}

export function registerSocketHandlers(io, prisma) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.warn("[socket] NEXTAUTH_SECRET is not set: every socket will be treated as a guest");
  }

  // Identify the user from the NextAuth session cookie sent with the handshake.
  // Guests (no cookie) are allowed through with auth = null.
  io.use(async (socket, next) => {
    socket.data.auth = null;
    socket.data.meeting = null;
    try {
      const headers = socket.request.headers;
      const tokenPromise = getToken({
        req: { headers, cookies: parseCookies(headers.cookie) },
        secret: process.env.NEXTAUTH_SECRET,
      });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
      const token = await Promise.race([tokenPromise, timeoutPromise]);
      const userId = token?.id ?? token?.sub;
      if (userId) socket.data.auth = { userId, userName: token.name ?? null };
    } catch {
      /* invalid or missing session -> guest */
    } finally {
      next();
    }
  });

  const toPublicParticipant = (socketId, m) => ({
    socketId,
    participantId: m.participantId,
    userId: m.userId,
    name: m.name || m.userName,
    isGuest: m.isGuest,
    isHost: m.isHost,
    audio: m.audio,
    video: m.video,
    joinedAt: m.joinedAt,
  });

  async function getParticipants(room) {
    const sockets = await io.in(room).fetchSockets();
    return sockets
      .filter((s) => s.data.meeting)
      .map((s) => toPublicParticipant(s.id, s.data.meeting));
  }

  // Remove a socket from its meeting and close the participant record when nobody else uses it.
  async function leaveMeeting(socket) {
    const m = socket.data.meeting;
    if (!m) return;
    socket.data.meeting = null;

    const room = roomName(m.code);
    socket.to(room).emit("user-left", { socketId: socket.id, name: m.name || m.userName, userName: m.userName });
    await socket.leave(room);

    const remainingParticipants = await getParticipants(room);
    socket.to(room).emit("participants-updated", remainingParticipants);

    logSocket("leave-meeting", socket.id, "success", { room });

    // A signed-in user with two tabs shares one participant row: only close it with the last tab.
    const remaining = await io.in(room).fetchSockets();
    const stillPresent = remaining.some((s) => s.data.meeting?.participantId === m.participantId);
    if (!stillPresent) {
      try {
        await withTimeout(
          prisma.participant.updateMany({
            where: { id: m.participantId, leftAt: null },
            data: { leftAt: new Date() },
          }),
          8000,
          "Database timeout updating participant leftAt"
        );
      } catch (err) {
        console.error("[socket] update participant leftAt failed:", err instanceof Error ? err.name : "Error");
      }
    }
  }

  async function endMeetingRoom(code) {
    const room = roomName(code);
    io.to(room).emit("meeting-ended", { meetingCode: code });
    for (const id of [...(io.sockets.adapter.rooms.get(room) ?? [])]) {
      const target = io.sockets.sockets.get(id);
      if (!target) continue;
      target.data.meeting = null;
      target.leave(room);
    }
  }
  globalThis.__endMeetingRoom = endMeetingRoom;

  io.on("connection", (socket) => {
    const fail = (event, message) => {
      logSocket(event, socket.id, "error", message);
      socket.emit("error", { event, message });
    };

    // Registers a validated, error-safe handler for one event.
    const on = (event, handler) => {
      socket.on(event, async (payload) => {
        try {
          let data;
          const schema = schemas[event];
          if (schema) {
            const result = schema.safeParse(payload);
            if (!result.success) {
              const issue = result.error.issues[0];
              const field = issue?.path?.join(".");
              return fail(event, issue ? (field ? `${field}: ${issue.message}` : issue.message) : "Invalid payload");
            }
            data = result.data;
          }
          await handler(data);
        } catch (err) {
          console.error(`[socket] ${event} failed:`, err instanceof Error ? err.name : "Error");
          fail(event, "Internal server error");
        }
      });
    };

    // Returns the caller's meeting state, or reports an error.
    const requireMeeting = (event, meetingCode) => {
      const m = socket.data.meeting;
      if (!m) {
        fail(event, "Join a meeting first");
        return null;
      }
      if (meetingCode !== undefined && meetingCode !== m.code) {
        fail(event, "meetingCode does not match the meeting you joined");
        return null;
      }
      return m;
    };

    const inSameRoom = (m, socketId) =>
      io.sockets.adapter.rooms.get(roomName(m.code))?.has(socketId) === true;

    // ---------- join / leave ----------
    on("join-meeting", async ({ meetingCode, userName }) => {
      logSocket("join-meeting", socket.id, "received", { meetingCode });

      // Idempotent: a repeated join (e.g. React StrictMode) just re-sends the state
      if (socket.data.meeting?.code === meetingCode) {
        const room = roomName(meetingCode);
        const list = await getParticipants(room);
        logSocket("join-meeting", socket.id, "idempotent-replay", { count: list.length });
        return socket.emit("participants-list", list);
      }
      if (socket.data.joining) return;
      socket.data.joining = true;

      try {
        if (socket.data.meeting) await leaveMeeting(socket); // switching meetings

        const meeting = await withTimeout(
          prisma.meeting.findUnique({ where: { code: meetingCode } }),
          8000,
          "Database timeout looking up meeting"
        );
        if (!meeting) return fail("join-meeting", "Meeting not found");
        if (meeting.endedAt) return fail("join-meeting", "Meeting has ended");

        // Verified identity wins over anything the client claims
        const auth = socket.data.auth;
        const userId = auth?.userId ?? null;
        const displayName = auth?.userName || userName;

        let participant = userId
          ? await withTimeout(
              prisma.participant.findFirst({
                where: { meetingId: meeting.id, userId, leftAt: null },
              }),
              8000,
              "Database timeout looking up participant"
            )
          : null;
        if (!participant) {
          participant = await withTimeout(
            prisma.participant.create({
              data: {
                meetingId: meeting.id,
                userId,
                guestName: userId ? null : displayName,
              },
            }),
            8000,
            "Database timeout creating participant"
          );
        }

        const room = roomName(meeting.code);
        const isHost = Boolean(userId && userId === meeting.hostId);
        socket.data.meeting = {
          code: meeting.code,
          id: meeting.id,
          participantId: participant.id,
          userId,
          userName: displayName,
          name: displayName,
          isGuest: !userId,
          isHost,
          audio: true,
          video: true,
          joinedAt: participant.joinedAt ? participant.joinedAt.toISOString() : new Date().toISOString(),
        };
        await socket.join(room);

        const allParticipants = await getParticipants(room);

        // Tell the newcomer the full list of participants (including self)
        socket.emit("participants-list", allParticipants);

        // Tell everyone else about the newcomer and send updated participants list
        socket.to(room).emit("participants-updated", allParticipants);
        socket.to(room).emit("user-joined", {
          name: displayName,
          socketId: socket.id,
        });

        logSocket("join-meeting", socket.id, "success", { count: allParticipants.length });
      } catch (err) {
        console.error("[socket] join-meeting failed:", err instanceof Error ? err.name : "Error");
        const message = err instanceof Error && err.message.includes("Database timeout")
          ? "Database timed out. Please try again."
          : "Internal server error";
        fail("join-meeting", message);
      } finally {
        socket.data.joining = false;
      }
    });

    on("leave-meeting", async () => {
      await leaveMeeting(socket);
    });

    // ---------- WebRTC signaling ----------
    on("offer", ({ to, offer, meetingCode }) => {
      const m = requireMeeting("offer", meetingCode);
      if (!m) return;
      if (!inSameRoom(m, to)) return fail("offer", "Target is not in this meeting");
      io.to(to).emit("offer", { from: socket.id, userName: m.userName, offer });
      logSocket("offer", socket.id, "relayed", { to });
    });

    on("answer", ({ to, answer }) => {
      const m = requireMeeting("answer");
      if (!m) return;
      if (!inSameRoom(m, to)) return fail("answer", "Target is not in this meeting");
      io.to(to).emit("answer", { from: socket.id, answer });
      logSocket("answer", socket.id, "relayed", { to });
    });

    on("ice-candidate", ({ to, candidate }) => {
      const m = requireMeeting("ice-candidate");
      if (!m) return;
      if (!inSameRoom(m, to)) return fail("ice-candidate", "Target is not in this meeting");
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
      logSocket("ice-candidate", socket.id, "relayed", { to });
    });

    // ---------- chat ----------
    on("send-message", async ({ meetingCode, content }) => {
      const m = requireMeeting("send-message", meetingCode);
      if (!m) return;

      const saved = await prisma.message.create({
        data: { meetingId: m.id, userId: m.userId, senderName: m.userName, content },
      });

      io.to(roomName(m.code)).emit("new-message", {
        id: saved.id,
        content: saved.content,
        userId: m.userId,
        userName: m.userName,
        createdAt: saved.createdAt.toISOString(),
      });
      logSocket("send-message", socket.id, "success");
    });

    // ---------- media state ----------
    const updateMedia = (event, meetingCode, patch) => {
      const m = requireMeeting(event, meetingCode);
      if (!m) return;
      Object.assign(m, patch);
      socket.to(roomName(m.code)).emit("media-state-updated", {
        socketId: socket.id,
        userName: m.userName,
        audio: m.audio,
        video: m.video,
      });
      logSocket(event, socket.id, "success", patch);
    };

    on("media-state", ({ meetingCode, audio, video }) =>
      updateMedia("media-state", meetingCode, { audio, video })
    );
    on("toggle-audio", ({ meetingCode, enabled }) =>
      updateMedia("toggle-audio", meetingCode, { audio: enabled })
    );
    on("toggle-video", ({ meetingCode, enabled }) =>
      updateMedia("toggle-video", meetingCode, { video: enabled })
    );

    // Tab closed / network lost: behave like leave-meeting
    socket.on("disconnecting", () => {
      leaveMeeting(socket).catch((err) => console.error("[socket] leave on disconnect failed:", err instanceof Error ? err.name : "Error"));
    });
  });
}
