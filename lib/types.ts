export type ProxyOrderState = 'login' | 'error' | 'empty' | 'orders';

export interface ShopMoney {
  amount: string;
  currencyCode: string;
}

export interface OrderNode {
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currentTotalPriceSet: { shopMoney: ShopMoney };
}

export type ProxyOrdersLocals =
  | { state: 'login' }
  | { state: 'error' }
  | { state: 'empty' }
  | { state: 'orders'; orders: OrderNode[] };
