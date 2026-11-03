// Security notice: User credentials (passwords, emails, tokens) must never be logged or exposed in URLs.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
