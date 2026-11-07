import crypto from "node:crypto";

export const hash = [
  "req_time",
  "merchant_id",
  "tran_id",
  "amount",
  "items",
  "shipping",
  "firstname",
  "lastname",
  "email",
  "phone",
  "type",
  "payment_option",
  "return_url",
  "cancel_url",
  "continue_success_url",
  "return_deeplink",
  "currency",
  "custom_fields",
  "return_params",
  "payout",
  "lifetime",
  "additional_params",
  "google_pay_token",
  "skip_success_page",
] as const;
export type HashField = (typeof hash)[number];
export type HashableFields = Partial<Record<HashField, string>>;
 
export const generateTranId = (): string => {
  return `ORD${Date.now().toString()}`;
};

export const generateReqTime = (): string => {
  const date = new Date();

  return (
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0") +
    String(date.getUTCHours()).padStart(2, "0") +
    String(date.getUTCMinutes()).padStart(2, "0") +
    String(date.getUTCSeconds()).padStart(2, "0")
  );
};

export const encodeItems = (items: unknown[]): string => {
  return Buffer.from(JSON.stringify(items)).toString("base64");
};

export const generateHash = (fields: HashableFields, apiKey: string): string => {
  const beforeHash = hash.map((key) => fields[key] ?? "").join("");
  return crypto.createHmac("sha512", apiKey).update(beforeHash, "utf8").digest("base64");
};