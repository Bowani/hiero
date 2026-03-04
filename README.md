# @hiero-sdk/utils

> Production-ready utilities for building on the [Hiero](https://hiero.org) network ecosystem.

[![CI](https://github.com/hiero-community/hiero-sdk-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/hiero-community/hiero-sdk-utils/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hiero-sdk/utils)](https://www.npmjs.com/package/@hiero-sdk/utils)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)](https://www.typescriptlang.org/)

---

## What is this?

`@hiero-sdk/utils` is an **open-source, tree-shakeable TypeScript utility library** that makes it significantly easier to interact with Hiero/Hedera networks. It is designed to be adopted alongside (not replace) the official `@hashgraph/sdk`.

The library was inspired by the production integration patterns demonstrated in [hiero-enterprise-java](https://github.com/OpenElements/hiero-enterprise-java), bringing the same philosophy of clean APIs, typed abstractions, and developer ergonomics to the TypeScript ecosystem.

### What's included

| Module | Description |
|---|---|
| `@hiero-sdk/utils/mirror` | Typed Mirror Node REST client with retry, timeout, and pagination helpers |
| `@hiero-sdk/utils/scheduled` | Create, sign, and track scheduled transaction lifecycle |
| `@hiero-sdk/utils/react` | React / Next.js hooks for common Hiero data-fetching flows |

---

## Installation

```bash
npm install @hiero-sdk/utils @hashgraph/sdk
# React hooks (optional)
npm install react react-dom
```

> **Peer dependencies:** `@hashgraph/sdk >= 2.0.0` is always required. `react` and `react-dom` are optional and only needed for the React sub-module.

---

## Quick Start

### Mirror Node Client

```typescript
import { MirrorNodeClient } from "@hiero-sdk/utils/mirror";

const client = new MirrorNodeClient({ network: "testnet" });

// Fetch account info
const account = await client.getAccount("0.0.12345");
console.log(`Balance: ${account.balanceTinybars} tinybars`);
console.log(`Tokens:`, account.tokenBalances);

// Paginated transactions (manual paging)
const page = await client.getAccountTransactions("0.0.12345", { limit: 25, order: "desc" });
for (const tx of page.items) {
  console.log(tx.transactionId, tx.result);
}

// Auto-paginate all transactions (async generator)
for await (const tx of client.getAllAccountTransactions("0.0.12345")) {
  console.log(tx.transactionId);
}
```

### Token & NFT Queries

```typescript
// Fungible token info
const token = await client.getToken("0.0.99999");
console.log(`${token.name} (${token.symbol}) — ${token.totalSupply} supply`);

// Top holders
const holders = await client.getTokenHolders("0.0.99999", { limit: 10, order: "desc" });
for (const h of holders.items) {
  console.log(h.accountId, h.balance);
}

// NFT by serial number
const nft = await client.getNft("0.0.99999", 42);
console.log(`NFT #${nft.serialNumber} owned by ${nft.accountId}`);

// All NFTs owned by an account (async generator)
for await (const nft of client.getAllAccountNfts("0.0.99999", "0.0.12345")) {
  console.log(nft.serialNumber, nft.metadata);
}
```

### HCS Topic Messages

```typescript
// Fetch latest messages
const page = await client.getTopicMessages("0.0.88888", { limit: 10, order: "desc" });
for (const msg of page.items) {
  console.log(`#${msg.sequenceNumber}: ${msg.messageText}`);
}

// Stream all messages with async generator
for await (const msg of client.getAllTopicMessages("0.0.88888", { order: "asc" })) {
  console.log(msg.sequenceNumber, msg.messageText);
}
```

### Custom / Local Mirror Node

```typescript
const client = new MirrorNodeClient({
  baseUrl: "http://localhost:5551/api/v1",
  fetchOptions: { timeoutMs: 5_000, retries: 2 },
});
```

---

### Scheduled Transactions

```typescript
import { Client, TransferTransaction, Hbar } from "@hashgraph/sdk";
import {
  createScheduledTransaction,
  signScheduledTransaction,
  waitForScheduledTransaction,
} from "@hiero-sdk/utils/scheduled";

const hederaClient = Client.forTestnet().setOperator(operatorId, operatorKey);

// 1. Create a scheduled transfer
const inner = new TransferTransaction()
  .addHbarTransfer("0.0.12345", new Hbar(-1))
  .addHbarTransfer("0.0.67890", new Hbar(1));

const { scheduleId } = await createScheduledTransaction(hederaClient, {
  scheduledTransaction: inner,
  memo: "Weekly payroll run",
});
console.log("Schedule created:", scheduleId);

// 2. Collect additional required signatures
await signScheduledTransaction(hederaClient, scheduleId, cosignerKey);

// 3. Wait for execution (polls every 5s, timeout after 2 minutes)
const finalStatus = await waitForScheduledTransaction(hederaClient, scheduleId, {
  pollIntervalMs: 5_000,
  timeoutMs: 120_000,
  onPoll: (status) => console.log("Current status:", status),
});
console.log("Final status:", finalStatus); // "EXECUTED" | "DELETED" | "EXPIRED"
```

---

### React Hooks

```tsx
import { MirrorNodeClient } from "@hiero-sdk/utils/mirror";
import {
  useAccount,
  useToken,
  useAccountTransactions,
  useTopicMessages,
} from "@hiero-sdk/utils/react";

// Create the client once (memoize in real apps)
const mirrorClient = new MirrorNodeClient({ network: "mainnet" });

// Account balance display
function AccountBalance({ accountId }: { accountId: string }) {
  const { data: account, loading, error } = useAccount(mirrorClient, accountId);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <p>{account?.balanceTinybars} tinybars</p>;
}

// Infinite-scroll transaction list
function TransactionList({ accountId }: { accountId: string }) {
  const { data: txs, hasNextPage, fetchNextPage, fetchingNextPage } =
    useAccountTransactions(mirrorClient, accountId, { limit: 20 });

  return (
    <>
      {txs.map((tx) => <div key={tx.transactionId}>{tx.name} — {tx.result}</div>)}
      {hasNextPage && (
        <button onClick={fetchNextPage} disabled={fetchingNextPage}>
          {fetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

// Live-updating topic feed (polls every 5 seconds)
function TopicFeed({ topicId }: { topicId: string }) {
  const { data: messages } = useTopicMessages(mirrorClient, topicId, {
    order: "asc",
    pollIntervalMs: 5_000,
  });

  return (
    <ul>
      {messages.map((msg) => (
        <li key={msg.sequenceNumber}>#{msg.sequenceNumber}: {msg.messageText}</li>
      ))}
    </ul>
  );
}
```

---

## API Reference

### `MirrorNodeClient`

```typescript
new MirrorNodeClient(options?: {
  network?: "mainnet" | "testnet" | "previewnet"; // default: "mainnet"
  baseUrl?: string;           // override for custom mirror nodes
  fetchOptions?: {
    retries?: number;         // default: 3
    retryDelayMs?: number;    // default: 300ms (exponential backoff)
    timeoutMs?: number;       // default: 10,000ms
  };
})
```

**Methods:**

| Method | Returns |
|---|---|
| `getAccount(accountId)` | `Promise<AccountInfo>` |
| `getAccountTransactions(accountId, pagination?)` | `Promise<PaginatedResponse<TransactionRecord>>` |
| `getAllAccountTransactions(accountId, pagination?)` | `AsyncGenerator<TransactionRecord>` |
| `getToken(tokenId)` | `Promise<TokenInfo>` |
| `getNft(tokenId, serialNumber)` | `Promise<NftInfo>` |
| `getAccountNfts(tokenId, accountId, pagination?)` | `Promise<PaginatedResponse<NftInfo>>` |
| `getAllAccountNfts(tokenId, accountId, pagination?)` | `AsyncGenerator<NftInfo>` |
| `getTokenHolders(tokenId, pagination?)` | `Promise<PaginatedResponse<TokenHolder>>` |
| `getTopic(topicId)` | `Promise<TopicInfo>` |
| `getTopicMessages(topicId, pagination?)` | `Promise<PaginatedResponse<TopicMessage>>` |
| `getAllTopicMessages(topicId, pagination?)` | `AsyncGenerator<TopicMessage>` |

### Scheduled transaction helpers

| Function | Description |
|---|---|
| `createScheduledTransaction(client, options)` | Create a new scheduled transaction |
| `signScheduledTransaction(client, scheduleId, key)` | Add a signature to an existing schedule |
| `getScheduledTransactionStatus(client, scheduleId)` | Query current status |
| `waitForScheduledTransaction(client, scheduleId, options?)` | Poll until execution / timeout |

### React hooks

| Hook | Description |
|---|---|
| `useAccount(client, accountId)` | Fetch and display account info |
| `useAccountTransactions(client, accountId, options?)` | Paginated transaction feed |
| `useToken(client, tokenId)` | Fetch token metadata |
| `useAccountNfts(client, tokenId, accountId, options?)` | Paginated NFT gallery |
| `useTopicMessages(client, topicId, options?)` | HCS message feed with optional auto-poll |

---

## Error Handling

All errors extend `HieroError` and carry a `code` string:

```typescript
import { NotFoundError, MirrorNodeError, ScheduledTransactionTimeoutError } from "@hiero-sdk/utils";

try {
  const account = await client.getAccount("0.0.00000");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("Account does not exist");
  } else if (err instanceof MirrorNodeError) {
    console.log(`HTTP ${err.statusCode}: ${err.message}`);
  }
}
```

---

## Development

```bash
git clone https://github.com/hiero-community/hiero-sdk-utils.git
cd hiero-sdk-utils
npm install

npm run build        # compile TypeScript
npm test             # run all tests with coverage
npm run type-check   # type-check without emitting
npm run lint         # ESLint
npm run docs         # generate TypeDoc API docs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request process, commit signing requirements, and DCO sign-off instructions.

---

## License

[Apache 2.0](LICENSE) © Hiero Community Contributors
