import ejs from 'ejs';
import path from 'path';
import type { ProxyOrdersLocals } from './types';

const TEMPLATE = path.join(process.cwd(), 'templates', 'proxy-orders.ejs');

export async function renderProxyOrders(locals: ProxyOrdersLocals): Promise<string> {
  return ejs.renderFile(TEMPLATE, locals);
}
