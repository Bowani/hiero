/**
 * @file Main Mirror Node client — composites all sub-modules behind a single object.
 */

import { HieroNetwork, MIRROR_NODE_URLS } from "../types/index.js";
import { FetchOptions } from "../utils/http.js";
import {
  AccountId,
  PaginatedResponse,
  PaginationOptions,
} from "../types/index.js";
import {
  AccountInfo,
  TransactionRecord,
  getAccount,
  getAccountTransactions,
  getAllAccountTransactions,
} from "./account.js";
import {
  TokenId,
  TokenInfo,
  NftInfo,
  TokenHolder,
  getToken,
  getNft,
  getAccountNfts,
  getAllAccountNfts,
  getTokenHolders,
} from "./token.js";
import {
  TopicId,
  TopicInfo,
  TopicMessage,
  getTopic,
  getTopicMessages,
  getAllTopicMessages,
} from "./topic.js";

export interface MirrorNodeClientOptions {
  /**
   * Network to connect to.
   * Ignored when `baseUrl` is provided.
   * @default "mainnet"
   */
  network?: HieroNetwork;
  /**
   * Override the Mirror Node base URL.
   * Useful for pointing at a custom / local mirror node.
   */
  baseUrl?: string;
  /** Default fetch options applied to every request. */
  fetchOptions?: FetchOptions;
}

/**
 * Typed Mirror Node client.
 *
 * @example
 * ```ts
 * import { MirrorNodeClient } from "@hiero-sdk/utils/mirror";
 *
 * const client = new MirrorNodeClient({ network: "testnet" });
 *
 * const account = await client.getAccount("0.0.12345");
 * console.log(account.balanceTinybars);
 *
 * // Paginated transactions
 * const page = await client.getAccountTransactions("0.0.12345", { limit: 10 });
 * for (const tx of page.items) { ... }
 *
 * // Iterate all pages automatically
 * for await (const tx of client.getAllAccountTransactions("0.0.12345")) {
 *   console.log(tx.transactionId);
 * }
 * ```
 */
export class MirrorNodeClient {
  private readonly baseUrl: string;
  private readonly defaultFetchOptions: FetchOptions;

  constructor(options: MirrorNodeClientOptions = {}) {
    const { network = "mainnet", baseUrl, fetchOptions = {} } = options;
    this.baseUrl = baseUrl ?? MIRROR_NODE_URLS[network];
    this.defaultFetchOptions = fetchOptions;
  }

  // ─── Accounts ──────────────────────────────────────────────────────────────

  /** Fetch account info. */
  getAccount(accountId: AccountId, opts?: FetchOptions): Promise<AccountInfo> {
    return getAccount(this.baseUrl, accountId, this.merge(opts));
  }

  /** Fetch one page of account transactions. */
  getAccountTransactions(
    accountId: AccountId,
    pagination?: PaginationOptions,
    opts?: FetchOptions
  ): Promise<PaginatedResponse<TransactionRecord>> {
    return getAccountTransactions(this.baseUrl, accountId, pagination, this.merge(opts));
  }

  /** Iterate all transactions for an account across pages. */
  getAllAccountTransactions(
    accountId: AccountId,
    pagination?: Omit<PaginationOptions, "nextLink">,
    opts?: FetchOptions
  ): AsyncGenerator<TransactionRecord> {
    return getAllAccountTransactions(this.baseUrl, accountId, pagination, this.merge(opts));
  }

  // ─── Tokens ────────────────────────────────────────────────────────────────

  /** Fetch token info. */
  getToken(tokenId: TokenId, opts?: FetchOptions): Promise<TokenInfo> {
    return getToken(this.baseUrl, tokenId, this.merge(opts));
  }

  /** Fetch a single NFT by serial number. */
  getNft(tokenId: TokenId, serialNumber: number, opts?: FetchOptions): Promise<NftInfo> {
    return getNft(this.baseUrl, tokenId, serialNumber, this.merge(opts));
  }

  /** Fetch one page of NFTs owned by an account. */
  getAccountNfts(
    tokenId: TokenId,
    accountId: AccountId,
    pagination?: PaginationOptions,
    opts?: FetchOptions
  ): Promise<PaginatedResponse<NftInfo>> {
    return getAccountNfts(this.baseUrl, tokenId, accountId, pagination, this.merge(opts));
  }

  /** Iterate all NFTs owned by an account. */
  getAllAccountNfts(
    tokenId: TokenId,
    accountId: AccountId,
    pagination?: Omit<PaginationOptions, "nextLink">,
    opts?: FetchOptions
  ): AsyncGenerator<NftInfo> {
    return getAllAccountNfts(this.baseUrl, tokenId, accountId, pagination, this.merge(opts));
  }

  /** Fetch one page of fungible-token holders. */
  getTokenHolders(
    tokenId: TokenId,
    pagination?: PaginationOptions,
    opts?: FetchOptions
  ): Promise<PaginatedResponse<TokenHolder>> {
    return getTokenHolders(this.baseUrl, tokenId, pagination, this.merge(opts));
  }

  // ─── Topics ────────────────────────────────────────────────────────────────

  /** Fetch HCS topic info. */
  getTopic(topicId: TopicId, opts?: FetchOptions): Promise<TopicInfo> {
    return getTopic(this.baseUrl, topicId, this.merge(opts));
  }

  /** Fetch one page of HCS messages. */
  getTopicMessages(
    topicId: TopicId,
    pagination?: PaginationOptions,
    opts?: FetchOptions
  ): Promise<PaginatedResponse<TopicMessage>> {
    return getTopicMessages(this.baseUrl, topicId, pagination, this.merge(opts));
  }

  /** Iterate all HCS messages for a topic. */
  getAllTopicMessages(
    topicId: TopicId,
    pagination?: Omit<PaginationOptions, "nextLink">,
    opts?: FetchOptions
  ): AsyncGenerator<TopicMessage> {
    return getAllTopicMessages(this.baseUrl, topicId, pagination, this.merge(opts));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Returns the resolved base URL (useful for debugging). */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  private merge(opts?: FetchOptions): FetchOptions {
    return { ...this.defaultFetchOptions, ...opts };
  }
}
