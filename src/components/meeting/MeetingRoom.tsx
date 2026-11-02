"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarX, Check, Copy, DoorOpen, Loader2, Wifi } from "lucide-react";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingConnection } from "@/hooks/useMeetingConnection";
import type { RoomMeeting } from "@/types/meeting-room";
import ChatPanel from "./ChatPanel";
import ControlBar, { type Panel } from "./ControlBar";
import Lobby from "./Lobby";
import MeetingMessage from "./MeetingMessage";
import ParticipantsPanel from "./ParticipantsPanel";
import VideoTile from "./VideoTile";

type Props = {
  meeting: RoomMeeting;
  /** null for guests */
  user: { id: string; name: string } | null;
};

const gridCols = (n: number) =>
  n <= 1
    ? "grid-cols-1"
    : n <= 4
      ? "grid-cols-1 sm:grid-cols-2"
      : n <= 6
        ? "grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-4";

export default function MeetingRoom({ meeting, user }: Props) {
  const media = useLocalMedia();

  const [name, setName] = useState(user?.name ?? "");
  const [joined, setJoined] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const conn = useMeetingConnection({
    meetingCode: meeting.code,
    displayName: name.trim(),
    localStream: media.stream,
    enabled: joined,
  });
  const { status, announceMedia, screenStream } = conn;
  const screenSharing = screenStream !== null;
  const homeHref = user ? "/dashboard" : "/login";

  // Tell everyone about our mic/camera state when we join and whenever it changes
  useEffect(() => {
    if (status === "joined") announceMedia(media.audioEnabled, media.videoEnabled || screenSharing);
  }, [status, announceMedia, media.audioEnabled, media.videoEnabled, screenSharing]);

  // Release the camera once the call is over
  const { stop: stopMedia } = media;
  useEffect(() => {
    if (status === "ended" || status === "left" || status === "error") stopMedia();
  }, [status, stopMedia]);

  const me = conn.participants.find((p) => p.socketId === conn.mySocketId);
  const unread =
    panel === "chat" ? 0 : Math.max(0, conn.messages.filter((m) => !m.history).length - seenCount);

  function togglePanel(next: Exclude<Panel, null>) {
    // Closing the chat marks everything as read
    if (panel === "chat") setSeenCount(conn.messages.filter((m) => !m.history).length);
    setPanel(panel === next ? null : next);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meeting/${meeting.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Couldn't copy the link to your clipboard.");
    }
  }

  async function endForAll() {
    if (!window.confirm("End this meeting for everyone?")) return;
    setEnding(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/end`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not end the meeting");
      }
      // The server broadcasts `meeting-ended`; the connection hook switches us to the ended screen
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not end the meeting");
    } finally {
      setEnding(false);
    }
  }

  // ---------- screens before / after the call ----------
  if (meeting.endedAt) {
    return (
      <MeetingMessage
        icon={<CalendarX size={26} />}
        title="This meeting has ended"
        message="The host has already ended this meeting."
        actions={[{ label: "Go to home", href: homeHref, primary: true }]}
      />
    );
  }

  if (!joined) {
    return (
      <Lobby
        stream={media.stream}
        loading={media.loading}
        permissionError={media.permissionError}
        audioEnabled={media.audioEnabled}
        videoEnabled={media.videoEnabled}
        hasAudio={media.hasAudio}
        hasVideo={media.hasVideo}
        onToggleAudio={media.toggleAudio}
        onToggleVideo={media.toggleVideo}
        title={meeting.title}
        code={meeting.code}
        hostName={meeting.hostName}
        name={name}
        onNameChange={setName}
        nameLocked={!!user}
        homeHref={homeHref}
        onJoin={() => setJoined(true)}
        onRetryMedia={media.retry}
      />
    );
  }

  if (status === "ended") {
    return (
      <MeetingMessage
        icon={<CalendarX size={26} />}
        title="The meeting has ended"
        message="The host ended this meeting for everyone."
        actions={[{ label: "Go to home", href: homeHref, primary: true }]}
      />
    );
  }

  if (status === "left") {
    return (
      <MeetingMessage
        icon={<DoorOpen size={26} />}
        title="You left the meeting"
        actions={[
          { label: "Rejoin", onClick: () => window.location.reload(), primary: true },
          { label: "Go to home", href: homeHref },
        ]}
      />
    );
  }

  if (status === "error") {
    return (
      <MeetingMessage
        icon={<AlertTriangle size={26} />}
        title="Couldn't join the meeting"
        message={conn.error ?? "Something went wrong."}
        actions={[
          { label: "Try again", onClick: () => window.location.reload(), primary: true },
          { label: "Go to home", href: homeHref },
        ]}
      />
    );
  }

  if (status !== "joined" && status !== "reconnecting") {
    return (
      <MeetingMessage
        icon={<Loader2 size={26} className="animate-spin" />}
        title="Joining the meeting..."
        message={conn.error ?? undefined}
      />
    );
  }

  // ---------- in the call ----------
  const tiles = conn.participants.map((p) => {
    const isMe = p.socketId === conn.mySocketId;
    return {
      key: p.socketId,
      name: p.name,
      isHost: p.isHost,
      isLocal: isMe,
      stream: isMe ? (screenStream ?? media.stream) : (conn.remoteStreams[p.socketId] ?? null),
      audio: isMe ? media.audioEnabled : p.audio,
      video: isMe ? media.videoEnabled || screenSharing : p.video,
      mirror: isMe && !screenSharing,
    };
  });

  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{meeting.title ?? "Untitled meeting"}</p>
          <p className="font-mono text-xs text-gray-400">{meeting.code}</p>
        </div>
        {status === "reconnecting" && (
          <span className="flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300">
            <Wifi size={14} /> Reconnecting...
          </span>
        )}
      </header>

      {(conn.notice || actionError) && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          <span
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm shadow-lg ${
              actionError ? "bg-red-600" : "bg-gray-800"
            }`}
            onClick={() => setActionError(null)}
          >
            {actionError ?? conn.notice}
          </span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-0">
          <div className={`grid h-full auto-rows-fr gap-3 ${gridCols(tiles.length)}`}>
            {tiles.map((t) => (
              <VideoTile
                key={t.key}
                stream={t.stream}
                name={t.name}
                audio={t.audio}
                video={t.video}
                isLocal={t.isLocal}
                isHost={t.isHost}
                mirror={t.mirror}
              />
            ))}
          </div>

          {tiles.length === 1 && (
            <div className="absolute left-6 top-2 flex items-center gap-3 rounded-xl bg-gray-800/95 px-4 py-3 text-sm shadow-lg">
              <span>You&apos;re the only one here. Share this link to invite people.</span>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-medium hover:bg-blue-700"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          )}
        </main>

        {panel && (
          <aside className="fixed inset-0 z-30 sm:static sm:z-auto sm:m-4 sm:ml-0 sm:w-80 sm:shrink-0 sm:overflow-hidden sm:rounded-2xl">
            {panel === "chat" ? (
              <ChatPanel
                messages={conn.messages}
                me={me}
                onSend={conn.sendMessage}
                onClose={() => togglePanel("chat")}
              />
            ) : (
              <ParticipantsPanel
                participants={conn.participants}
                mySocketId={conn.mySocketId}
                onClose={() => togglePanel("people")}
              />
            )}
          </aside>
        )}
      </div>

      <ControlBar
        audioEnabled={media.audioEnabled}
        videoEnabled={media.videoEnabled}
        hasAudio={media.hasAudio}
        hasVideo={media.hasVideo}
        screenSharing={screenSharing}
        canShare={canShare}
        panel={panel}
        unread={unread}
        participantCount={conn.participants.length}
        copied={copied}
        isHost={!!me?.isHost}
        ending={ending}
        onToggleAudio={media.toggleAudio}
        onToggleVideo={media.toggleVideo}
        onToggleShare={() => void conn.toggleScreenShare()}
        onTogglePanel={togglePanel}
        onCopy={() => void copyInvite()}
        onLeave={() => conn.leave()}
        onEnd={() => void endForAll()}
      />
    </div>
  );
}