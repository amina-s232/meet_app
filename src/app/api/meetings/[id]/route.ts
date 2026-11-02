import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  findMeeting,
  getSessionUserId,
  meetingInclude,
  toMeetingDto,
} from "@/lib/meetings";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().trim().max(100).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  });

// GET /api/meetings/:idOrCode: public, so guests can look up by room code
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const userId = await getSessionUserId(); // null for guests

    const meeting = await findMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({ meeting: toMeetingDto(meeting, userId) });
  } catch (err) {
    console.error("Get meeting error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/meetings/:id: host only
export async function PATCH(req: Request, { params }: Ctx) {
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
      return NextResponse.json({ error: "Only the host can update this meeting" }, { status: 403 });
    }
    if (meeting.endedAt) {
      return NextResponse.json({ error: "Meeting has already ended" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { title: parsed.data.title || null }, // empty string clears the title
      include: meetingInclude,
    });

    return NextResponse.json({ meeting: toMeetingDto(updated, userId) });
  } catch (err) {
    console.error("Update meeting error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
