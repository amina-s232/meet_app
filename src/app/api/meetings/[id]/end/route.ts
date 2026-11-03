import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findMeeting,
  getSessionUserId,
  meetingInclude,
  toMeetingDto,
} from "@/lib/meetings";
import { endMeetingRoom } from "@/lib/socket";

type Ctx = { params: Promise<{ id: string }> };

async function endMeeting(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meeting = await findMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.hostId !== userId) {
      return NextResponse.json({ error: "Only the host can end this meeting" }, { status: 403 });
    }
    if (meeting.endedAt) {
      return NextResponse.json({ error: "Meeting has already ended" }, { status: 409 });
    }

    const ended = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { endedAt: new Date() },
      include: meetingInclude,
    });

    // Notify everyone currently in the room and close the room state
    await endMeetingRoom(ended.code);

    return NextResponse.json({ meeting: toMeetingDto(ended, userId) });
  } catch (err) {
    console.error("End meeting error:", err instanceof Error ? err.name : "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export { endMeeting as POST, endMeeting as DELETE };
