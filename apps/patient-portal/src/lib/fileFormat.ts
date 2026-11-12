// "412 KB" or "1.8 MB". Used for file-size badges.
export const formatFileSize = (bytes: number | null): string => {
  if (bytes === null) return "Size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const dayFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// Date-only strings are read as noon, so the day never shifts across time zones.
export const formatDocumentDate = (value: string): string =>
  dayFormatter.format(new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value));
