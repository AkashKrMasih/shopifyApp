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

export type CustomerDetails = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  numberOfOrders: number;
  defaultAddress: string | null;
};

export type CustomerOrder = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  total: string;
  currencyCode: string;
};

export async function fetchCustomerDetails(
  admin: AdminApiContext,
  customerId: string,
): Promise<CustomerDetails> {
  const customerGid = `gid://shopify/Customer/${customerId}`;

  const response = await admin.graphql(
    `#graphql
      query CustomerAccountDetails($customerId: ID!) {
        customer(id: $customerId) {
          displayName
          firstName
          lastName
          email
          phone
          numberOfOrders
          defaultAddress {
            formatted(withName: true)
          }
        }
      }`,
    { variables: { customerId: customerGid } },
  );

  const data = await parseGraphqlResponse<{
    customer: {
      displayName: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      numberOfOrders: string;
      defaultAddress: { formatted: string } | null;
    } | null;
  }>(response);

  const customer = data.customer;
  if (!customer) {
    throw new Error("Customer not found.");
  }

  return {
    displayName: customer.displayName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    numberOfOrders: Number(customer.numberOfOrders),
    defaultAddress: customer.defaultAddress?.formatted ?? null,
  };
}

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
