import { customAlphabet } from "nanoid";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const randomLetters = customAlphabet("abcdefghijklmnopqrstuvwxyz", 10);

// Google Meet style code: abc-defg-hij
export function generateMeetingCode() {
  const raw = randomLetters();
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
}

export const meetingInclude = {
  host: { select: { name: true, image: true } },
} satisfies Prisma.MeetingInclude;

export type MeetingWithHost = Prisma.MeetingGetPayload<{
  include: typeof meetingInclude;
}>;

// Find by database ID or by room code
export function findMeeting(idOrCode: string) {
  return prisma.meeting.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode.toLowerCase() }] },
    include: meetingInclude,
  });
}

// Shape returned to clients (never exposes the host's email or internal host id)
export function toMeetingDto(m: MeetingWithHost, userId?: string | null) {
  return {
    id: m.id,
    code: m.code,
    title: m.title,
    createdAt: m.createdAt,
    endedAt: m.endedAt,
    isActive: m.endedAt === null,
    host: { name: m.host.name, image: m.host.image },
    isHost: userId ? m.hostId === userId : false,
  };
}

export async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}