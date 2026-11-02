import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/dashboard/DashboardClient";
import type { MeetingItem } from "@/lib/meeting";

export const metadata = { title: "Dashboard · Meet" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const rows = await prisma.meeting.findMany({
    where: { hostId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, title: true, createdAt: true, endedAt: true },
  });

  const meetings: MeetingItem[] = rows.map((m) => ({
    id: m.id,
    code: m.code,
    title: m.title,
    createdAt: m.createdAt.toISOString(),
    endedAt: m.endedAt ? m.endedAt.toISOString() : null,
  }));

  return (
    <DashboardClient
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      initialMeetings={meetings}
    />
  );
}