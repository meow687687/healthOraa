export async function verifySignature(
  rawBody: Uint8Array,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!/^[\da-f]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, Uint8Array.from(rawBody)),
  );
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^
      signature.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

export const automaticRefundRequest = (
  paymentId: string,
  keyId: string,
  keySecret: string,
): RequestInit => ({
  method: "POST",
  headers: {
    authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
    "content-type": "application/json",
    "X-Refund-Idempotency": `healthoraa-${paymentId}`,
  },
  body: JSON.stringify({ notes: { reason: "Reservation expired before payment capture" } }),
  signal: AbortSignal.timeout(10_000),
});
