import { useEffect, useRef, useState } from "react";
import { Badge, PANEL, cn, useToast } from "@healthoraa/ui";
import { useConsultationQueue } from "../../hooks/useConsultationQueue";
import { useStartConsultation } from "../../hooks/useStartConsultation";
import { useDoctor } from "../../context/DoctorContext";
import type { QueueConsultation, RoomPane } from "../../types/queue";
import { ConsultationRoom } from "../room/ConsultationRoom";
import { ConsultationQueueSections } from "./ConsultationQueueSections";

// Re-renders every 30 seconds so the countdowns stay current.
const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

interface OpenRoom {
  consultation: QueueConsultation;
  pane: RoomPane;
  // Bumped on every open, so the room starts from fresh form state.
  session: number;
}

interface ReturnFocusTarget {
  element: HTMLElement | null;
  consultationId: string;
}

export default function ConsultationQueueView() {
  const { data, isLoading, refetch } = useConsultationQueue();
  const { activeConsultationId, setActiveConsultationId } = useDoctor();
  const startConsultation = useStartConsultation();
  const toast = useToast();
  const now = useNow();
  const [room, setRoom] = useState<OpenRoom | null>(null);
  const selectionSeq = useRef(0);
  const queueRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<ReturnFocusTarget | null>(null);

  useEffect(
    () => () => {
      selectionSeq.current += 1;
    },
    [],
  );

  const queue = data ?? [];
  const inProgress = queue.filter(
    (item) => item.status === "in_progress",
  ).length;
  const scheduled = queue.filter((item) => item.status === "scheduled").length;
  const startingId = startConsultation.isPending
    ? (startConsultation.variables?.id ?? null)
    : null;

  const getFocusedQueueAction = (): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLElement &&
      queueRef.current?.contains(activeElement)
      ? activeElement
      : null;
  };

  const openRoom = (
    consultation: QueueConsultation,
    pane: RoomPane,
    returnFocusTarget: HTMLElement | null = getFocusedQueueAction(),
  ): void => {
    selectionSeq.current += 1;
    returnFocusRef.current = {
      element: returnFocusTarget,
      consultationId: consultation.id,
    };
    setActiveConsultationId(consultation.id);
    setRoom((current) => ({
      consultation,
      pane,
      session: (current?.session ?? 0) + 1,
    }));
  };

  const startAndOpen = async (
    consultation: QueueConsultation,
    requestedFocusTarget: HTMLElement | null = getFocusedQueueAction(),
  ): Promise<void> => {
    const seqAtStart = selectionSeq.current;
    try {
      await startConsultation.mutateAsync(consultation);
      if (selectionSeq.current !== seqAtStart) return;
      openRoom(
        { ...consultation, status: "in_progress" },
        "rx",
        requestedFocusTarget,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start this consultation.",
      );
    }
  };

  const isStarting = (id: string): boolean => startingId === id;
  const isActiveRoom = (id: string): boolean => activeConsultationId === id;
  const onQueueStart = (
    consultation: QueueConsultation,
    trigger?: HTMLButtonElement,
  ): void => {
    void startAndOpen(consultation, trigger);
  };

  useEffect(() => {
    if (room) return;
    const returnFocusTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    if (!returnFocusTarget) return;
    if (returnFocusTarget.element?.isConnected) {
      returnFocusTarget.element.focus();
      return;
    }
    const consultationHeading = document.getElementById(
      `consultation-${returnFocusTarget.consultationId}`,
    );
    if (
      consultationHeading &&
      queueRef.current?.contains(consultationHeading)
    ) {
      consultationHeading.focus();
    }
  }, [room]);

  return (
    <>
      <div ref={queueRef} hidden={Boolean(room)} className="space-y-6">
        <section
          className={cn(
            PANEL,
            "flex flex-wrap items-center justify-between gap-4",
          )}
        >
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Today&apos;s Queue
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {isLoading
                ? "Loading consultations..."
                : `${queue.length} consultation${queue.length === 1 ? "" : "s"} today`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="emerald" className="tabular-nums">
              {inProgress} in progress
            </Badge>
            <Badge tone="amber" className="tabular-nums">
              {scheduled} scheduled
            </Badge>
          </div>
        </section>

        <ConsultationQueueSections
          consultations={queue}
          isLoading={isLoading}
          now={now}
          isActiveRoom={isActiveRoom}
          isStarting={isStarting}
          onStart={onQueueStart}
          onOpenRoom={openRoom}
          onRefresh={() => void refetch()}
        />
      </div>

      {room && (
        <ConsultationRoom
          key={`${room.consultation.id}-${room.session}`}
          consultation={room.consultation}
          initialPane={room.pane}
          now={now}
          onExit={() => {
            setRoom(null);
            setActiveConsultationId(null);
          }}
          onSigned={() => {
            setRoom(null);
            setActiveConsultationId(null);
            toast.success("Prescription signed and issued to patient portal");
          }}
        />
      )}
    </>
  );
}
