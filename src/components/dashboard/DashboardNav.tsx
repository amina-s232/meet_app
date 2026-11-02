"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Video } from "lucide-react";

type Props = { user: { name: string | null; email: string | null } };

export default function DashboardNav({ user }: Props) {
  const display = user.name ?? user.email ?? "You";
  const initial = display.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Video size={20} />
          </span>
          Meet
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {initial}
            </span>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-gray-900">{display}</p>
              {user.name && user.email && <p className="text-xs text-gray-500">{user.email}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}