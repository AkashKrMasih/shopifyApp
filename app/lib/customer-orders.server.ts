import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

type GraphqlBody = {
  data?: Record<string, unknown>;
  errors?: { message: string }[];
};

function parseGraphqlResponse<T>(response: Response): T {
  return response.json().then((body: GraphqlBody) => {
    if (body.errors?.length) {
      throw new Error(body.errors.map((e) => e.message).join("; "));
    }
    return body.data as T;
  });
}

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

  const data = await parseGraphqlResponse<{
    orders: { nodes: unknown[] };
  }>(response);

  const nodes = data.orders?.nodes ?? [];

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
