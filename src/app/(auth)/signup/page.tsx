import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/safe-redirect";
import GoogleButton from "@/components/auth/GoogleButton";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = { title: "Create account · Meet" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  if (session?.user?.id) redirect(callbackUrl);

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
      <p className="mb-8 mt-1.5 text-sm text-gray-600">It only takes a minute.</p>

      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} />}
      <SignupForm callbackUrl={callbackUrl} />

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </>
  );
}