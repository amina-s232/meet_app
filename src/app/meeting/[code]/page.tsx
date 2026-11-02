import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MeetingRoom from "@/components/meeting/MeetingRoom";

type Props = { params: Promise<{ code: string }> };

export const metadata = { title: "Meeting · Meet" };

export default async function MeetingPage({ params }: Props) {
  const { code } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { code: decodeURIComponent(code).toLowerCase() },
    select: {
      id: true,
      code: true,
      title: true,
      endedAt: true,
      host: { select: { name: true } },
    },
  });
  if (!meeting) notFound();

  // Signed-in users join with their account; anyone else joins as a guest
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? { id: session.user.id, name: session.user.name ?? session.user.email ?? "Member" }
    : null;

  return (
    <MeetingRoom
      meeting={{
        id: meeting.id,
        code: meeting.code,
        title: meeting.title,
        hostName: meeting.host.name,
        endedAt: meeting.endedAt ? meeting.endedAt.toISOString() : null,
      }}
      user={user}
    />
  );
}