"use client";

import { Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import type { Participant } from "@/types/meeting-room";

type Props = {
  participants: Participant[];
  mySocketId: string | null;
  onClose: () => void;
};

export default function ParticipantsPanel({ participants, mySocketId, onClose }: Props) {
  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold">People ({participants.length})</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participants"
          className="text-gray-500 hover:text-gray-800"
        >
          <X size={18} />
        </button>
      </div>

      <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
        {participants.map((p) => (
          <li key={p.socketId} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {p.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {p.name}
                {p.socketId === mySocketId && <span className="text-gray-500"> (You)</span>}
              </p>
              <p className="text-xs text-gray-500">
                {p.isHost ? "Host" : p.isGuest ? "Guest" : "Member"}
              </p>
            </div>
            <span className="flex items-center gap-2 text-gray-500">
              {p.audio ? <Mic size={16} /> : <MicOff size={16} className="text-red-500" />}
              {p.video ? <Video size={16} /> : <VideoOff size={16} className="text-red-500" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}