import { Shield } from "lucide-react";
import { PortalRail } from "@healthoraa/ui";
import { NAV_GROUPS, type TabId } from "./navConfig";

// Phone bottom bar: three most used sections, then More for the rest.
const PHONE_PRIMARY: TabId[] = ["overview", "orders", "practitioners"];

export function AdminRail({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  return (
    <PortalRail
      groups={NAV_GROUPS}
      active={active}
      onSelect={onSelect}
      phonePrimary={PHONE_PRIMARY}
      footer={
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent-emerald" aria-hidden="true" />
          Admin access only
        </span>
      }
    />
  );
}
