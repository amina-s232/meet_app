import { prisma } from "@/lib/prisma";

/** Look a meeting up by its database id OR its public code (e.g. "abc-defg-hij"). */
export async function findMeeting(idOrCode: string) {
  return prisma.meeting.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
  });
}

/** Shared type for dynamic route context (Next.js 15+: params is a Promise). */
export type MeetingRouteContext = { params: Promise<{ id: string }> };

/** Meeting as shown on the dashboard (dates are ISO strings so they can cross the server/client boundary). */
export type MeetingItem = {
  id: string;
  code: string;
  title: string | null;
  createdAt: string;
  endedAt: string | null;
};