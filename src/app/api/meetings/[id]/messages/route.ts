import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitToMeeting } from "@/lib/socket";
import { findMeeting, type MeetingRouteContext } from "@/lib/meeting";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const postSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000),
  participantId: z.string().min(1).optional(),
});

// GET /api/meetings/[id]/messages?limit=50&cursor=<messageId>
// Returns messages oldest → newest. Use nextCursor to load older ones.
export async function GET(req: Request, { params }: MeetingRouteContext) {
  try {
    const { id } = await params;
    const meeting = await findMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { limit, cursor } = parsed.data;

    const rows = await prisma.message.findMany({
      where: { meetingId: meeting.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        senderName: true,
        content: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({
      messages: page.reverse(), // oldest → newest
      nextCursor,
    });
  } catch (err) {
    console.error("Get messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/meetings/[id]/messages - send a chat message
// Sender must currently be in the meeting (participant with leftAt = null)
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

    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { content, participantId } = parsed.data;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Identify the sender: either logged-in user or guest participant
    let who: { userId: string } | { id: string };
    if (userId) {
      who = { userId };
    } else if (participantId) {
      who = { id: participantId };
    } else {
      return NextResponse.json(
        { error: "participantId is required when not signed in" },
        { status: 400 }
      );
    }

    // Sender must currently be in the meeting
    const participant = await prisma.participant.findFirst({
      where: {
        meetingId: meeting.id,
        leftAt: null,
        ...who,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Join the meeting before sending messages" },
        { status: 403 }
      );
    }

    const senderName =
      participant.user?.name ?? participant.guestName ?? "Guest";

    const message = await prisma.message.create({
      data: {
        meetingId: meeting.id,
        userId: participant.userId,
        senderName,
        content,
      },
      select: {
        id: true,
        userId: true,
        senderName: true,
        content: true,
        createdAt: true,
      },
    });

    // Real-time push to everyone in the meeting room
    emitToMeeting(meeting.code, "new-message", {
      id: message.id,
      content: message.content,
      userId: message.userId,
      userName: message.senderName,
      createdAt: message.createdAt.toISOString(),
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("Send message error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}