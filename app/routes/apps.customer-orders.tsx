import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AppProxyProvider } from "@shopify/shopify-app-remix/react";

import { authenticate } from "../shopify.server";
import {
  fetchCustomerOrders,
  type CustomerOrder,
} from "../lib/customer-orders.server";
import styles from "../styles/customer-orders.module.css";

type LoaderData = {
  appUrl: string;
  orders: CustomerOrder[] | null;
  error: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await authenticate.public.appProxy(request);
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("logged_in_customer_id");
  const appUrl = process.env.SHOPIFY_APP_URL || "";

  if (!customerId) {
    return json<LoaderData>({
      appUrl,
      orders: null,
      error: "Please log in to your customer account to view your orders.",
    });
  }

  if (!context.admin) {
    return json<LoaderData>({
      appUrl,
      orders: null,
      error:
        "This app must be installed on the store before customers can view orders.",
    });
  }

  try {
    const orders = await fetchCustomerOrders(context.admin, customerId);
    return json<LoaderData>({ appUrl, orders, error: null });
  } catch {
    return json<LoaderData>({
      appUrl,
      orders: null,
      error: "Unable to load orders. Please try again later.",
    });
  }
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(amount: string, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount));
}

export default function CustomerOrdersAppProxy() {
  const { appUrl, orders, error } = useLoaderData<typeof loader>();

  return (
    <AppProxyProvider appUrl={appUrl}>
      <div className={styles.page}>
        <h1 className={styles.title}>Your orders</h1>

        {error && <p className={styles.message}>{error}</p>}

        {orders && orders.length === 0 && (
          <p className={styles.message}>You have not placed any orders yet.</p>
        )}

        {orders && orders.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.name}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{order.financialStatus}</td>
                    <td>{order.fulfillmentStatus}</td>
                    <td>{formatMoney(order.total, order.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppProxyProvider>
  );
}
