import { EmptyState } from "@healthoraa/ui";
import { useState } from "react";
import { ArrowDown, ArrowUp, ImageOff, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import type { AppBanner } from "@healthoraa/types";
import {
  useBanners,
  useDeleteBanner,
  useToggleBannerActive,
  useUpdateBannerOrder,
} from "../../hooks/useBanners";
import CreateBannerDrawer from "./CreateBannerDrawer";
import { BANNER_TARGET_META } from "./bannerMeta";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { BTN_PRIMARY, ERROR_BOX, PANEL, ROW_MICRO } from "../ui/tokens";
import { cn } from "../../lib/cn";

function BannerCard({
  banner,
  rank,
  isFirst,
  isLast,
  busy,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  banner: AppBanner;
  rank: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = BANNER_TARGET_META[banner.target_type];

  return (
    <article className="group relative bg-aura-s2 border border-aura-line rounded-2xl overflow-hidden shadow-aura-card">
      <div className="relative aspect-video bg-aura-s3">
        {imageFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-text-muted">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs font-mono">Image unavailable</span>
          </div>
        ) : (
          <img
            src={banner.image_url}
            alt={banner.title}
            onError={() => setImageFailed(true)}
            className={cn("h-full w-full object-cover transition-opacity", !banner.is_active && "opacity-40")}
          />
        )}

        <span className="absolute top-3 left-3 inline-flex items-center justify-center h-8 px-3 rounded-full bg-aura-canvas/90 border border-aura-line2 text-xs font-mono font-bold tabular-nums text-text-primary">
          #{rank}
        </span>

        <div className="pointer-events-none group-hover:pointer-events-auto absolute inset-x-3 bottom-3 flex justify-center">
          <RowActions>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={busy || isFirst}
              title="Move up in carousel"
              aria-label="Move up in carousel"
              className={ROW_MICRO}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={busy || isLast}
              title="Move down in carousel"
              aria-label="Move down in carousel"
              className={ROW_MICRO}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              title="Delete banner"
              aria-label="Delete banner"
              className={ROW_MICRO}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </RowActions>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary truncate">{banner.title}</p>
            <p className="text-xs font-mono text-text-muted truncate">{banner.target_id ?? "No target set"}</p>
          </div>
          <ActiveSwitch
            checked={banner.is_active}
            disabled={busy}
            label={`Toggle ${banner.title} active`}
            onChange={onToggle}
          />
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
    </article>
  );
}

export default function BannersView() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { data: banners, isLoading, isError, error } = useBanners();
  const toggleActive = useToggleBannerActive();
  const updateOrder = useUpdateBannerOrder();
  const deleteBanner = useDeleteBanner();

  const busyId = toggleActive.isPending
    ? toggleActive.variables?.id
    : updateOrder.isPending
      ? updateOrder.variables?.id
      : deleteBanner.isPending
        ? deleteBanner.variables?.id
        : undefined;

  const activeCount = banners?.filter((b) => b.is_active).length ?? 0;

  // Swap display_order with the neighbouring banner so ranks stay unique and ordered.
  const move = (index: number, direction: -1 | 1) => {
    if (!banners) return;
    const current = banners[index];
    const neighbour = banners[index + direction];
    if (!current || !neighbour) return;
    updateOrder.mutate({ id: current.id, displayOrder: neighbour.display_order });
    updateOrder.mutate({ id: neighbour.id, displayOrder: current.display_order });
  };

  const mutationError = toggleActive.error ?? updateOrder.error ?? deleteBanner.error;

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Megaphone}
        tone="amber"
        title="App Banners"
        subtitle={
          banners
            ? `${banners.length} banner${banners.length === 1 ? "" : "s"} · ${activeCount} live in carousel`
            : "Loading banners..."
        }
        action={
          <button type="button" onClick={() => setIsDrawerOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" />
            Create Banner
          </button>
        }
      />

      <div className={PANEL}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading banners...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load banners: {error.message}</div>}

        {!isLoading && !isError && banners?.length === 0 && (
          <EmptyState
            icon={Megaphone}
            title="No banners yet"
            description="Create a banner to feature a program, doctor or product on the home carousel."
            action={{ label: "Create Banner", onClick: () => setIsDrawerOpen(true) }}
            className="border-0 bg-transparent shadow-none"
          />
        )}

        {!isLoading && !isError && banners && banners.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {banners.map((banner, index) => (
              <BannerCard
                key={banner.id}
                banner={banner}
                rank={index + 1}
                isFirst={index === 0}
                isLast={index === banners.length - 1}
                busy={busyId === banner.id}
                onToggle={(next) => toggleActive.mutate({ id: banner.id, isActive: next })}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onDelete={() => deleteBanner.mutate({ id: banner.id })}
              />
            ))}
          </div>
        )}

        {mutationError && <p className={cn(ERROR_BOX, "mt-6")}>{mutationError.message}</p>}
      </div>

      <CreateBannerDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
