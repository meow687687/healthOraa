import { useState } from "react";
import { Download, FileCheck2, Loader2, Trash2 } from "lucide-react";
import type { ComplianceRequestStatus, ComplianceRequestType } from "@healthoraa/types";
import { useComplianceRequests, useResolveComplianceRequest } from "../../hooks/useCompliance";
import type { ComplianceRequestWithUser } from "../../hooks/useCompliance";
import { buildExportPacket, downloadJson } from "./exportPacket";
import { Badge } from "../ui/Badge";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import {
  BTN_DANGER_SM,
  BTN_TEXT,
  ERROR_BOX,
  NUM,
  PANEL,
  ROW_MICRO,
  TABLE_HEAD,
  type Tone,
} from "../ui/tokens";
import { cn } from "../../lib/cn";

const TYPE_META: Record<ComplianceRequestType, { label: string; tone: Tone }> = {
  data_export: { label: "Data Export", tone: "blue" },
  erasure_request: { label: "Erasure", tone: "red" },
  consent_withdrawal: { label: "Consent Withdrawal", tone: "violet" },
};

const STATUS_META: Record<ComplianceRequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  processing: { label: "Processing", tone: "amber" },
  completed: { label: "Completed", tone: "emerald" },
  rejected: { label: "Rejected", tone: "red" },
};

