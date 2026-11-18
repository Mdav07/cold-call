# QuickNode Stream: settings and filter

The Stream is the referee: it delivers every vault event to the game, which stops the run timer, writes the leaderboard row and fires the breach alarm.

| Setting | Value |
| --- | --- |
| Name | `coldcall-vault-events` |
| Network | Arc Testnet |
| Dataset | Block with Receipts (batches of 5 blocks; Arc requires batching) |
| Start block | 72648393 (the vaults' deploy block, so the leaderboard history is backfilled) |
| End | continuous until paused |
| Filter | JavaScript, below: keeps logs from our 4 vaults whose topic0 is one of the 12 game events, trimmed to `StreamLog` (`shared/interfaces.ts`) |
| Destination | Webhook `POST https://coldcall-olive.vercel.app/api/stream`, header `x-coldcall-stream-token` (value = `STREAM_WEBHOOK_TOKEN`, never committed) |
| Reorg / latest-block delay | off (the webhook is idempotent on tx hash + log index) |

Tested in QuickNode's filter editor on block 72650372 (the first Floor 1 heist): it returned only the Floor 1 vault's `TransferProposed` log out of 12 logs in the block.

```js
// QuickNode Streams filter for Cold Call (Arc testnet, dataset "Block with Receipts").
// Keeps only logs from our 4 vaults whose topic0 is one of our 12 game events, and trims each
// to the StreamLog shape in shared/interfaces.ts. Returns null (nothing sent) for other blocks.
function main(stream) {
  const VAULTS = [
    "0x1f74b2082b504746a6948c95cec0b0986e00ce8b", // tutorial
    "0x93af5ca91433115629bc53e970363e377227c8c5", // floor 1
    "0xa51d015653140086ad84f358feb5a7bf18078f7f", // floor 2
    "0x8c86dd235193d42bf4a751ba5138ff1286e28475", // floor 3 (no-delay vault; replaced 0x2dd6…e670)
  ];
  const TOPICS = [
    "0xef08a6750b9b2caecfc1338c6451efaac3c061feba9fe56a8d83827cf9ad8803", // TransferProposed
    "0xf72f94e700fa2e9818d8ec949b5f957a2114ab8d9fcb5fb4b942de3e7e1ee8ef", // TransferApproved
    "0x6b81e04f4485972ff4352adf67ad37d9eb8e0b1f47f69f2cc9ea6475fd29243a", // TransferRejected
    "0x80325e888c1c82b732ed61a3aaa950ae32a233290f74a648d1a3339666450345", // TransferCancelled
    "0xf9eb1dff17a5656d05a8c9a2762f5627b50e64fce77b761515ab22d6c7095dd2", // TransferExecuted
    "0xff4bfe44509d74118f1744858dd8fb8bbce5df7f43b0102a567b096914258b38", // AllowlistProposed
    "0xf4bae90b89530f906bb44018a017a6e388c27d3dd44e88f022dd63c2d14dbf39", // AllowlistApproved
    "0xd25391520b38613bc7a2c0518dbc8917ab7537899375ba3edf738031295f0909", // AllowlistRejected
    "0x44ce07deab81ff445949de4722ea0a6c6bd43480b48f1d24f88c0e2e6cfd3e72", // AllowlistCancelled
    "0x3838700610cdcea1620a9d8b838dad7b0683e54d7a13748cf79b7464f2859508", // AllowlistQueued
    "0x57d672913d57759c16e4970b345417a1e94c948e5e58f070c78fbb6b8b111c94", // AllowlistAdded
    "0x458680f79aa9de0ae06344287a3bd8ec6179faa05252e9af81ae734d6b4dc6ba", // AllowlistRemoved
  ];
  const num = (v) => (typeof v === "string" ? parseInt(v, v.startsWith("0x") ? 16 : 10) : v);

  const items = Array.isArray(stream.data) ? stream.data : [stream.data];
  const logs = [];
  for (const item of items) {
    if (!item) continue;
    const block = item.block || {};
    const blockTimestamp = block.timestamp != null ? num(block.timestamp) : null;
    const receipts = item.receipts || (Array.isArray(item) ? item : []);
    for (const r of receipts) {
      for (const log of r.logs || []) {
        const address = (log.address || "").toLowerCase();
        const topic0 = ((log.topics || [])[0] || "").toLowerCase();
        if (!VAULTS.includes(address) || !TOPICS.includes(topic0)) continue;
        logs.push({
          address: log.address,
          topics: log.topics,
          data: log.data,
          transactionHash: log.transactionHash,
          logIndex: num(log.logIndex),
          blockNumber: num(log.blockNumber),
          blockTimestamp,
        });
      }
    }
  }
  return logs.length ? { logs } : null;
}
```
