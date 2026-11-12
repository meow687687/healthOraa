import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DOCUMENT_CATEGORIES, localTodayKey, uploadDocumentSchema } from "@healthoraa/validation";
import type { UploadDocumentInput } from "@healthoraa/validation";
import { Drawer, DrawerHeader, ERROR_TEXT, INPUT, LABEL, cn } from "@healthoraa/ui";
import { useUploadDocument, validateDocumentFile } from "../../hooks/useHealthLocker";
import { DOCUMENT_CATEGORY_LABEL } from "./categoryLabels";
import { FileDropzone } from "./FileDropzone";

const SUBMIT =
  "bg-accent-blue hover:bg-accent-blue/90 text-white rounded-full font-semibold py-2.5 px-6 shadow-lg shadow-accent-blue-glow transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

const Field = ({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    {children}
    {error && <p className={ERROR_TEXT}>{error}</p>}
  </div>
);

export function UploadDocumentDrawer({ onClose }: { onClose: () => void }) {
  const upload = useUploadDocument();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<UploadDocumentInput>({
    resolver: zodResolver(uploadDocumentSchema),
    mode: "onTouched",
    defaultValues: { title: "", document_date: localTodayKey() },
  });
  const { errors } = formState;

  const pick = (candidate: File) => {
    const error = validateDocumentFile(candidate);
    setFileError(error);
    setFile(error ? null : candidate);
  };

  const onSubmit = async (values: UploadDocumentInput) => {
    if (!file) {
      setFileError("Choose a file to upload.");
      return;
    }
    try {
      await upload.mutateAsync({ ...values, file });
      onClose();
    } catch {
      // Shown below the submit button; the form keeps its values for a retry.
    }
  };

  return (
    <Drawer isOpen onClose={onClose} labelledBy="upload-title" className="max-w-xl p-6 md:p-8">
      <DrawerHeader eyebrow="Health Locker" title="Upload a document" titleId="upload-title" onClose={onClose} />

      <form id="upload-document" noValidate onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6 py-6">
        <FileDropzone id="upload-file" file={file} error={fileError} onPick={pick} />

        <Field id="upload-title-input" label="Document title" error={errors.title?.message}>
          <input
            id="upload-title-input"
            type="text"
            placeholder="For example: Lipid profile, October 2026"
            aria-invalid={Boolean(errors.title)}
            className={INPUT}
            {...register("title")}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="upload-category" label="Category" error={errors.category?.message}>
            <select id="upload-category" aria-invalid={Boolean(errors.category)} className={INPUT} {...register("category")}>
              <option value="">Select a category</option>
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </Field>

          <Field id="upload-date" label="Date on document" error={errors.document_date?.message}>
            <input
              id="upload-date"
              type="date"
              max={localTodayKey()}
              aria-invalid={Boolean(errors.document_date)}
              className={cn(INPUT, "font-mono")}
              {...register("document_date")}
            />
          </Field>
        </div>

        <p className="rounded-xl border border-aura-line bg-aura-s2 px-4 py-3 text-xs text-text-secondary">
          Kept for this session only. The file is not sent to the medical vault yet, so it is cleared when the page reloads.
        </p>

        {upload.isError && <p className={ERROR_TEXT}>{upload.error.message}</p>}

        <div className="flex justify-end border-t border-aura-line pt-5">
          <button type="submit" disabled={upload.isPending} className={SUBMIT}>
            {upload.isPending ? "Uploading..." : "Securely Upload to Medical Vault"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
