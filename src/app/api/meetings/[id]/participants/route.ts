import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMeeting, type MeetingRouteContext } from "@/lib/meeting";

// GET /api/meetings/[id]/participants - who is in the meeting right now
export async function GET(_req: Request, { params }: MeetingRouteContext) {
  try {
    const { id } = await params;
    const meeting = await findMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const rows = await prisma.participant.findMany({
      where: { meetingId: meeting.id, leftAt: null },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { name: true, image: true } } },
    });

    const participants = rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Guest",
      image: p.user?.image ?? null,
      isGuest: !p.userId,
      joinedAt: p.joinedAt,
    }));

    return NextResponse.json({
      meetingId: meeting.id,
      count: participants.length,
      participants,
    });
  } catch (err) {
    console.error("Get participants error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
