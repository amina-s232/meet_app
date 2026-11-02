"use client";

import type { ReactNode } from "react";
import {
  Check,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

export type Panel = "chat" | "people" | null;

type Props = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  screenSharing: boolean;
  canShare: boolean;
  panel: Panel;
  unread: number;
  participantCount: number;
  copied: boolean;
  isHost: boolean;
  ending: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: Exclude<Panel, null>) => void;
  onCopy: () => void;
  onLeave: () => void;
  onEnd: () => void;
};

function RoundButton({
  label,
  onClick,
  children,
  tone = "default",
  active = false,
  disabled = false,
  badge,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "off" | "danger";
  active?: boolean;
  disabled?: boolean;
  badge?: number;
}) {
  const color =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : tone === "off"
        ? "bg-red-500/90 text-white hover:bg-red-500"
        : active
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-gray-700 text-white hover:bg-gray-600";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex h-12 w-12 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${color}`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export default function ControlBar(props: Props) {
  const {
    audioEnabled,
    videoEnabled,
    hasAudio,
    hasVideo,
    screenSharing,
    canShare,
    panel,
    unread,
    participantCount,
    copied,
    isHost,
    ending,
  } = props;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-gray-800 bg-gray-900 px-4 py-3">
      <RoundButton
        label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        tone={audioEnabled ? "default" : "off"}
        disabled={!hasAudio}
        onClick={props.onToggleAudio}
      >
        {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </RoundButton>

      <RoundButton
        label={videoEnabled ? "Turn off camera" : "Turn on camera"}
        tone={videoEnabled ? "default" : "off"}
        disabled={!hasVideo}
        onClick={props.onToggleVideo}
      >
        {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </RoundButton>

      {canShare && (
        <RoundButton
          label={screenSharing ? "Stop sharing" : "Share your screen"}
          active={screenSharing}
          onClick={props.onToggleShare}
        >
          <MonitorUp size={20} />
        </RoundButton>
      )}

      <RoundButton
        label="Chat"
        active={panel === "chat"}
        badge={unread}
        onClick={() => props.onTogglePanel("chat")}
      >
        <MessageSquare size={20} />
      </RoundButton>

      <RoundButton
        label="Participants"
        active={panel === "people"}
        badge={undefined}
        onClick={() => props.onTogglePanel("people")}
      >
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Users size={18} />
          {participantCount}
        </span>
      </RoundButton>

      <RoundButton label="Copy invite link" onClick={props.onCopy}>
        {copied ? <Check size={20} className="text-green-400" /> : <Link2 size={20} />}
      </RoundButton>

      <RoundButton label="Leave meeting" tone="danger" onClick={props.onLeave}>
        <PhoneOff size={20} />
      </RoundButton>

      {isHost && (
        <button
          type="button"
          onClick={props.onEnd}
          disabled={ending}
          className="flex items-center gap-2 rounded-full border border-red-500 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          {ending && <Loader2 size={14} className="animate-spin" />}
          End for all
        </button>
      )}
    </div>
  );
}