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
  const customerGid = `gid://shopify/Customer/${customerId}`;

  const response = await admin.graphql(
    `#graphql
      query CustomerOrders($customerId: ID!) {
        customer(id: $customerId) {
          orders(first: 50, sortKey: CREATED_AT, reverse: true) {
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
        }
      }`,
    { variables: { customerId: customerGid } },
  );

  const { data } = await response.json();

  const nodes = data?.customer?.orders?.nodes ?? [];

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
