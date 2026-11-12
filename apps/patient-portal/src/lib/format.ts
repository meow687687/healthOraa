const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));
export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));
