import { assertEquals } from "jsr:@std/assert@1";
import { mockWebhookAllowed } from "./webhook-mode.ts";

const LOCAL = "http://kong:8000";

Deno.test("mock payments need the flag and a local database URL", () => {
  assertEquals(mockWebhookAllowed({ allowMock: "true", supabaseUrl: LOCAL }), true);
  assertEquals(mockWebhookAllowed({ allowMock: "false", supabaseUrl: LOCAL }), false);
  assertEquals(mockWebhookAllowed({ supabaseUrl: LOCAL }), false);
});

Deno.test("a configured secret always turns mock payments off", () => {
  assertEquals(
    mockWebhookAllowed({ secret: "whsec_live", allowMock: "true", supabaseUrl: LOCAL }),
    false,
  );
});

Deno.test("a cloud database URL never allows mock payments", () => {
  assertEquals(
    mockWebhookAllowed({ allowMock: "true", supabaseUrl: "https://abc.supabase.co" }),
    false,
  );
});

Deno.test("an invalid database URL does not throw", () => {
  assertEquals(mockWebhookAllowed({ allowMock: "true", supabaseUrl: "not a url" }), false);
});
