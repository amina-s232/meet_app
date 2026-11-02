"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Keyboard, Loader2, Plus, X } from "lucide-react";
import DashboardNav from "./DashboardNav";
import MeetingList from "./MeetingList";
import type { MeetingItem } from "@/lib/meeting";

type Props = {
  user: { name: string | null; email: string | null };
  initialMeetings: MeetingItem[];
};

const meetingUrl = (code: string) => `${window.location.origin}/meeting/${code}`;

export default function DashboardClient({ user, initialMeetings }: Props) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>(initialMeetings);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<MeetingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [endingId, setEndingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const firstName = user.name?.trim().split(" ")[0] ?? "there";

  async function copyLink(meeting: MeetingItem) {
    try {
      await navigator.clipboard.writeText(meetingUrl(meeting.code));
      setCopiedId(meeting.id);
      setTimeout(() => setCopiedId((id) => (id === meeting.id ? null : id)), 2000);
    } catch {
      setError("Couldn't copy the link to your clipboard.");
    }
  }

  async function createMeeting(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined }),
      });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.details?.title?.[0] ?? data?.error ?? "Could not create the meeting");
      }

      const meeting = data.meeting as MeetingItem;
      setMeetings((prev) => [meeting, ...prev]);
      setCreated(meeting);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the meeting");
    } finally {
      setCreating(false);
    }
  }

  async function endMeeting(meeting: MeetingItem) {
    if (!window.confirm("End this meeting for everyone?")) return;
    setEndingId(meeting.id);
    setError(null);

    try {
      const res = await fetch(`/api/meetings/${meeting.id}/end`, { method: "POST" });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not end the meeting");

      const endedAt: string = data.meeting?.endedAt ?? new Date().toISOString();
      setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? { ...m, endedAt } : m)));
      setCreated((c) => (c?.id === meeting.id ? null : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end the meeting");
    } finally {
      setEndingId(null);
    }
  }

  function joinByCode(e: FormEvent) {
    e.preventDefault();
    // Accepts a bare code ("abc-defg-hij") or a full meeting link
    const code = joinInput.trim().split("/").filter(Boolean).pop()?.toLowerCase();
    if (!code) return;
    router.push(`/meeting/${encodeURIComponent(code)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <DashboardNav user={user} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-gray-600">Start a new meeting or join one with a code.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Create meeting */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">New meeting</h2>
            <p className="mt-1 text-sm text-gray-500">Get a link you can share with anyone.</p>
            <form onSubmit={createMeeting} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Meeting title (optional)"
                aria-label="Meeting title"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={creating}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create meeting
              </button>
            </form>
          </section>

          {/* Join with a code */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">Join with a code</h2>
            <p className="mt-1 text-sm text-gray-500">Paste a meeting code or link.</p>
            <form onSubmit={joinByCode} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Keyboard
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="abc-defg-hij"
                  aria-label="Meeting code or link"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={!joinInput.trim()}
                className="flex items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                Join <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Just-created banner */}
        {created && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span className="flex items-center gap-2">
              <Check size={16} />
              Meeting created:
              <span className="font-mono font-semibold">{created.code}</span>
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink(created)}
                className="rounded-md border border-green-300 bg-white px-3 py-1.5 font-medium text-green-800 hover:bg-green-100"
              >
                {copiedId === created.id ? "Copied" : "Copy link"}
              </button>
              <Link
                href={`/meeting/${created.code}`}
                className="rounded-md bg-green-700 px-3 py-1.5 font-medium text-white hover:bg-green-800"
              >
                Join now
              </Link>
              <button type="button" onClick={() => setCreated(null)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </span>
          </div>
        )}

        <MeetingList
          meetings={meetings}
          endingId={endingId}
          copiedId={copiedId}
          onCopy={(m) => void copyLink(m)}
          onEnd={(m) => void endMeeting(m)}
        />
      </main>
    </div>
  );
}