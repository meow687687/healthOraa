import { PANEL, cn } from "@healthoraa/ui";
import type { QueueConsultation, RoomPane } from "../../types/queue";
import { ChatThread } from "../chat/ChatThread";

export function RoomChatPanel({
  consultation,
  pane,
}: {
  consultation: QueueConsultation;
  pane: RoomPane;
}) {
  return (
    <section
      id="room-panel-chat"
      role="tabpanel"
      aria-labelledby="room-tab-chat"
      // A fixed height keeps the thread scrolling inside the pane instead of growing the page.
      className={cn(
        PANEL,
        "h-[min(28rem,calc(100dvh-24rem))] min-h-[24rem] flex-col p-5 md:p-6 md:h-[min(30rem,calc(100dvh-24rem))] lg:h-[36rem] lg:min-h-0",
        pane === "chat" ? "flex" : "hidden lg:flex",
      )}
    >
      <h3 className="mb-3 text-lg font-semibold text-text-primary">
        7-day follow-up chat
      </h3>
      <ChatThread consultation={consultation} />
    </section>
  );
}
