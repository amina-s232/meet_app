import Link from "next/link";
import { SearchX } from "lucide-react";

export default function MeetingNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <SearchX size={26} />
        </span>
        <h1 className="mt-5 text-xl font-semibold">Meeting not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          Check the meeting code or link and try again.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}