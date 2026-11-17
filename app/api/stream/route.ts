// Thin wrapper (owner A). QuickNode Stream webhook: the normal writer of chain state.
// Body: { logs: StreamLog[] } (see shared/interfaces.ts). Idempotent on (tx_hash, log_index).
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { Hex } from "viem";
import { ingestEvents } from "@/server/chain/ingest";
import { decodeVaultLogs } from "@/server/chain/vault";
import { STREAM_TOKEN_HEADER, type StreamLog } from "@/shared/interfaces";

export const maxDuration = 60;

function tokenOk(header: string | null): boolean {
  const want = process.env.STREAM_WEBHOOK_TOKEN;
  if (!want || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const num = (v: unknown) => (typeof v === "string" ? Number(BigInt(v)) : Number(v));

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get(STREAM_TOKEN_HEADER))) {
    return NextResponse.json({ error: "denied" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // an empty body means a block with no vault logs
  }
  // Accept { logs: [...] }, a bare array, or an array of such batches.
  const batches = Array.isArray(body) ? body : [body];
  const logs: StreamLog[] = batches.flatMap((b) =>
    Array.isArray(b) ? b : Array.isArray((b as { logs?: unknown })?.logs) ? (b as { logs: StreamLog[] }).logs : b && (b as StreamLog).topics ? [b as StreamLog] : [],
  );
  if (!logs.length) return NextResponse.json({ received: 0, fresh: 0 });

  const decoded = decodeVaultLogs(
    logs.map((l) => ({
      address: l.address,
      topics: l.topics as [Hex, ...Hex[]],
      data: l.data,
      transactionHash: l.transactionHash,
      logIndex: num(l.logIndex),
      blockNumber: BigInt(l.blockNumber),
    })),
  );
  // In order: a proposal must exist before its approval or execution is applied.
  decoded.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));

  try {
    const fresh = await ingestEvents(decoded, "stream");
    return NextResponse.json({ received: decoded.length, fresh });
  } catch (err) {
    console.error("stream ingest failed", err);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 }); // QuickNode retries
  }
}
