/** Entry of the list sent by the socket server (participants-list / participants-updated). */
export type Participant = {
  socketId: string;
  participantId: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  isHost: boolean;
  audio: boolean;
  video: boolean;
  joinedAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string | null;
  userName: string;
  content: string;
  createdAt: string;
  /** true for messages loaded from the REST history (they don't count as unread) */
  history?: boolean;
};

/** Meeting info passed from the server page to the room. */
export type RoomMeeting = {
  id: string;
  code: string;
  title: string | null;
  hostName: string | null;
  endedAt: string | null;
};