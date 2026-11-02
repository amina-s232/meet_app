Meet

A real-time video conferencing web app for small groups, inspired by Google Meet. Create a room, share a code, and talk face to face with screen sharing and persistent in-call chat. Built with Next.js, WebRTC, Socket.io, and PostgreSQL.





Features
Instant rooms: generate Meet-style codes (abc-defg-hij) and share a link
Members and guests: sign in with email/password or Google, or join as a guest with just a display name
Pre-join lobby: preview camera, check mic, toggle devices, and set your display name before entering
Peer-to-peer calls: audio and video over WebRTC, with Socket.io handling signaling
Persistent chat: messages are broadcast in real time, stored in PostgreSQL, and loaded for late joiners
Participants panel: roles (Host, Member, Guest) and live mic/camera state
Host controls: end the meeting for everyone
Dashboard: view, filter (All / Active / Ended), copy links for, and end your hosted meetings
Tech Stack
Layer	Technology
Framework	Next.js (App Router), React, TypeScript
Styling	Tailwind CSS, Lucide icons
Realtime signaling	Socket.io on a custom Node.js server
Media	WebRTC (RTCPeerConnection), MediaDevices API
Database	PostgreSQL with Prisma ORM
Auth	NextAuth.js (JWT sessions), Credentials and Google OAuth, bcrypt
Validation	Zod (forms, API routes, socket payloads)
Architecture
WebRTC media (P2P)
Socket.io signaling
Socket.io signaling
Browser A
Browser B
Node server: Next.js +Socket.io
PostgreSQL via Prisma
A single custom Node server (server.js) serves Next.js and attaches Socket.io.
Socket handlers (socket-handlers.js) verify the NextAuth session from the handshake cookie. Unauthenticated sockets are treated as guests.
When a user joins, they receive the current participant list and send an SDP offer to each existing peer. Answers and ICE candidates are relayed through the server.
Audio and video travel directly between browsers (mesh topology). The server never touches media.
Why a mesh instead of an SFU?

Each participant sends one stream to every other participant. That keeps the infrastructure simple (no media server) and works well for small calls of roughly 2-4 people. Beyond that, upload bandwidth and CPU become the bottleneck, and an SFU such as LiveKit or mediasoup would be the right next step.

Getting Started
Prerequisites
Node.js 20+
PostgreSQL 14+
Setup
bash
git clone https://github.com/<your-username>/meet.git
cd meet
npm install
cp .env.example .env     # then fill in the values
npx prisma generate
npx prisma migrate dev
npm run dev

The app runs at http://localhost:3000.

Environment variables
Variable	Required	Description
DATABASE_URL	Yes	PostgreSQL connection string
NEXTAUTH_SECRET	Yes	Long random string used to sign sessions and verify socket connections
NEXTAUTH_URL	Yes	Canonical app URL, e.g. http://localhost:3000
GOOGLE_CLIENT_ID	No	Enables Google sign-in
GOOGLE_CLIENT_SECRET	No	Enables Google sign-in
NEXT_PUBLIC_TURN_URL	No	TURN server URL for restrictive networks
NEXT_PUBLIC_TURN_USERNAME	No	TURN username
NEXT_PUBLIC_TURN_CREDENTIAL	No	TURN credential
PORT	No	Server port (default 3000)
DEBUG_SOCKET	No	Set to 1 for verbose socket logs

Generate a secret with openssl rand -base64 32.

Project Structure
meet/
├── server.js              # Custom server: Next.js + Socket.io
├── socket-handlers.js     # Auth, presence, signaling, chat
├── prisma/                # Schema and migrations
└── src/
    ├── app/               # Routes: auth, dashboard, meeting/[code], API
    ├── components/        # auth, dashboard, meeting UI
    ├── hooks/             # useLocalMedia, useMeetingConnection
    ├── lib/               # auth, prisma, socket helpers, meeting utils
    └── types/
Data Model

User, Meeting (unique code, hostId, endedAt), Participant (member or guest, with joinedAt / leftAt), and Message, plus the standard NextAuth tables (Account, Session, VerificationToken).

Known Limitations
Mesh topology is intended for small calls (about 2-4 participants).
Without a TURN server, some users behind strict NATs or corporate networks may fail to connect. Configure TURN for production.
Screen sharing is not available on mobile browsers.
The Socket.io server holds room state in memory, so it runs as a single instance.
Roadmap
 Automatic reconnection (ICE restart and socket rejoin)
 Server-issued, short-lived TURN credentials
 Server-side room capacity limit
 Rate limiting on auth and join endpoints
 End-to-end tests (Playwright with fake media devices)
 Device selection (camera / microphone)
 
