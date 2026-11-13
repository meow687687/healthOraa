import { Activity, Package, Receipt, UserPlus, type LucideIcon } from "lucide-react";
import { EmptyState, SkeletonBlock } from "@healthoraa/ui";
import { ERROR_BOX } from "../ui/tokens";
import { formatIstDateTime } from "../../lib/format";
import { useRecentActivity, type ActivityEvent } from "../../hooks/useRecentActivity";
import { cn } from "../../lib/cn";

const ICON: Record<ActivityEvent["kind"], LucideIcon> = {
  order: Package,
  payment: Receipt,
  registration: UserPlus,
};

const TONE: Record<ActivityEvent["kind"], string> = {
  order: "text-accent-blue bg-accent-blue/10",
  payment: "text-accent-emerald bg-accent-emerald/10",
  registration: "text-accent-violet bg-accent-violet/10",
};

export function ActivityFeed({ onOpen }: { onOpen: (kind: ActivityEvent["kind"]) => void }) {
  const feed = useRecentActivity();

  return (
    <section aria-labelledby="activity-title" className="rounded-3xl border border-aura-line bg-aura-s1 p-5 shadow-aura-card md:p-6 lg:col-span-6">
      <h2 id="activity-title" className="text-base font-semibold text-text-primary">
        Recent activity
      </h2>
      <p className="mt-1 text-[13px] text-text-muted">Latest orders, payments and sign-ups</p>

      <div className="mt-5">
        {feed.isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading recent activity">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonBlock key={row} className="h-14" />
            ))}
          </div>
        ) : feed.isError ? (
          <div className="space-y-3">
            <div role="alert" className={ERROR_BOX}>{feed.error.message}</div>
            <button type="button" onClick={() => void feed.refetch()} className="min-h-[44px] rounded-full border border-aura-line2 px-4 text-[13px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer">
              Try again
            </button>
          </div>
        ) : feed.data.length === 0 ? (
          <EmptyState icon={Activity} title="Nothing yet" description="Orders, payments and sign-ups appear here as they happen." />
        ) : (
          <ul className="divide-y divide-aura-line">
            {feed.data.map((event) => {
              const Icon = ICON[event.kind];
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(event.kind)}
                    className="flex min-h-[56px] w-full items-center gap-4 py-3 text-left transition-colors duration-150 hover:bg-aura-s2/60 cursor-pointer"
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE[event.kind])}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">{event.title}</span>
                      <span className="block truncate font-mono text-[12px] text-text-muted">{event.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-text-muted">{formatIstDateTime(event.at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
