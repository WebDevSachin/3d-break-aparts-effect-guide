# Standard Checkout with a server — the full flow

Read this only when the user needs dynamic amounts, a cart, or order
tracking. It requires running code Razorpay can trust — a small Node/
serverless function is enough. Static Hostinger shared hosting alone
cannot do this (no Node); options that pair well with this repo:
a serverless function (Cloudflare Workers / Vercel), a tiny VPS, or
Hostinger's Node.js hosting plans.

## Why a server is required

Two secrets exist: `key_secret` (authenticates API calls, signs orders)
and the webhook secret. Anything shipped to a browser is public, so
amounts must be fixed server-side (an Order) and results must be verified
server-side (signature/webhook) — otherwise anyone can edit the amount in
DevTools or fake a success callback.

## 1 · Create an Order (server)

```js
// npm i razorpay
import Razorpay from 'razorpay';

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,        // rzp_test_… in test mode
  key_secret: process.env.RAZORPAY_KEY_SECRET // env var, never in the repo
});

// POST /api/create-order  { sku: "phonex-ultra" }
const order = await rzp.orders.create({
  amount: 129900 * 100,      // paise — ₹1,29,900. Look the price up server-side
  currency: 'INR',           // from the SKU; never trust a client-sent amount.
  receipt: `phonex-${Date.now()}`,
});
// return { orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID }
```

## 2 · Open Checkout (client)

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
async function buy() {
  const { orderId, amount, keyId } = await (await fetch('/api/create-order', { method: 'POST' })).json();
  new Razorpay({
    key: keyId,
    order_id: orderId,
    amount,                       // display only — the order already fixed it
    name: 'PHONEX ULTRA',
    theme: { color: '#61b3ff' },  // matches the site's --accent
    handler: (resp) => fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resp),  // razorpay_order_id, razorpay_payment_id, razorpay_signature
    }).then(r => r.ok ? showSuccess() : showFailure()),
  }).open();
}
</script>
```

## 3 · Verify the signature (server — the step that makes it real)

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

// POST /api/verify-payment
const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');
const ok = expected.length === razorpay_signature.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
// ok === true → fulfil the order; false → treat as failed/tampered
```

## 4 · Webhooks (don't skip for real fulfilment)

The `handler` callback dies with the tab; webhooks don't. Dashboard →
**Settings → Webhooks**: subscribe to `payment.captured` (and
`payment.failed`), set a webhook secret, then verify every delivery:

```js
const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
  .update(rawRequestBody)              // the exact raw bytes, not re-serialized JSON
  .digest('hex');
// compare (timing-safe) with the X-Razorpay-Signature header
```

Fulfil idempotently — the same event can be delivered more than once, and
a payment can arrive via both the handler and the webhook.

## Test mode quick reference

- Keys: Dashboard → Settings → API Keys (test and live are separate pairs).
- Test card `4111 1111 1111 1111`, any future expiry, any CVV; test UPI
  `success@razorpay` (or `failure@razorpay` to exercise the failure path).
- Amounts are always integer **paise**: ₹499 → `49900`.
- Auto-capture: Settings → Payment capture. Without it, `authorized`
  payments must be captured manually or they auto-refund.

## Razorpay MCP connector

If this Claude session has the Razorpay connector authorized, Claude can
create payment links and inspect payments via API on the user's behalf —
offer that instead of dashboard walkthroughs. If the connector shows as
needing authentication, the user enables it in claude.ai → Settings →
Connectors; until then, dashboard steps are the path.
