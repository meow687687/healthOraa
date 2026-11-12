import { verifySignature } from "./razorpay.ts";

Deno.test("webhook signature uses the raw body and rejects malformed signatures", async () => {
  const body = new TextEncoder().encode('{"event":"payment.captured"}');
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  const signature = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const wrongSignature = `${signature.slice(0, -1)}${
    signature.endsWith("0") ? "1" : "0"
  }`;
  if (!await verifySignature(body, signature, "test-secret")) {
    throw new Error("valid signature rejected");
  }
  if (await verifySignature(body, wrongSignature, "test-secret")) {
    throw new Error("invalid signature accepted");
  }
  if (await verifySignature(body, "not-a-signature", "test-secret")) {
    throw new Error("malformed signature accepted");
  }
});
