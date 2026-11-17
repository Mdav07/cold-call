// Smoke test for server/chain/vault.ts against a local anvil node.
// Run with scripts/anvil-smoke.sh (it starts anvil, deploys a mock USDC and two vaults, sets env).
import assert from "node:assert/strict";
import type { Hex } from "viem";
import { runIdToBytes32, bytes32ToRunId } from "../server/chain/config";
import {
  VaultRevert,
  addressOf,
  getAllowlistProposal,
  getTransfer,
  isAllowlisted,
  sendVaultTx,
} from "../server/chain/vault";

const floor2 = process.env.SMOKE_FLOOR2 as Hex;
const floor3 = process.env.SMOKE_FLOOR3 as Hex;
const player = "0x00000000000000000000000000000000000000A1" as Hex;
const runUuid = "3f2b6c1e-8a4d-4f0e-9b7a-1c2d3e4f5a6b";
const runId = runIdToBytes32(runUuid);

async function expectRevert(status: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    assert.ok(err instanceof VaultRevert, `expected VaultRevert, got ${err}`);
    assert.equal(err.status, status);
    return;
  }
  assert.fail(`expected revert with status ${status}`);
}

async function main() {
  assert.equal(bytes32ToRunId(runId), runUuid);

  // Floor 2: propose, then the second approval executes.
  const proposed = await sendVaultTx("annie", floor2, {
    functionName: "proposeTransfer",
    args: [player, 2_000_000n, runId, "Quillfeather invoice"],
  });
  const names = proposed.events.map((e) => e.event.event);
  assert.deepEqual(names, ["TransferProposed", "TransferApproved"]);
  const first = proposed.events[0].event;
  assert.ok(first.event === "TransferProposed");
  assert.equal(first.amount, "2000000");
  assert.equal(first.runId, runId);
  const id = BigInt(first.id);
  assert.equal(proposed.simulated, id);

  const view = await getTransfer(floor2, id);
  assert.equal(view.to.toLowerCase(), player.toLowerCase());
  assert.equal(view.approvals, 1);

  await expectRevert("already_approved", () =>
    sendVaultTx("annie", floor2, { functionName: "approveTransfer", args: [id] }),
  );
  await expectRevert("over_cap", () =>
    sendVaultTx("annie", floor2, {
      functionName: "proposeTransfer",
      args: [player, 11_000_000n, runId, ""],
    }),
  );
  await expectRevert("denied", () =>
    sendVaultTx("penny", floor2, { functionName: "approveTransfer", args: [id] }),
  );

  const approved = await sendVaultTx("bill", floor2, { functionName: "approveTransfer", args: [id] });
  assert.ok(approved.events.some((e) => e.event.event === "TransferExecuted"));

  // Floor 3: a direct transfer is refused; allowlist add is queued behind the delay.
  await expectRevert("not_allowlisted", () =>
    sendVaultTx("cassius", floor3, {
      functionName: "proposeTransfer",
      args: [player, 1_000_000n, runId, ""],
    }),
  );
  const add = await sendVaultTx("cassius", floor3, {
    functionName: "proposeAllowlistAdd",
    args: [player, runId],
  });
  const addId = BigInt(add.simulated as bigint);
  const queued = await sendVaultTx("max", floor3, { functionName: "approveAllowlistAdd", args: [addId] });
  assert.ok(queued.events.some((e) => e.event.event === "AllowlistQueued"));
  assert.ok((await getAllowlistProposal(floor3, addId)).readyAt > 0n);
  assert.equal(await isAllowlisted(floor3, player), false);

  console.log("smoke ok; house", addressOf("house"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
