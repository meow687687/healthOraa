import { useEffect, useId, useState } from "react";
import type { ChangeEvent } from "react";
import { FileSignature, Upload, X } from "lucide-react";
import { ERROR_TEXT, PANEL, cn } from "@healthoraa/ui";

const ACCEPTED_TYPES: readonly string[] = ["image/png", "image/jpeg"];
const MAX_BYTES = 2 * 1024 * 1024;

// Preview only. The file stays in this tab; nothing is uploaded until signature storage exists.
export function DigitalSignatureCard() {
  const inputId = useId();
  const [preview, setPreview] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Release the object URL when it is replaced or the card unmounts.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Signature image must be 2 MB or smaller.");
      return;
    }
    setError(null);
    setPreview({ url: URL.createObjectURL(file) });
  };

  return (
    <section aria-labelledby="signature-title" className={cn(PANEL, "space-y-4")}>
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-accent-violet/20 bg-accent-violet/10 p-2 text-accent-violet">
          <FileSignature className="h-4 w-4" />
        </div>
        <div>
          <h3 id="signature-title" className="text-sm font-semibold text-text-primary">
            Digital signature
          </h3>
          <p className="text-xs text-text-muted">Upload a PNG or JPEG under 2 MB to preview how it looks.</p>
        </div>
      </div>

      <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-aura-line2 bg-aura-s2">
        {preview ? (
          <img src={preview.url} alt="Signature preview" className="max-h-28 object-contain" />
        ) : (
          <span className="text-xs text-text-muted">No signature uploaded</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-aura-s2 focus-within:ring-4 focus-within:ring-accent-blue/20"
        >
          <Upload className="h-3.5 w-3.5" />
          {preview ? "Replace signature" : "Upload signature"}
          <input id={inputId} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={handleFile} />
        </label>
        {preview && (
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}
      <p className="text-xs text-text-muted">Preview only. Signatures are not saved yet.</p>
    </section>
  );
}
