import type { ReactNode } from "react";
import Link from "next/link";
import { MessageSquare, ShieldCheck, Users, Video } from "lucide-react";

const features = [
  { icon: Video, text: "HD video meetings right in your browser" },
  { icon: Users, text: "Share a code or link and anyone can join" },
  { icon: MessageSquare, text: "Built-in chat while you talk" },
  { icon: ShieldCheck, text: "Secure sign-in with your email or Google" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white text-gray-900 lg:grid-cols-2">
      {/* Brand panel */}
      <aside
        className="hidden flex-col justify-between p-12 text-white lg:flex"
        style={{ backgroundImage: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 55%, #312e81 100%)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 text-xl font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Video size={22} />
          </span>
          Meet
        </Link>

        <div>
          <h2 className="text-4xl font-semibold leading-tight">
            Video meetings
            <br />
            for everyone.
          </h2>
          <ul className="mt-8 space-y-4 text-blue-50">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-blue-100/80">Connect, collaborate and celebrate from anywhere.</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-gray-50 px-6 py-12 lg:bg-white">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold text-blue-700 lg:hidden"
          >
            <Video size={22} /> Meet
          </Link>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm lg:border-0 lg:p-0 lg:shadow-none">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}