import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findMeeting, type MeetingRouteContext } from "@/lib/meeting";

const joinSchema = z.object({
  guestName: z.string().trim().min(1).max(50).optional(),
});

// POST /api/meetings/[id]/join - record a join (signed-in user or guest)
export async function POST(req: Request, { params }: MeetingRouteContext) {
  try {
    const { id } = await params;
    const meeting = await findMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.endedAt) {
      return NextResponse.json({ error: "Meeting has ended" }, { status: 410 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;
    const { guestName } = parsed.data;

    if (!userId && !guestName) {
      return NextResponse.json(
        { error: "guestName is required when not signed in" },
        { status: 400 }
      );
    }

    // Signed-in users: joining twice just returns the existing record
    if (userId) {
      const existing = await prisma.participant.findFirst({
        where: { meetingId: meeting.id, userId, leftAt: null },
      });
      if (existing) {
        return NextResponse.json({ participant: existing, alreadyJoined: true });
      }
    }

    const participant = await prisma.participant.create({
      data: {
        meetingId: meeting.id,
        userId,
        guestName: userId ? null : guestName,
      },
    });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (err) {
    console.error("Join meeting error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
