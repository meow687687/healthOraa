// Builds an iCalendar file for one appointment. Opens in any calendar app.
const toUtcStamp = (iso: string): string => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeText = (value: string): string => value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");

export const buildAppointmentIcs = (input: {
  reference: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
}): string =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Healthoraa//Patient Portal//EN",
    "BEGIN:VEVENT",
    `UID:${input.reference}@healthoraa`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(input.startsAt)}`,
    `DTEND:${toUtcStamp(input.endsAt)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

export const downloadIcs = (content: string, fileName: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
