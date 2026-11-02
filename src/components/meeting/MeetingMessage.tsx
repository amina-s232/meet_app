import type { ReactNode } from "react";
import Link from "next/link";

type Props = {
  icon: ReactNode;
  title: string;
  message?: string;
  actions?: { label: string; href?: string; onClick?: () => void; primary?: boolean }[];
};

/** Full-screen status card: meeting ended, you left, connection error... */
export default function MeetingMessage({ icon, title, message, actions = [] }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          {icon}
        </span>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        {actions.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {actions.map((a) => {
              const cls = a.primary
                ? "rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                : "rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50";
              return a.href ? (
                <Link key={a.label} href={a.href} className={cls}>
                  {a.label}
                </Link>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} className={cls}>
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}