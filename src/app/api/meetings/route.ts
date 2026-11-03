import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateMeetingCode,
  getSessionUserId,
  meetingInclude,
  toMeetingDto,
} from "@/lib/meetings";

const createSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
});

const statusSchema = z.enum(["active", "ended"]).optional();

// POST /api/meetings: create a meeting (auth required)
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Retry in the unlikely case the random code already exists
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const meeting = await prisma.meeting.create({
          data: {
            code: generateMeetingCode(),
            title: parsed.data.title ?? null,
            hostId: userId,
          },
          include: meetingInclude,
        });
        return NextResponse.json({ meeting: toMeetingDto(meeting, userId) }, { status: 201 });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }

    return NextResponse.json({ error: "Could not generate a unique code" }, { status: 500 });
  } catch (err) {
    console.error("Create meeting error:", err instanceof Error ? err.name : "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/meetings?status=active|ended: list my meetings (auth required)
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = statusSchema.safeParse(searchParams.get("status") ?? undefined);
    if (!status.success) {
      return NextResponse.json(
        { error: "status must be 'active' or 'ended'" },
        { status: 400 }
      );
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        hostId: userId,
        ...(status.data === "active" && { endedAt: null }),
        ...(status.data === "ended" && { endedAt: { not: null } }),
      },
      include: meetingInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ meetings: meetings.map((m) => toMeetingDto(m, userId)) });
  } catch (err) {
    console.error("List meetings error:", err instanceof Error ? err.name : "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
