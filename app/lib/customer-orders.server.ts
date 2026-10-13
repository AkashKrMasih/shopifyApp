import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export type CustomerOrder = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  total: string;
  currencyCode: string;
};

export async function fetchCustomerOrders(
  admin: AdminApiContext,
  customerId: string,
): Promise<CustomerOrder[]> {
  // Query orders by customer ID (read_orders). Avoids the Customer object, which
  // requires protected customer data access for many apps.
  const response = await admin.graphql(
    `#graphql
      query OrdersByCustomer($query: String!) {
        orders(first: 50, sortKey: CREATED_AT, reverse: true, query: $query) {
          nodes {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }`,
    { variables: { query: `customer_id:${customerId}` } },
  );

  const body = await response.json();
  const graphqlErrors = body.errors as { message: string }[] | undefined;
  if (graphqlErrors?.length) {
    throw new Error(graphqlErrors.map((e) => e.message).join("; "));
  }

  const nodes = body.data?.orders?.nodes ?? [];

  return nodes.map((order: {
    id: string;
    name: string;
    createdAt: string;
    displayFinancialStatus: string;
    displayFulfillmentStatus: string;
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  }) => ({
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    total: order.totalPriceSet.shopMoney.amount,
    currencyCode: order.totalPriceSet.shopMoney.currencyCode,
  }));
}
