import { describe, expect, it, vi } from "vitest"
import { retryAccountIds, saveAccountTrades } from "./today-trade-save"

describe("saveAccountTrades", () => {
  it("applies successful rows during a partial multi-account insert", async () => {
    const applyInserted = vi.fn()
    const result = await saveAccountTrades({
      accountIds: ["a", "b"],
      create: async (id) => id === "a" ? { data: { id, date: "2026-08-01" }, error: null } : { data: null, error: new Error("failed") },
      applyInserted,
      reload: async () => true,
    })
    expect(result).toMatchObject({ successfulAccountIds: ["a"], failedAccountIds: ["b"], reloadSucceeded: true })
    expect(applyInserted).toHaveBeenCalledWith([{ id: "a", date: "2026-08-01" }])
    expect(retryAccountIds(result)).toEqual(["b"])
  })

  it("keeps the inserted update applied when the subsequent reload fails", async () => {
    const applyInserted = vi.fn()
    const result = await saveAccountTrades({
      accountIds: ["a"],
      create: async (id) => ({ data: { id }, error: null }),
      applyInserted,
      reload: async () => false,
    })
    expect(applyInserted).toHaveBeenCalledOnce()
    expect(result.reloadSucceeded).toBe(false)
  })

  it("keeps a successful row locally useful when refresh fails", async () => {
    const localRows: { id: string; accountId: string }[] = []
    await saveAccountTrades({
      accountIds: ["a"],
      create: async (accountId) => ({ data: { id: "trade-a", accountId }, error: null }),
      applyInserted: (inserted) => localRows.push(...inserted),
      reload: async () => false,
    })
    expect(localRows).toEqual([{ id: "trade-a", accountId: "a" }])
  })

  it("retries only failed account IDs and never inserts the successful account twice", async () => {
    const calls: string[] = []
    const first = await saveAccountTrades({
      accountIds: ["a", "b"],
      create: async (accountId) => {
        calls.push(accountId)
        return accountId === "a" ? { data: { accountId }, error: null } : { data: null, error: new Error("failed") }
      },
      applyInserted: () => undefined,
      reload: async () => false,
    })
    await saveAccountTrades({
      accountIds: retryAccountIds(first),
      create: async (accountId) => {
        calls.push(accountId)
        return { data: { accountId }, error: null }
      },
      applyInserted: () => undefined,
      reload: async () => true,
    })
    expect(calls).toEqual(["a", "b", "b"])
  })
})
