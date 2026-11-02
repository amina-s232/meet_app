import type { Server } from "socket.io";

// server.js / socket-handlers.js put these on globalThis so API routes can reach the socket server.
const g = globalThis as unknown as {
  io?: Server;
  __endMeetingRoom?: (code: string) => Promise<void>;
};

/** Room name used by socket-handlers.js for a meeting. Keep both in sync. */
export const meetingRoom = (code: string) => `meeting:${code}`;

export function getIO(): Server | undefined {
  return g.io;
}

/** Emit an event to everyone currently in a meeting (no-op if the socket server isn't running). */
export function emitToMeeting(code: string, event: string, payload: unknown) {
  g.io?.to(meetingRoom(code)).emit(event, payload);
}

/** Tell everyone in the meeting it has ended (`meeting-ended`) and remove them from the room. */
export async function endMeetingRoom(code: string) {
  await g.__endMeetingRoom?.(code);
}