export default function ComplianceView() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data: requests, isLoading, isError, error } = useComplianceRequests();
  const resolve = useResolveComplianceRequest();

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const busyId = resolve.isPending ? resolve.variables?.request.id : undefined;

  const handleExport = async (request: ComplianceRequestWithUser) => {
    setExportError(null);
    setExportingId(request.id);
    try {
      const packet = await buildExportPacket(request.user_id);
      downloadJson(packet, `healthoraa-export-${request.user_id.slice(0, 8)}.json`);
      resolve.mutate({ request, action: "complete" });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExportingId(null);
    }
  };

  const handleErase = (request: ComplianceRequestWithUser) => {
    resolve.mutate({ request, action: "erase" }, { onSuccess: () => setConfirmingId(null) });
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={FileCheck2}
        tone="emerald"
        title="DPDPA Requests"
        subtitle={
          requests
            ? `${requests.length} request${requests.length === 1 ? "" : "s"} · ${pendingCount} awaiting resolution`
            : "Loading requests..."
        }
        action={<Badge tone="blue">DPDPA 2023</Badge>}
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading requests...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load requests: {error.message}</div>}

        {!isLoading && !isError && requests?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-semibold text-text-primary">No requests</p>
            <p className="text-xs text-text-muted">Data export, erasure and consent withdrawal requests appear here.</p>
          </div>
        )}

        {!isLoading && !isError && requests && requests.length > 0 && (
          <>
            <div className="space-y-3 px-4 py-4 md:hidden">
              {requests.map((request) => {
                const isOpen = request.status === "pending" || request.status === "processing";
                const busy = busyId === request.id || exportingId === request.id;
                const confirming = confirmingId === request.id;
                const typeMeta = TYPE_META[request.request_type];
                const statusMeta = STATUS_META[request.status];
                return (
                  <article key={request.id} className="rounded-2xl border border-aura-line bg-aura-s2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-text-primary">{request.profiles?.full_name ?? "Unknown user"}</h3>
                        <p className="mt-1 text-xs text-text-muted">{request.profiles?.role ?? "—"} · {request.user_id.slice(0, 8)}</p>
                      </div>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-aura-s1/70 p-3 sm:grid-cols-2">
                      <div><dt className="text-[11px] text-text-muted">Request</dt><dd className="mt-1"><Badge tone={typeMeta.tone}>{typeMeta.label}</Badge></dd></div>
                      <div><dt className="text-[11px] text-text-muted">Submitted</dt><dd className={cn("mt-1", NUM)}>{new Date(request.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</dd></div>
                    </dl>
                    {isOpen ? (
                      confirming ? (
                        <div className="mt-4 space-y-3 rounded-xl border border-accent-red/25 bg-accent-red/5 p-3">
                          <p className="text-xs text-accent-red">Anonymise this user&apos;s name, phone and avatar? This cannot be undone.</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setConfirmingId(null)} className={cn(BTN_TEXT, "min-h-10 flex-1")}>Cancel</button>
                            <button type="button" onClick={() => handleErase(request)} disabled={busy} className={cn(BTN_DANGER_SM, "min-h-10 flex-1")}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Confirm Erasure</button>
                          </div>
                        </div>
                      ) : request.request_type === "erasure_request" ? (
                        <button type="button" onClick={() => setConfirmingId(request.id)} disabled={busy} className="mt-4 min-h-11 w-full rounded-xl border border-accent-red/30 bg-accent-red/5 px-3 text-sm font-semibold text-accent-red disabled:opacity-50">
                          <Trash2 className="mr-2 inline h-4 w-4" />Review erasure request
                        </button>
                      ) : (
                        <button type="button" onClick={() => void handleExport(request)} disabled={busy} className="mt-4 min-h-11 w-full rounded-xl border border-aura-line2 bg-aura-s1 px-3 text-sm font-semibold text-text-primary disabled:opacity-50">
                          {busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Download className="mr-2 inline h-4 w-4" />}
                          Export JSON packet
                        </button>
                      )
                    ) : (
                      <div className="mt-4 rounded-xl bg-aura-s1/70 p-3 text-xs text-text-muted">
                        <p>{request.resolved_at ? `Resolved ${new Date(request.resolved_at).toLocaleDateString("en-IN")}` : "Resolved"}</p>
                        {request.notes && request.status === "completed" && <p className="mt-2">{request.notes}</p>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="table-scroll -mx-6 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Request</th>
                  <th className="px-6 py-4 font-medium">Submitted</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Resolution</th>
                  <th className="px-6 py-4 font-medium w-24" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isOpen = request.status === "pending" || request.status === "processing";
                  const busy = busyId === request.id || exportingId === request.id;
                  const confirming = confirmingId === request.id;
                  const typeMeta = TYPE_META[request.request_type];
                  const statusMeta = STATUS_META[request.status];
                  return (
                    <tr
                      key={request.id}
                      className="group border-b border-aura-line last:border-0 hover:bg-aura-s2/60 transition-colors align-top"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{request.profiles?.full_name ?? "Unknown user"}</p>
                        <p className="text-xs font-mono text-text-muted">
                          {request.profiles?.role ?? "—"} · {request.user_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                      </td>
                      <td className={cn("px-6 py-4", NUM)}>
                        {new Date(request.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {request.notes && request.status === "completed" && (
                          <p className="mt-2 max-w-xs text-xs text-text-muted line-clamp-2">{request.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!isOpen ? (
                          <span className="text-xs text-text-muted">
                            {request.resolved_at
                              ? `Resolved ${new Date(request.resolved_at).toLocaleDateString("en-IN")}`
                              : "Resolved"}
                          </span>
                        ) : confirming ? (
                          <div className="space-y-2 max-w-xs">
                            <p className="text-xs text-accent-red">
                              Anonymise this user&apos;s name, phone and avatar? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setConfirmingId(null)} className={BTN_TEXT}>
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleErase(request)}
                                disabled={busy}
                                className={BTN_DANGER_SM}
                              >
                                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                Confirm Erasure
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">Awaiting action</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <RowActions active={confirming}>
                          {isOpen && request.request_type === "erasure_request" ? (
                            <button
                              type="button"
                              onClick={() => setConfirmingId(request.id)}
                              disabled={busy}
                              title="Anonymise user data"
                              aria-label="Anonymise user data"
                              className={ROW_MICRO}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleExport(request)}
                              disabled={busy || !isOpen}
                              title={isOpen ? "Export JSON packet" : "Request already resolved"}
                              aria-label="Export JSON packet"
                              className={ROW_MICRO}
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {(exportError || resolve.isError) && (
          <p className={cn(ERROR_BOX, "mt-6")}>{exportError ?? resolve.error?.message}</p>
        )}
      </div>
    </div>
  );
}
