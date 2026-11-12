import { useState } from "react";
import type { FormEvent } from "react";
import type { BannerTargetType } from "@healthoraa/types";
import { BANNER_TARGET_TYPE_VALUES, createBannerSchema } from "@healthoraa/validation";
import type { CreateBannerInput } from "@healthoraa/validation";
import { useCreateBanner } from "../../hooks/useBanners";
import { BANNER_TARGET_META } from "./bannerMeta";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { cn } from "../../lib/cn";
import {
  BTN_PRIMARY_BLOCK,
  BTN_SECONDARY_BLOCK,
  ERROR_BOX,
  ERROR_TEXT,
  INPUT,
  LABEL,
} from "../ui/tokens";

interface CreateBannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BannerFormState {
  title: string;
  imageUrl: string;
  targetType: BannerTargetType;
  targetId: string;
  displayOrder: string;
}

type BannerFormErrors = Partial<Record<keyof BannerFormState, string>>;

const INITIAL_FORM: BannerFormState = {
  title: "",
  imageUrl: "",
  targetType: "program",
  targetId: "",
  displayOrder: "0",
};

const FORM_FIELD_BY_SCHEMA_KEY: Record<keyof CreateBannerInput, keyof BannerFormState> = {
  title: "title",
  image_url: "imageUrl",
  target_type: "targetType",
  target_id: "targetId",
  display_order: "displayOrder",
};

const toSchemaInput = (form: BannerFormState): Record<keyof CreateBannerInput, unknown> => ({
  title: form.title,
  image_url: form.imageUrl,
  target_type: form.targetType,
  target_id: form.targetId,
  display_order: form.displayOrder.trim() === "" ? undefined : Number(form.displayOrder),
});

const validateForm = (
  form: BannerFormState,
): { data: CreateBannerInput } | { errors: BannerFormErrors } => {
  const result = createBannerSchema.safeParse(toSchemaInput(form));
  if (result.success) return { data: result.data };

  const errors: BannerFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    const field = FORM_FIELD_BY_SCHEMA_KEY[key as keyof CreateBannerInput];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { errors };
};

export default function CreateBannerDrawer({ isOpen, onClose }: CreateBannerDrawerProps) {
  const [form, setForm] = useState<BannerFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<BannerFormErrors>({});
  const [imageFailed, setImageFailed] = useState(false);
  const createBanner = useCreateBanner();

  const update = <K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setImageFailed(false);
    createBanner.reset();
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm(form);
    if ("errors" in validation) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    createBanner.mutate(validation.data, { onSuccess: handleClose });
  };

  const previewUrl = form.imageUrl.trim();

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} labelledBy="create-banner-title">
      <DrawerHeader eyebrow="App Carousel" title="Create Banner" titleId="create-banner-title" onClose={handleClose}>
        <p className="text-xs text-text-secondary">Add a promotional card to the patient app carousel.</p>
      </DrawerHeader>

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 py-6">
          <div className="space-y-1.5">
            <label htmlFor="banner-title" className={LABEL}>
              Title
            </label>
            <input
              id="banner-title"
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Summer Detox Launch Offer"
              className={INPUT}
            />
            {errors.title && <p className={ERROR_TEXT}>{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="banner-image" className={LABEL}>
              Image URL
            </label>
            <input
              id="banner-image"
              type="url"
              value={form.imageUrl}
              onChange={(e) => {
                setImageFailed(false);
                update("imageUrl", e.target.value);
              }}
              placeholder="https://..."
              className={cn(INPUT, "font-mono text-xs")}
            />
            {errors.imageUrl && <p className={ERROR_TEXT}>{errors.imageUrl}</p>}
            {previewUrl && (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-aura-line bg-aura-s2">
                {imageFailed ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
                    Preview unavailable
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Banner preview"
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="banner-target-type" className={LABEL}>
                Target Type
              </label>
              <select
                id="banner-target-type"
                value={form.targetType}
                onChange={(e) => update("targetType", e.target.value as BannerTargetType)}
                className={INPUT}
              >
                {BANNER_TARGET_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {BANNER_TARGET_META[type].label}
                  </option>
                ))}
              </select>
              {errors.targetType && <p className={ERROR_TEXT}>{errors.targetType}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="banner-display-order" className={LABEL}>
                Display Order
              </label>
              <input
                id="banner-display-order"
                type="number"
                min={0}
                step={1}
                value={form.displayOrder}
                onChange={(e) => update("displayOrder", e.target.value)}
                className={cn(INPUT, "font-mono")}
              />
              {errors.displayOrder && <p className={ERROR_TEXT}>{errors.displayOrder}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="banner-target-id" className={LABEL}>
              Target ID
            </label>
            <input
              id="banner-target-id"
              type="text"
              value={form.targetId}
              onChange={(e) => update("targetId", e.target.value)}
              placeholder="Program, doctor or product ID (optional)"
              className={cn(INPUT, "font-mono text-xs")}
            />
            {errors.targetId && <p className={ERROR_TEXT}>{errors.targetId}</p>}
          </div>

          {createBanner.isError && <div className={ERROR_BOX}>{createBanner.error.message}</div>}
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-aura-line">
          <button type="submit" disabled={createBanner.isPending} className={BTN_PRIMARY_BLOCK}>
            {createBanner.isPending ? "Creating..." : "Create Banner"}
          </button>
          <button type="button" onClick={handleClose} className={BTN_SECONDARY_BLOCK}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  );
}
