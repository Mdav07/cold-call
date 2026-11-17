// Thin wrapper (owner A). Logic lives in server/chain/tools.ts.
import { after, NextResponse, type NextRequest } from "next/server";
import { secretOk, TOOL_HANDLERS } from "@/server/chain/tools";
import { TOOL_SECRET_HEADER } from "@/shared/interfaces";

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!secretOk(req.headers.get(TOOL_SECRET_HEADER))) {
    return NextResponse.json({ status: "denied", message: "The request was refused." }, { status: 401 });
  }
  const { name } = await params;
  const handler = TOOL_HANDLERS[name];
  if (!handler) return NextResponse.json({ status: "not_found", message: "Unknown tool." }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "denied", message: "The request was refused." }, { status: 400 });
  }

  const [result, afterWork] = await handler(body as never);
  after(afterWork); // receipt backup ingest runs after the response is sent
  return NextResponse.json(result);
}
