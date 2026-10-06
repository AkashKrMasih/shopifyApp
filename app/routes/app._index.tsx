import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Customer orders" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Storefront order list for logged-in customers
                </Text>
                <Text as="p" variant="bodyMd">
                  Customers who are logged in on your storefront can view their
                  own orders at the app proxy URL below. Shopify passes the
                  current customer ID securely when they are signed in.
                </Text>
                <Box
                  padding="400"
                  background="bg-surface-active"
                  borderWidth="025"
                  borderRadius="200"
                  borderColor="border"
                >
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Customer-facing URL (on your store)
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <code>https://&lt;your-store&gt;/apps/customer-orders</code>
                  </Text>
                </Box>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Add to your theme
                  </Text>
                  <List type="number">
                    <List.Item>
                      In the theme editor, add a menu link or button pointing
                      to{" "}
                      <Text as="span" fontWeight="semibold">
                        /apps/customer-orders
                      </Text>
                      (for example in the customer account area).
                    </List.Item>
                    <List.Item>
                      Ask customers to log in before visiting the page; guests
                      see a sign-in message.
                    </List.Item>
                    <List.Item>
                      After changing app scopes, reinstall or approve updated
                      permissions on the store.
                    </List.Item>
                  </List>
                </BlockStack>
                <Text as="p" variant="bodyMd">
                  Learn more about{" "}
                  <Link
                    url="https://shopify.dev/docs/apps/build/online-store/app-proxies"
                    target="_blank"
                    removeUnderline
                  >
                    app proxies
                  </Link>
                  .
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
