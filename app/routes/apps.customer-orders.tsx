import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AppProxyProvider } from "@shopify/shopify-app-remix/react";

import { authenticate } from "../shopify.server";
import {
  fetchCustomerDetails,
  fetchCustomerOrders,
  type CustomerDetails,
} from "../lib/customer-orders.server";
import styles from "../styles/customer-orders.module.css";

type LoaderData = {
  appUrl: string;
  customer: CustomerDetails | null;
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
      customer: null,
      orders: null,
      error: "Please log in to your customer account to view your orders.",
    });
  }

  if (!context.admin) {
    return json<LoaderData>({
      appUrl,
      customer: null,
      orders: null,
      error:
        "This app must be installed on the store before customers can view orders.",
    });
  }

  const [customerResult, ordersResult] = await Promise.allSettled([
    fetchCustomerDetails(context.admin, customerId),
    fetchCustomerOrders(context.admin, customerId),
  ]);

  if (customerResult.status === "rejected") {
    console.error("Failed to load customer details:", customerResult.reason);
  }

  if (ordersResult.status === "rejected") {
    console.error("Failed to load customer orders:", ordersResult.reason);
    const message =
      ordersResult.reason instanceof Error
        ? ordersResult.reason.message
        : "Unknown error";
    const needsAllOrders =
      message.includes("read_all_orders") ||
      message.toLowerCase().includes("60 day");
    return json<LoaderData>({
      appUrl,
      customer:
        customerResult.status === "fulfilled" ? customerResult.value : null,
      orders: null,
      error: needsAllOrders
        ? "Some orders could not be loaded. The store may need the read_all_orders scope for orders older than 60 days."
        : "Unable to load orders. Please try again later.",
    });
  }

  const customer =
    customerResult.status === "fulfilled" ? customerResult.value : null;
  const orders = ordersResult.value;

  let error: string | null = null;
  if (!customer) {
    error =
      "We could not load your profile details. Order history is still shown below.";
  }

  return json<LoaderData>({ appUrl, customer, orders, error });
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  );
}

export default function CustomerOrdersAppProxy() {
  const { appUrl, customer, orders, error } = useLoaderData<typeof loader>();

  return (
    <AppProxyProvider appUrl={appUrl}>
      <div className={styles.page}>
        <h1 className={styles.title}>Your account</h1>

        {error && <p className={styles.message}>{error}</p>}

        {customer && (
          <section className={styles.card} aria-labelledby="customer-details">
            <h2 id="customer-details" className={styles.sectionTitle}>
              Customer details
            </h2>
            <dl className={styles.details}>
              <DetailRow label="Name" value={customer.displayName} />
              <DetailRow label="Email" value={customer.email} />
              <DetailRow label="Phone" value={customer.phone} />
              <DetailRow label="Address" value={customer.defaultAddress} />
              <DetailRow
                label="Total orders"
                value={String(customer.numberOfOrders)}
              />
            </dl>
          </section>
        )}

        <section className={styles.card} aria-labelledby="order-history">
          <h2 id="order-history" className={styles.sectionTitle}>
            Order history
          </h2>

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
        </section>
      </div>
    </AppProxyProvider>
  );
}
