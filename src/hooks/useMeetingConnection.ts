"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage, Participant } from "@/types/meeting-room";

export type ConnectionStatus =
  | "idle" // not started yet / connecting
  | "connecting"
  | "joined"
  | "reconnecting"
  | "ended" // host ended the meeting
  | "left" // you left
  | "error";

type PeerEntry = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
  mediaAttached: boolean;
};

type HistoryRow = {
  id: string;
  userId: string | null;
  senderName: string;
  content: string;
  createdAt: string;
};

// Public STUN servers work for most networks. For production add a TURN server (see NEXT_PUBLIC_TURN_* in .env).
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

async function flushCandidates(entry: PeerEntry) {
  const queued = entry.pendingCandidates.splice(0);
  for (const candidate of queued) {
    try {
      await entry.pc.addIceCandidate(candidate);
    } catch (err) {
      console.warn("addIceCandidate failed", err);
    }
  }
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

type Options = {
  meetingCode: string;
  displayName: string;
  localStream: MediaStream | null;
  /** Set to true when the user clicks "Join". */
  enabled: boolean;
};

/**
 * Socket.io signaling + WebRTC mesh for one meeting.
 *
 * Flow: join-meeting -> participants-list. The newcomer sends an offer to every other participant;
 * existing participants answer. ICE candidates are relayed through the socket server.
 */
export function useMeetingConnection({ meetingCode, displayName, localStream, enabled }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const nameRef = useRef(displayName);
  const historyLoadedRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasJoinedRef = useRef(false);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync (declared before the connection effect so they run first)
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  useEffect(() => {
    nameRef.current = displayName;
  }, [displayName]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  // ---------- peer helpers ----------
  const closePeer = useCallback((id: string) => {
    const peer = peersRef.current.get(id);
    if (peer) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.close();
      peersRef.current.delete(id);
    }
    setRemoteStreams((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const id of [...peersRef.current.keys()]) closePeer(id);
  }, [closePeer]);

  /** The track we currently send: screen share (video only) or the camera/microphone. */
  const outgoingTrack = useCallback((kind: "audio" | "video"): MediaStreamTrack | null => {
    if (kind === "video" && screenTrackRef.current) return screenTrackRef.current;
    const stream = localStreamRef.current;
    const track = kind === "audio" ? stream?.getAudioTracks()[0] : stream?.getVideoTracks()[0];
    return track ?? null;
  }, []);

  const attachLocalMedia = useCallback(
    (pc: RTCPeerConnection) => {
      const stream = localStreamRef.current ?? new MediaStream();
      for (const kind of ["audio", "video"] as const) {
        const track = outgoingTrack(kind);
        if (track) {
          pc.addTrack(track, stream);
          continue;
        }
        // No track yet (no camera / not sharing): keep a send-capable transceiver so a track
        // can be swapped in later with replaceTrack() and no renegotiation.
        const existing = pc.getTransceivers().find((t) => t.receiver.track.kind === kind);
        if (existing) existing.direction = "sendrecv";
        else pc.addTransceiver(kind, { direction: "sendrecv" });
      }
    },
    [outgoingTrack]
  );

  const createPeer = useCallback((remoteId: string, socket: Socket): PeerEntry => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: PeerEntry = {
      pc,
      stream: new MediaStream(),
      pendingCandidates: [],
      mediaAttached: false,
    };
    peersRef.current.set(remoteId, entry);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: remoteId, candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      // Build a new MediaStream each time so React re-assigns it to the <video> element
      const tracks = entry.stream.getTracks();
      if (tracks.includes(event.track)) return;
      entry.stream = new MediaStream([...tracks, event.track]);
      setRemoteStreams((prev) => ({ ...prev, [remoteId]: entry.stream }));
    };

    return entry;
  }, []);

  /** We are the newcomer: create the connection and send the offer. */
  const startCall = useCallback(
    async (remoteId: string, socket: Socket, code: string) => {
      if (peersRef.current.has(remoteId)) return;
      const entry = createPeer(remoteId, socket);
      attachLocalMedia(entry.pc);
      entry.mediaAttached = true;
      try {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        socket.emit("offer", {
          to: remoteId,
          offer: { type: offer.type, sdp: offer.sdp },
          meetingCode: code,
        });
      } catch (err) {
        console.error("Failed to create offer", err);
        closePeer(remoteId);
      }
    },
    [createPeer, attachLocalMedia, closePeer]
  );

  // ---------- teardown ----------
  const teardown = useCallback(() => {
    if (joinTimerRef.current) {
      clearTimeout(joinTimerRef.current);
      joinTimerRef.current = null;
    }
    hasJoinedRef.current = false;
    const socket = socketRef.current;
    if (socket) {
      socket.emit("leave-meeting");
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    closeAllPeers();
    const track = screenTrackRef.current;
    if (track) {
      track.onended = null;
      track.stop();
      screenTrackRef.current = null;
    }
    setScreenStream(null);
    setParticipants([]);
    setMySocketId(null);
  }, [closeAllPeers]);

  // ---------- socket connection ----------
  useEffect(() => {
    if (!enabled) return;

    const clearJoinTimeout = () => {
      if (joinTimerRef.current) {
        clearTimeout(joinTimerRef.current);
        joinTimerRef.current = null;
      }
    };

    const startJoinTimeout = () => {
      clearJoinTimeout();
      joinTimerRef.current = setTimeout(() => {
        if (!hasJoinedRef.current) {
          if (process.env.NODE_ENV !== "production") {
            console.info("[meeting-connection] join timeout reached (10s)");
          }
          teardown();
          setError("Couldn't reach the meeting server, please try again");
          setStatus("error");
        }
      }, 10000);
    };

    startJoinTimeout();

    const socket = io();
    socketRef.current = socket;

    const loadHistory = async () => {
      if (historyLoadedRef.current) return;
      historyLoadedRef.current = true;
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(meetingCode)}/messages?limit=100`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: HistoryRow[] };
        const rows = (data.messages ?? []).map<ChatMessage>((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.senderName,
          content: r.content,
          createdAt: r.createdAt,
          history: true,
        }));
        setMessages((prev) => mergeMessages(prev, rows));
      } catch {
        /* history is optional */
      }
    };

    socket.on("connect", () => {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[meeting-connection] connect: socketId=${socket.id}`);
      }
      // (Re)connected: start from a clean slate, then join
      closeAllPeers();
      setError(null);
      setMySocketId(socket.id ?? null);
      startJoinTimeout();
      if (process.env.NODE_ENV !== "production") {
        console.info("[meeting-connection] join-meeting emitted", { meetingCode, userName: nameRef.current });
      }
      socket.emit("join-meeting", { meetingCode, userName: nameRef.current });
    });

    socket.on("connect_error", (err: Error) => {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[meeting-connection] connect_error: ${err?.message ?? "unknown error"}`);
      }
      setError("Can't reach the meeting server. Retrying...");
    });

    socket.on("disconnect", (reason: string) => {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[meeting-connection] disconnect: reason=${reason}`);
      }
      if (reason === "io client disconnect") return;
      if (hasJoinedRef.current) {
        setStatus("reconnecting");
      }
    });

    socket.on("participants-list", (list: Participant[]) => {
      if (process.env.NODE_ENV !== "production") {
        console.info("[meeting-connection] participants-list received", list);
      }
      clearJoinTimeout();
      hasJoinedRef.current = true;
      setParticipants(list);
      setStatus("joined");
      void loadHistory();
      // We are the newcomer: call everyone who is already here
      for (const p of list) {
        if (p.socketId !== socket.id && !peersRef.current.has(p.socketId)) {
          void startCall(p.socketId, socket, meetingCode);
        }
      }
    });

    socket.on("participants-updated", (list: Participant[]) => setParticipants(list));

    socket.on("user-joined", (p: { name: string }) => showNotice(`${p.name} joined`));

    socket.on("user-left", (p: { socketId: string; name: string }) => {
      closePeer(p.socketId);
      showNotice(`${p.name} left`);
    });

    socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const entry = peersRef.current.get(from) ?? createPeer(from, socket);
        await entry.pc.setRemoteDescription(offer);
        if (!entry.mediaAttached) {
          attachLocalMedia(entry.pc);
          entry.mediaAttached = true;
        }
        await flushCandidates(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer: { type: answer.type, sdp: answer.sdp } });
      } catch (err) {
        console.error("Failed to handle offer", err);
        closePeer(from);
      }
    });

    socket.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const entry = peersRef.current.get(from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(answer);
        await flushCandidates(entry);
      } catch (err) {
        console.error("Failed to handle answer", err);
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const entry = peersRef.current.get(from);
      if (!entry) return;
      if (!entry.pc.remoteDescription) {
        entry.pendingCandidates.push(candidate); // remote description not set yet
        return;
      }
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("addIceCandidate failed", err);
      }
    });

    socket.on(
      "new-message",
      (m: { id: string; content: string; userId: string | null; userName: string; createdAt: string }) => {
        setMessages((prev) => mergeMessages(prev, [m]));
      }
    );

    socket.on("media-state-updated", (m: { socketId: string; audio: boolean; video: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === m.socketId ? { ...p, audio: m.audio, video: m.video } : p))
      );
    });

    socket.on("meeting-ended", () => {
      teardown();
      setStatus("ended");
    });

    socket.on("error", ({ message, event }: { message: string; event?: string }) => {
      if (event === "join-meeting") {
        const ended = message === "Meeting has ended";
        teardown();
        if (!ended) setError(message);
        setStatus(ended ? "ended" : "error");
        return;
      }
      showNotice(message);
    });

    return () => {
      teardown();
    };
  }, [enabled, meetingCode, closeAllPeers, closePeer, createPeer, attachLocalMedia, startCall, showNotice, teardown]);

  // ---------- actions ----------
  const sendMessage = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text) return;
      socketRef.current?.emit("send-message", { meetingCode, content: text });
    },
    [meetingCode]
  );

  /** Tell everyone whether our mic/camera is on (call when status === "joined" and whenever it changes). */
  const announceMedia = useCallback(
    (audio: boolean, video: boolean) => {
      socketRef.current?.emit("media-state", { meetingCode, audio, video });
    },
    [meetingCode]
  );

  const leave = useCallback(() => {
    teardown();
    setStatus("left");
  }, [teardown]);

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    await Promise.all(
      [...peersRef.current.values()].map(async ({ pc }) => {
        const sender = pc.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender;
        try {
          await sender?.replaceTrack(track);
        } catch (err) {
          console.warn("replaceTrack failed", err);
        }
      })
    );
  }, []);

  const stopScreenShare = useCallback(() => {
    const track = screenTrackRef.current;
    if (!track) return;
    track.onended = null;
    track.stop();
    screenTrackRef.current = null;
    setScreenStream(null);
    void replaceVideoTrack(localStreamRef.current?.getVideoTracks()[0] ?? null);
  }, [replaceVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = display.getVideoTracks()[0];
      track.onended = () => stopScreenShare(); // user clicked the browser's "Stop sharing"
      screenTrackRef.current = track;
      setScreenStream(display);
      await replaceVideoTrack(track);
    } catch {
      /* user cancelled the picker */
    }
  }, [replaceVideoTrack, stopScreenShare]);

  return {
    status,
    error,
    notice,
    mySocketId,
    participants,
    remoteStreams,
    messages,
    screenStream,
    sendMessage,
    announceMedia,
    toggleScreenShare,
    leave,
  };
}