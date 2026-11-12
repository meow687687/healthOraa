import { useState } from "react";
import type { DragEvent } from "react";
import { FileUp } from "lucide-react";
import { DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from "@healthoraa/validation";
import { ERROR_TEXT, cn } from "@healthoraa/ui";
import { formatFileSize } from "../../lib/fileFormat";

// Drop target and file picker. Shows a highlight while a file is dragged over it.
export function FileDropzone({
  id,
  file,
  error,
  onPick,
}: {
  id: string;
  file: File | null;
  error: string | null;
  onPick: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onPick(dropped);
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-4 focus-within:ring-accent-blue/20",
          dragging && "border-accent-blue bg-accent-blue/10",
          !dragging && file && !error && "border-accent-emerald/40 bg-accent-emerald/5",
          !dragging && !file && "border-aura-line2 bg-aura-s2 hover:bg-aura-s3",
          error && "border-accent-red/40 bg-accent-red/5",
        )}
      >
        <FileUp className={cn("h-6 w-6", dragging ? "text-accent-blue" : "text-text-muted")} />
        {dragging ? (
          <p className="text-sm font-semibold text-accent-blue">Drop to add this file</p>
        ) : file ? (
          <p className="text-sm font-semibold text-text-primary">
            {file.name} <span className="font-mono text-xs font-normal text-text-muted">· {formatFileSize(file.size)}</span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Drag a PDF or image here, or <span className="font-semibold text-accent-blue">browse</span>
          </p>
        )}
        <p className="text-[11px] text-text-muted">PDF, JPEG or PNG, up to {DOCUMENT_MAX_BYTES / (1024 * 1024)} MB</p>
        <input
          id={id}
          type="file"
          accept={DOCUMENT_ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = "";
            if (picked) onPick(picked);
          }}
        />
      </label>
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}
