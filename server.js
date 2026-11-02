import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { registerSocketHandlers } from "./socket-handlers.js";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

// If you are on classic Prisma 6 (no driver adapter), replace the next two lines with:
//   const prisma = new PrismaClient();
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    // Same-origin in production; restrict this to your real domain when you deploy.
    cors: dev ? { origin: "*" } : { origin: process.env.NEXTAUTH_URL, credentials: true },
    destroyUpgrade: false,
  });

  const upgradeHandler = app.getUpgradeHandler();
  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/socket.io")) {
      upgradeHandler(req, socket, head);
    }
  });

  // Lets API routes (e.g. POST /api/meetings/[id]/messages) emit to rooms
  globalThis.io = io;

  registerSocketHandlers(io, prisma);

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => console.log(`> Ready on http://localhost:${port}`));
});
