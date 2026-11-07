import paywayConfig from "../configs/payway.ts";
import {
  generateTranId,
  generateReqTime,
  encodeItems,
  generateHash,
} from "../utils/payway.utils.ts";

interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  total: number;
  items: OrderItem[];
}

export const createPaywayPayment = async (
  order: OrderData,
  customer: Customer,
) => {
  const tranId = generateTranId();

  const data = {
    req_time: generateReqTime(),
    merchant_id: paywayConfig.merchantId,
    tran_id: tranId,
    amount: order.total.toFixed(2),
    currency: "USD",

    firstname: customer.firstName,
    lastname: customer.lastName,
    email: customer.email,
    phone: customer.phone,

    type: "purchase",
    payment_option: "abapay",

    items: encodeItems(
      order.items.map((item) => ({
        name: item.name,
        quantity: String(item.quantity),
        price: item.price.toFixed(2),
      })),
    ),
  };

  const formData = new FormData();
  const hash = generateHash(data, paywayConfig.apiKey);
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  formData.append("hash", hash);
  const response = await fetch(
    `${paywayConfig.baseUrl}/api/payment-gateway/v1/payments/purchase`,
    {
      method: "POST",
      body: formData,
    },
  );

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`ABA error: ${response.status}`);
  }

  return {
    tranId,
    html,
  };
};
