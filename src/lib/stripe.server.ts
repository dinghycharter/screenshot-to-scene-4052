// Server-only Stripe helpers. Talks to the Stripe REST API with fetch, so no SDK is needed.
// Never import this from client code. Load it inside server handlers with `await import(...)`.
import { createHmac, timingSafeEqual } from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StripeObject = Record<string, any>;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Payments are not available yet.");
  }
}

export class StripeApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

export function isStripeConfigured(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

function encodeParams(params: Record<string, unknown>, prefix = "", out: [string, string][] = []) {
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${name}]` : name;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === "object") encodeParams(item as Record<string, unknown>, `${key}[${index}]`, out);
        else out.push([`${key}[${index}]`, String(item)]);
      });
    } else if (typeof value === "object") {
      encodeParams(value as Record<string, unknown>, key, out);
    } else {
      out.push([key, String(value)]);
    }
  }
  return out;
}

export async function stripeRequest(
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
  options: { idempotencyKey?: string } = {},
): Promise<StripeObject> {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new StripeNotConfiguredError();

  const encoded = new URLSearchParams(encodeParams(params)).toString();
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let url = `https://api.stripe.com/v1${path}`;
  let body: string | undefined;
  if (method === "GET") {
    if (encoded) url += `?${encoded}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encoded;
  }

  const response = await fetch(url, { method, headers, body });
  const json = (await response.json().catch(() => ({}))) as StripeObject;
  if (!response.ok) {
    const error = json["error"] ?? {};
    throw new StripeApiError(error.message ?? `Stripe request failed (${response.status})`, response.status, error.code);
  }
  return json;
}

/** Verifies the `Stripe-Signature` header of a webhook call against the raw request body. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim().split("=") as [string, string]);
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}
