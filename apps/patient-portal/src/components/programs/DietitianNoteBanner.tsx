import { MessageSquareText } from "lucide-react";
import { formatDate } from "../../lib/format";
import type { ProgramNote } from "../../types/program";

export function DietitianNoteBanner({ note, nutritionistName }: { note: ProgramNote | null; nutritionistName: string | null }) {
  return (
    <section
      aria-labelledby="dietitian-note-title"
      className="flex gap-4 rounded-3xl border border-accent-violet/20 bg-accent-violet/10 p-5"
    >
      <div className="h-fit shrink-0 rounded-full border border-accent-violet/20 bg-accent-violet/10 p-2 text-accent-violet">
        <MessageSquareText className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 id="dietitian-note-title" className="text-sm font-semibold text-accent-violet">
          Note from {nutritionistName ?? "your dietitian"}
        </h3>
        <p className="text-sm leading-relaxed text-text-primary">
          {note ? note.body : "No note from your dietitian yet."}
        </p>
        {note && <p className="font-mono text-[11px] text-text-muted">{formatDate(note.postedAt)}</p>}
      </div>
    </section>
  );
}
