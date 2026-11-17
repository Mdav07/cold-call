// The chat room's meter, request panel and mood rule are reused from app/play/ChatRoom.tsx (B).
export { SuspicionMeter, ProposalPanel, moodFor } from "@/app/play/ChatRoom";

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
