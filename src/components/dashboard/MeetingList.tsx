"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Video } from "lucide-react";
import type { MeetingItem } from "@/lib/meeting";

type Filter = "all" | "active" | "ended";

type Props = {
  meetings: MeetingItem[];
  endingId: string | null;
  copiedId: string | null;
  onCopy: (meeting: MeetingItem) => void;
  onEnd: (meeting: MeetingItem) => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function MeetingList({ meetings, endingId, copiedId, onCopy, onEnd }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const activeCount = meetings.filter((m) => !m.endedAt).length;
  const visible = meetings.filter((m) =>
    filter === "all" ? true : filter === "active" ? !m.endedAt : !!m.endedAt
  );

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: meetings.length },
    { id: "active", label: "Active", count: activeCount },
    { id: "ended", label: "Ended", count: meetings.length - activeCount },
  ];

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Your meetings</h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                filter === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label} <span className="opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Video size={22} />
          </span>
          <p className="mt-4 font-medium text-gray-900">
            {meetings.length === 0 ? "No meetings yet" : "No meetings in this view"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {meetings.length === 0
              ? "Create your first meeting above and share the link."
              : "Try another filter."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {visible.map((m) => {
            const ended = !!m.endedAt;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    ended ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"
                  }`}
                >
                  <Video size={20} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{m.title ?? "Untitled meeting"}</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    <span className="font-mono">{m.code}</span>
                    <span className="mx-2 text-gray-300">•</span>
                    <time dateTime={m.createdAt} suppressHydrationWarning>
                      {formatDate(m.createdAt)}
                    </time>
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    ended ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
                  }`}
                >
                  {ended ? "Ended" : "Active"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCopy(m)}
                    title="Copy meeting link"
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {copiedId === m.id ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copiedId === m.id ? "Copied" : "Copy link"}
                  </button>

                  {!ended && (
                    <>
                      <Link
                        href={`/meeting/${m.code}`}
                        className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Join
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEnd(m)}
                        disabled={endingId === m.id}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {endingId === m.id && <Loader2 size={14} className="animate-spin" />}
                        End
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}