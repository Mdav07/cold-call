// Thin wrapper (owner A). Server-to-server only: needs the tool secret header.
// B's server code may also import ensurePlayerWallet directly.
import { NextResponse, type NextRequest } from "next/server";
import { ensurePlayerWallet } from "@/server/chain/players";
import { secretOk } from "@/server/chain/tools";
import { TOOL_SECRET_HEADER, type CreatePlayerWalletInput, type CreatePlayerWalletResult } from "@/shared/interfaces";

export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get(TOOL_SECRET_HEADER))) {
    return NextResponse.json({ error: "denied" }, { status: 401 });
  }
  try {
    const { user_id } = (await req.json()) as CreatePlayerWalletInput;
    const result: CreatePlayerWalletResult = { wallet_address: await ensurePlayerWallet(user_id) };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
