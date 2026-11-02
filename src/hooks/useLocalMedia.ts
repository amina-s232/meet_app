"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function describeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera and microphone access is blocked. Allow access in your browser's address bar to turn them on.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
      return "Your camera or microphone is being used by another app or browser.";
    default:
      return "Couldn't access your camera or microphone.";
  }
}

/**
 * Captures the user's camera + microphone once and keeps it for the whole visit
 * (lobby preview and the call share the same stream).
 * Falls back to audio-only, then video-only, if the full request fails.
 */
export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionError(
          "This browser can't access a camera or microphone (the page must be served over HTTPS or localhost)."
        );
        setLoading(false);
        return;
      }

      const attempts: MediaStreamConstraints[] = [
        { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
        { audio: true, video: false },
        { audio: false, video: true },
      ];

      let lastError: unknown;
      for (const constraints of attempts) {
        if (cancelled) return;

        let timedOut = false;
        let timer: ReturnType<typeof setTimeout>;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            const err = new Error("MEDIA_TIMEOUT");
            err.name = "TimeoutError";
            reject(err);
          }, 8000);
        });

        try {
          const s = await Promise.race([
            navigator.mediaDevices.getUserMedia(constraints).then((resStream) => {
              clearTimeout(timer);
              // If timed out or superseded by another attempt / unmount, stop late stream so camera is not locked
              if (timedOut || cancelled) {
                resStream.getTracks().forEach((t) => t.stop());
                return null;
              }
              return resStream;
            }),
            timeoutPromise,
          ]);

          if (cancelled) {
            s?.getTracks().forEach((t) => t.stop());
            return;
          }

          if (s) {
            streamRef.current = s;
            setStream(s);
            setAudioEnabled(s.getAudioTracks().length > 0);
            setVideoEnabled(s.getVideoTracks().length > 0);
            setLoading(false);
            return;
          }
        } catch (err) {
          lastError = err;
          if (err instanceof Error && err.message === "MEDIA_TIMEOUT") {
            if (!cancelled) {
              setPermissionError(
                "Your camera is taking too long to start. Close other apps or tabs that use the camera, then click Retry."
              );
              setLoading(false);
            }
            return;
          }
        }
      }

      if (!cancelled) {
        setPermissionError(describeMediaError(lastError));
        setLoading(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [retryCount]);

  const toggleAudio = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setPermissionError(null);
    setRetryCount((c) => c + 1);
  }, []);

  /** Turn the camera and microphone off for good (call ended / left). */
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return {
    stream,
    loading,
    permissionError,
    audioEnabled,
    videoEnabled,
    hasAudio: (stream?.getAudioTracks().length ?? 0) > 0,
    hasVideo: (stream?.getVideoTracks().length ?? 0) > 0,
    toggleAudio,
    toggleVideo,
    retry,
    stop,
  };
}