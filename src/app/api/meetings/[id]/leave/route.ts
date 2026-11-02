import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findMeeting, type MeetingRouteContext } from "@/lib/meeting";

const leaveSchema = z.object({
  participantId: z.string().min(1).optional(),
});

// POST /api/meetings/[id]/leave - record a leave
export async function POST(req: Request, { params }: MeetingRouteContext) {
  try {
    const { id } = await params;
    const meeting = await findMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = leaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const { participantId } = parsed.data;

    // Signed-in users are matched by user id, guests by the participantId returned from /join
    let who: { userId: string } | { id: string };
    if (userId) who = { userId };
    else if (participantId) who = { id: participantId };
    else {
      return NextResponse.json(
        { error: "participantId is required when not signed in" },
        { status: 400 }
      );
    }

    const result = await prisma.participant.updateMany({
      where: { meetingId: meeting.id, leftAt: null, ...who },
      data: { leftAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "No active participation found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ left: true, count: result.count });
  } catch (err) {
    console.error("Leave meeting error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
