import { notFound } from "next/navigation";
import company from "@/content/plumpurse/company.json";
import directory from "@/content/plumpurse/directory.json";
import { agentIdFor } from "@/server/game/session";
import type { EmployeeId } from "@/shared/interfaces";
import { ChatRoom, type EmployeeCard } from "../ChatRoom";

/** One static page per employee that has an ElevenLabs agent. */
export function generateStaticParams() {
  return directory.employees
    .filter((e) => e.is_signer && agentIdFor(e.id as EmployeeId))
    .map((e) => ({ employee: e.id }));
}

export default async function PlayPage({ params }: PageProps<"/play/[employee]">) {
  const { employee } = await params;
  const e = directory.employees.find((x) => x.id === employee && x.is_signer);
  if (!e || !agentIdFor(e.id as EmployeeId)) notFound();

  const floor = company.floors.find((f) => f.floor === e.floor);
  const card: EmployeeCard = {
    id: e.id as EmployeeId,
    name: e.name,
    title: e.title,
    floorName: floor?.name ?? `Floor ${e.floor}`,
  };
  return <ChatRoom card={card} />;
}
