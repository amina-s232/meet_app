import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import GoogleButton from "@/components/auth/GoogleButton";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · Meet" };

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  if (session?.user?.id) redirect(callbackUrl);

  // The Google button only appears when Google OAuth credentials are configured
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
      <p className="mb-8 mt-1.5 text-sm text-gray-600">Sign in to start or join a meeting.</p>

      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} />}
      <LoginForm callbackUrl={callbackUrl} initialError={params.error} />

      <p className="mt-6 text-center text-sm text-gray-600">
        New to Meet?{" "}
        <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
          Create an account
        </Link>
      </p>
    </>
  );
}