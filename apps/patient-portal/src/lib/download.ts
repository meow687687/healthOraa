import type { LockerDocument } from "../types/locker";
import { createRecordLink } from "./recordFiles";

// Saves a blob through a temporary object URL.
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

// Uploads download their original file, demo documents download their summary as text.
export const downloadLocalDocument = (doc: LockerDocument): void => {
  if (doc.file) {
    saveBlob(doc.file, doc.file.name);
    return;
  }
  if (doc.summary) {
    const body = `${doc.title}\nDate: ${doc.documentDate}\n\n${doc.summary}\n`;
    saveBlob(new Blob([body], { type: "text/plain" }), `${doc.title}.txt`);
  }
};

// Database records download through a fresh 60-second signed link.
export const downloadRecord = async (doc: LockerDocument): Promise<void> => {
  if (!doc.filePath) return;
  const url = await createRecordLink(doc.filePath);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.title;
  link.click();
};
