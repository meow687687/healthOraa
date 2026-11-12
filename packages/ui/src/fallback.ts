// Runs a Supabase list query. Falls back when the query fails or returns no rows.
// Errors are logged, not thrown, so the view keeps rendering in prototype mode.
export const withFallback = async <T>(
  load: () => Promise<T[]>,
  fallback: T[],
  label: string,
): Promise<T[]> => {
  try {
    const rows = await load();
    if (rows.length > 0) return rows;
  } catch (err) {
    console.warn(`[ui] ${label}: query failed, using client fallback`, err);
    return fallback;
  }
  return fallback;
};

// Single-record variant: falls back when the query fails or throws. Callers signal "not found" by throwing.
export const withSingleFallback = async <T>(load: () => Promise<T>, fallback: T, label: string): Promise<T> => {
  try {
    return await load();
  } catch (err) {
    console.warn(`[ui] ${label}: query failed, using client fallback`, err);
    return fallback;
  }
};
