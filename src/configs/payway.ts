const paywayConfig = {
  baseUrl: process.env.ABA_BASE_URL,
  merchantId: process.env.ABA_MERCHANT_ID || process.env.PAYWAY_MERCHANT_ID || "",
  apiKey: process.env.ABA_API_KEY || process.env.PAYWAY_API_KEY || "",
  refundPublicKey: process.env.PAYWAY_REFUND_RSA_PUBLIC_KEY?.replace(/\\n/g, "\n").trim() || "",
};
export default paywayConfig;
