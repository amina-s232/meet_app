import { NextResponse } from "next/server";
import { getIO } from "@/lib/socket";

export async function GET() {
  const io = getIO();
  return NextResponse.json({
    status: io ? "ok" : "unavailable",
    connectedClients: io?.engine.clientsCount ?? 0,
  });
}