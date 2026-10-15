const ejs = require('ejs');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'proxy-orders.ejs');

async function renderProxyOrders(locals) {
  return ejs.renderFile(TEMPLATE, locals);
}

module.exports = { renderProxyOrders };
