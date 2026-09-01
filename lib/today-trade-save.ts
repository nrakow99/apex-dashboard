export interface SaveResult<T> { data: T | null; error: Error | null }

export interface SaveAccountTradesResult<T> {
  inserted: T[]
  successfulAccountIds: string[]
  failedAccountIds: string[]
  reloadSucceeded: boolean
}

export function retryAccountIds<T>(result: SaveAccountTradesResult<T>): string[] {
  return [...result.failedAccountIds]
}

export async function saveAccountTrades<T>(input: {
  accountIds: readonly string[]
  create: (accountId: string) => Promise<SaveResult<T>>
  applyInserted: (inserted: T[]) => void
  reload: () => Promise<boolean>
}) {
  const results = await Promise.all(input.accountIds.map(input.create))
  const inserted = results.flatMap((result) => result.data ? [result.data] : [])
  const successfulAccountIds = results.flatMap((result, index) => result.data ? [input.accountIds[index]] : [])
  const failedAccountIds = results.flatMap((result, index) => result.data ? [] : [input.accountIds[index]])
  if (inserted.length) input.applyInserted(inserted)
  const reloadSucceeded = await input.reload()
  return { inserted, successfulAccountIds, failedAccountIds, reloadSucceeded } satisfies SaveAccountTradesResult<T>
}
