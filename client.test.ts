/**
 * @file Unit tests for the Mirror Node client.
 *
 * Uses Jest's fetch mock to avoid real network calls.
 */

import { MirrorNodeClient } from "../../src/mirror/client";
import { MirrorNodeError, NotFoundError } from "../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): jest.SpyInstance {
  return jest.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

// ─── Account ──────────────────────────────────────────────────────────────────

const RAW_ACCOUNT = {
  account: "0.0.12345",
  alias: null,
  auto_renew_period: 7776000,
  balance: {
    balance: 1000000000,
    timestamp: "1700000000.000000000",
    tokens: [{ token_id: "0.0.99999", balance: 50 }],
  },
  created_timestamp: "1690000000.000000000",
  deleted: false,
  ethereum_nonce: null,
  evm_address: null,
  expiry_timestamp: null,
  key: null,
  max_automatic_token_associations: 0,
  memo: "test account",
  receiver_sig_required: false,
  staked_account_id: null,
  staked_node_id: null,
  stake_period_start: null,
};

describe("MirrorNodeClient — accounts", () => {
  afterEach(() => jest.restoreAllMocks());

  it("maps raw account to AccountInfo correctly", async () => {
    mockFetch(RAW_ACCOUNT);
    const client = new MirrorNodeClient({ network: "testnet" });
    const account = await client.getAccount("0.0.12345");

    expect(account.accountId).toBe("0.0.12345");
    expect(account.balanceTinybars).toBe("1000000000");
    expect(account.tokenBalances).toEqual([{ tokenId: "0.0.99999", balance: 50 }]);
    expect(account.deleted).toBe(false);
    expect(account.memo).toBe("test account");
  });

  it("throws NotFoundError on 404", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
      text: async () => "",
    } as Response);

    const client = new MirrorNodeClient({ network: "testnet" });
    await expect(client.getAccount("0.0.99999999")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns paginated transactions", async () => {
    mockFetch({
      transactions: [
        {
          consensus_timestamp: "1700000001.000000000",
          transaction_hash: "abc123",
          transaction_id: "0.0.12345@1700000000.000000000",
          name: "CRYPTOTRANSFER",
          result: "SUCCESS",
          charged_tx_fee: 500000,
          transfers: [{ account: "0.0.12345", amount: -500000, is_approval: false }],
        },
      ],
      links: { next: null },
    });

    const client = new MirrorNodeClient({ network: "testnet" });
    const page = await client.getAccountTransactions("0.0.12345", { limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.transactionId).toBe("0.0.12345@1700000000.000000000");
    expect(page.items[0]?.name).toBe("CRYPTOTRANSFER");
    expect(page.nextLink).toBeNull();
  });

  it("getAllAccountTransactions yields items across pages", async () => {
    const makeTx = (id: string) => ({
      consensus_timestamp: "1700000001.000000000",
      transaction_hash: id,
      transaction_id: id,
      name: "CRYPTOTRANSFER",
      result: "SUCCESS",
      charged_tx_fee: 100,
      transfers: [],
    });

    // Page 1
    mockFetch({ transactions: [makeTx("tx-1")], links: { next: "/api/v1/transactions?page=2" } });
    // Page 2
    mockFetch({ transactions: [makeTx("tx-2")], links: { next: null } });

    const client = new MirrorNodeClient({ network: "testnet" });
    const all: string[] = [];
    for await (const tx of client.getAllAccountTransactions("0.0.12345")) {
      all.push(tx.transactionHash);
    }

    expect(all).toEqual(["tx-1", "tx-2"]);
  });
});

// ─── Token ────────────────────────────────────────────────────────────────────

const RAW_TOKEN = {
  token_id: "0.0.99999",
  name: "TestToken",
  symbol: "TST",
  decimals: 8,
  total_supply: "1000000",
  max_supply: "0",
  initial_supply: "1000000",
  treasury_account_id: "0.0.1000",
  type: "FUNGIBLE_COMMON",
  supply_type: "INFINITE",
  freeze_default: false,
  created_timestamp: "1690000000.000000000",
  deleted: false,
  memo: "",
  custom_fees: { created_timestamp: "1690000000.000000000", fixed_fees: [], fractional_fees: [], royalty_fees: [] },
};

describe("MirrorNodeClient — tokens", () => {
  afterEach(() => jest.restoreAllMocks());

  it("maps raw token to TokenInfo correctly", async () => {
    mockFetch(RAW_TOKEN);
    const client = new MirrorNodeClient({ network: "testnet" });
    const token = await client.getToken("0.0.99999");

    expect(token.tokenId).toBe("0.0.99999");
    expect(token.name).toBe("TestToken");
    expect(token.symbol).toBe("TST");
    expect(token.decimals).toBe(8);
    expect(token.type).toBe("FUNGIBLE_COMMON");
    expect(token.supplyType).toBe("INFINITE");
  });

  it("throws MirrorNodeError on 500", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
      text: async () => "server error",
    } as Response);

    const client = new MirrorNodeClient({ network: "testnet" });
    await expect(client.getToken("0.0.99999")).rejects.toBeInstanceOf(MirrorNodeError);
  });

  it("paginates token holders", async () => {
    mockFetch({
      balances: [
        { account: "0.0.100", balance: 500 },
        { account: "0.0.200", balance: 300 },
      ],
      links: { next: null },
    });

    const client = new MirrorNodeClient({ network: "testnet" });
    const page = await client.getTokenHolders("0.0.99999", { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({ accountId: "0.0.100", balance: 500 });
    expect(page.nextLink).toBeNull();
  });
});

// ─── Topics ───────────────────────────────────────────────────────────────────

describe("MirrorNodeClient — topics", () => {
  afterEach(() => jest.restoreAllMocks());

  it("decodes base64 message text", async () => {
    const messageB64 = Buffer.from("Hello Hiero!").toString("base64");
    mockFetch({
      messages: [
        {
          consensus_timestamp: "1700000001.000000000",
          message: messageB64,
          payer_account_id: "0.0.12345",
          running_hash: "abc",
          running_hash_version: 3,
          sequence_number: 1,
          topic_id: "0.0.88888",
          chunk_info: null,
        },
      ],
      links: { next: null },
    });

    const client = new MirrorNodeClient({ network: "testnet" });
    const page = await client.getTopicMessages("0.0.88888");

    expect(page.items[0]?.messageText).toBe("Hello Hiero!");
    expect(page.items[0]?.sequenceNumber).toBe(1);
  });

  it("uses custom baseUrl when provided", async () => {
    mockFetch({ topic_id: "0.0.88888", memo: "", created_timestamp: "1690000000.000000000", deleted: false, auto_renew_account: null, auto_renew_period: null, admin_key: null, submit_key: null, timestamp: { from: "1690000000.000000000", to: null } });

    const client = new MirrorNodeClient({ baseUrl: "https://my-mirror.example.com/api/v1" });
    expect(client.getBaseUrl()).toBe("https://my-mirror.example.com/api/v1");

    const topic = await client.getTopic("0.0.88888");
    expect(topic.topicId).toBe("0.0.88888");
  });
});

// ─── Error types ──────────────────────────────────────────────────────────────

describe("Error types", () => {
  it("NotFoundError is a MirrorNodeError with code MIRROR_NODE_404", () => {
    const err = new NotFoundError("Account", "0.0.99999");
    expect(err).toBeInstanceOf(MirrorNodeError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("MIRROR_NODE_404");
    expect(err.name).toBe("NotFoundError");
  });
});
