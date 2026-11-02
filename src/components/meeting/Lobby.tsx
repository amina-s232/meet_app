"use client";

import { useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";

type Props = {
  stream: MediaStream | null;
  loading: boolean;
  permissionError: string | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  title: string | null;
  code: string;
  hostName: string | null;
  name: string;
  onNameChange: (value: string) => void;
  /** Signed-in users can't change the name they join with. */
  nameLocked: boolean;
  homeHref: string;
  onJoin: () => void;
  onRetryMedia?: () => void;
};

export default function Lobby(props: Props) {
  const { stream, loading, permissionError, audioEnabled, videoEnabled, hasAudio, hasVideo } = props;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const showVideo = !!stream && hasVideo && videoEnabled;
  const trimmed = props.name.trim();
  const canJoin = trimmed.length >= 2;
  const initial = trimmed.charAt(0).toUpperCase() || "?";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (canJoin) props.onJoin();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <Link
          href={props.homeHref}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Camera preview */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 shadow-sm">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${showVideo ? "" : "invisible"}`}
                style={{ transform: "scaleX(-1)" }}
              />
              {!showVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-300">
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={28} />
                      <p className="text-sm">Starting your camera...</p>
                    </>
                  ) : (
                    <>
                      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold text-white">
                        {initial}
                      </span>
                      <p className="text-sm">{hasVideo ? "Camera is off" : "No camera"}</p>
                    </>
                  )}
                </div>
              )}

              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={props.onToggleAudio}
                  disabled={!hasAudio}
                  aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    audioEnabled ? "bg-gray-700/80 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  type="button"
                  onClick={props.onToggleVideo}
                  disabled={!hasVideo}
                  aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    videoEnabled ? "bg-gray-700/80 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            </div>

            {permissionError && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <p>
                  {permissionError} You can still join and watch or listen.
                </p>
                {props.onRetryMedia && (
                  <button
                    type="button"
                    onClick={props.onRetryMedia}
                    className="shrink-0 rounded-md bg-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-300"
                  >
                    Retry camera
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Join form */}
          <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Ready to join?</h1>
            <p className="mt-2 text-gray-900">{props.title ?? "Untitled meeting"}</p>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-mono">{props.code}</span>
              {props.hostName && <> · Hosted by {props.hostName}</>}
            </p>

            <div className="mt-6">
              {props.nameLocked ? (
                <p className="text-sm text-gray-600">
                  Joining as <span className="font-semibold text-gray-900">{props.name}</span>
                </p>
              ) : (
                <>
                  <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Your name
                  </label>
                  <input
                    id="guest-name"
                    value={props.name}
                    onChange={(e) => props.onNameChange(e.target.value)}
                    maxLength={50}
                    placeholder="Enter your name"
                    autoComplete="name"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Or <Link href={`/login?callbackUrl=/meeting/${props.code}`} className="font-medium text-blue-600">sign in</Link> to join with your account.
                  </p>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={!canJoin}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}