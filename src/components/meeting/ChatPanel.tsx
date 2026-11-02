"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import type { ChatMessage, Participant } from "@/types/meeting-room";

type Props = {
  messages: ChatMessage[];
  me: Participant | undefined;
  onSend: (text: string) => void;
  onClose: () => void;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPanel({ messages, me, onSend, onClose }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  }

  const isMine = (m: ChatMessage) =>
    me?.userId ? m.userId === me.userId : !m.userId && m.userName === me?.name;

  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold">In-call messages</h2>
        <button type="button" onClick={onClose} aria-label="Close chat" className="text-gray-500 hover:text-gray-800">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500">
            No messages yet. Say hello to everyone in the meeting.
          </p>
        ) : (
          messages.map((m) => {
            const mine = isMine(m);
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <p className="mb-0.5 text-xs text-gray-500">
                  {mine ? "You" : m.userName} · {formatTime(m.createdAt)}
                </p>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-200 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Send a message"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}