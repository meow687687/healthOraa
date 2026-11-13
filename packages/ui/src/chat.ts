// Adds an item to a list in time order, unless its id is already there. Realtime chat updates
// use this, so a message the browser already has is never shown twice.
export function appendByTime<T extends { id: string; createdAt: string }>(thread: T[], item: T): T[] {
  return thread.some((existing) => existing.id === item.id)
    ? thread
    : [...thread, item].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
