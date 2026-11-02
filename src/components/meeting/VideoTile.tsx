"use client";

import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

type Props = {
  stream: MediaStream | null;
  name: string;
  audio: boolean;
  video: boolean;
  isLocal?: boolean;
  isHost?: boolean;
  mirror?: boolean;
};

export default function VideoTile({
  stream,
  name,
  audio,
  video,
  isLocal = false,
  isHost = false,
  mirror = false,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const showVideo = video && !!stream;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-2xl bg-gray-800">
      {/* The element stays mounted even when the camera is off so remote audio keeps playing */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-contain ${showVideo ? "" : "invisible"}`}
        style={mirror ? { transform: "scaleX(-1)" } : undefined}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold text-white">
            {initial}
          </span>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-2.5 py-1 text-sm text-white">
        {!audio && <MicOff size={14} className="text-red-400" />}
        <span className="max-w-[10rem] truncate">
          {name}
          {isLocal && " (You)"}
        </span>
        {isHost && (
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase">Host</span>
        )}
      </div>
    </div>
  );
}