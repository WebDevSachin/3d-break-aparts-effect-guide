---
name: razorpay-setup
description: >-
  Add Razorpay payments to this static site (or any site derived from it)
  and validate the integration. Use this skill whenever the user mentions
  Razorpay, payments, checkout, a pay/buy/pre-order button, payment links,
  UPI/card collection, or monetizing the product page — even if they only
  say "add payments" without naming Razorpay. Covers the no-backend Payment
  Button (right for this repo's static hosting), Payment Links, the full
  Standard Checkout server flow, test vs live keys, and the hard rules about
  which credentials may ever appear in client code.
---

# Razorpay setup

This repo is a **static site** — there is no server to create orders or
verify signatures. That single fact decides the integration:

| Approach | Backend needed | Fits this repo | Use when |
|---|---|---|---|
| **Payment Button** | none | ✅ best fit | a Buy/Pre-order button on the page |
| **Payment Link** | none | ✅ | sharing a link in chat/email/QR, no page change |
| **Standard Checkout** | yes (orders + signature verification) | only with a backend | carts, dynamic amounts, order tracking |

Default to the **Payment Button** unless the user has (or wants to add) a
backend. If they need dynamic amounts or a cart, read
`references/checkout-server.md` and be explicit that static Hostinger
hosting alone cannot do it — they'll need a small server or serverless
function.

## The credential rules (non-negotiable)

- `key_id` (`rzp_test_…` / `rzp_live_…`) is public — it may appear in
  client code.
- `key_secret` and the webhook secret must **never** appear in the repo,
  in client-side JS, or in chat logs. Server environment variables only.
- A Payment Button ID (`pl_…`) is public by design — safe to commit.
- Start every integration in **Test Mode** (dashboard toggle); switch to
  live keys only after a test payment has been made and verified.

## Path 1 — Payment Button (no backend, ~10 minutes)

1. The user creates the button in the Razorpay Dashboard (this needs their
   login — Claude can't do it for them): **Dashboard → Payment Button →
   Create**, set the amount/label (e.g. "Pre-order PHONEX ULTRA"), and copy
   the embed code. It looks like:

   ```html
   <form>
     <script
       src="https://cdn.razorpay.com/static/widget/payment-button.js"
       data-payment_button_id="pl_XXXXXXXXXXXXXX"
       data-button_text="Pre-order"
       data-button_theme="rzp-dark-standard">
     </script>
   </form>
   ```

2. Add it to the site. `assets/payment-button-snippet.html` in this skill
   is a drop-in section styled to match the page (dark card, Space Grotesk
   heading, disclaimer line). Paste it into `site/index.html` **between the
   specs section and the footer**, and replace `pl_REPLACE_ME` with the
   real button ID. Keep the `<noscript>` fallback link (a Payment Link
   works without JS).

3. **This page's chrome needs one accommodation:** the embed injects an
   iframe-backed button. Do not place it inside a pinned/scrubbed section
   (S1/S2) — GSAP transforms would drag the iframe mid-payment. The
   snippet's placement (a static section) avoids this. Nothing else on the
   page conflicts: the site's CSS never styles foreign iframes, and the
   `no-js` fallback simply shows the `<noscript>` link.

## Path 2 — Payment Link (zero code)

Dashboard → **Payment Links → Create**: amount, description, optional
expiry. Share the URL directly, or wire it as the `href` of any CTA on the
page (e.g. turn the hero's "See specs" secondary CTA into "Pre-order").
No script, no iframe, works everywhere — the tradeoff is the customer
leaves the page to pay.

## Path 3 — Standard Checkout (needs a server)

Read `references/checkout-server.md`. Summary of the flow it documents:
server creates an Order (amount in **paise**) with `key_id:key_secret` →
client opens `checkout.js` with the `order_id` → Razorpay returns
`payment_id` + `signature` → server verifies
`HMAC_SHA256(order_id + "|" + payment_id, key_secret)` → only then treat
the payment as real. Client-side "success" handlers alone are not proof of
payment; the signature (or a verified webhook) is.

## Validating the integration (do this every time)

1. **Static checks** (no payment made):
   ```bash
   grep -n "pl_REPLACE_ME" site/index.html && echo "✗ placeholder still in page"
   grep -rn "key_secret\|rzp_live_" site/ && echo "✗ secret material in client code"
   ```
   Both greps must come back empty (exit non-zero).
2. **Page still healthy:** `npm run verify` — the audit fails on any
   console error or failed request the embed might introduce. The
   Razorpay script is third-party, so run it once with the button in
   place before shipping.
3. **Test payment:** with test-mode keys, pay with Razorpay's test card
   `4111 1111 1111 1111` (any future expiry, any CVV) or test UPI
   `success@razorpay`. Confirm the payment shows in
   **Dashboard → Transactions → Payments** with status `captured`
   (enable auto-capture in Settings, or capture manually).
4. **Live switch:** repeat step 3's flow once with a real ₹1-style
   minimum payment after switching the button/keys to live mode, then
   refund it from the dashboard.
