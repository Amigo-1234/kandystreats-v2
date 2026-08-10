# Kandy's Treats V2 Architecture

## Current Approach

V2 keeps the original static HTML, CSS, JavaScript, and Firebase CDN structure. The upgrade adds modular customer features without replacing the V1 storefront or admin screens.

## Firebase Data Model

- `users/{uid}`: customer profile, role, contact details, email verification state.
- `wallets/{uid}`: one wallet per user. Balance changes are handled by Cloud Functions.
- `transactions/{id}`: funding requests, wallet payments, refunds, failed attempts, and future gateway events.
- `orders/{orderId}`: account-linked order header, totals, payment state, fulfilment, tracking status.
- `orderItems/{id}`: queryable order line items for dashboards, analytics, inventory, and future restaurant/rider views.
- `addresses/{id}`: saved delivery addresses owned by one user.
- `favourites/{uid_menuId}`: saved meals for fast reorder.
- `reviews/{uid_menuId}`: authenticated meal reviews.
- `notifications/{id}`: in-app notifications for orders, wallet, refunds, and promotions.
- `supportTickets/{id}` and `contactMessages/{id}`: authenticated support and public contact intake.

## Security Model

Firestore rules enforce owner-based access using `request.auth.uid`. Admin access is role-based through `users/{uid}.role`. Wallet balances and transaction status are not updated directly by client code; Cloud Functions use the Admin SDK for trusted balance changes.

Saved addresses are owned by `addresses/{id}.userId`. The customer dashboard uses `saveCustomerAddress`, `deleteCustomerAddress`, and `setDefaultCustomerAddress` callable functions first, then falls back to strict owner-only Firestore writes for local development. Checkout sends the selected `addressId`, but `createCheckoutOrder` loads that address server-side and rejects it unless it belongs to the authenticated UID. Orders keep `userId` as the primary owner plus address/customer snapshots for receipts and delivery context.

## Authentication Flow

Customers authenticate with Firebase Authentication using email/password or Google. After sign-in, the auth page and account dashboard call `ensureCustomerAccount`, a callable Cloud Function that creates or updates `users/{uid}` and safely creates the matching zero-balance `wallets/{uid}` document with Admin SDK permissions. The browser keeps a Firestore-rule fallback for local development, but production account provisioning should use the callable function so strict rules never block a valid sign-in.

## Payment Flow

1. Customers build a local cart for speed.
2. Checkout requires login before saving an order draft.
3. Delivery checkout requires a saved address from the signed-in account. Customers can add a reusable address inline, and the selected `addressId` travels with the draft.
4. The review page calls `createCheckoutOrder`; the server re-prices menu items, verifies saved-address ownership, recalculates fees/discounts, creates the account-linked Firestore order, and writes `orderItems`.
5. Paystack and Flutterwave order payments call `createGatewayPayment`; the server initializes the gateway transaction with secrets and returns a hosted checkout URL.
6. Gateway returns call `verifyGatewayPayment`; the server verifies the transaction with the gateway before marking the order paid. Failed and cancelled returns call `recordGatewayPaymentEvent`.
7. Gateway webhooks (`paystackWebhook`, `flutterwaveWebhook`) are idempotent and can confirm payments if the customer closes the browser before returning. Paystack validates `x-paystack-signature`; Flutterwave accepts either `verif-hash` or `flutterwave-signature` verification.
8. Wallet payments call `payOrderWithWallet`, which atomically checks balance, debits the wallet, writes a transaction, and marks the order paid.
9. Wallet funding checks `getPaymentConfigurationStatus`, then calls `createWalletFundingPayment` and `verifyWalletFundingPayment`; successful funding credits the wallet exactly once. If gateway secrets are missing, no pending wallet transaction is created.
10. Admin refunds can call `refundOrderToWallet`, which credits the customer wallet, records a refund transaction, updates the order refund state, and notifies the user.

## Required Payment Secrets

Set these before deploying gateway functions:

- `PAYSTACK_SECRET_KEY`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_SECRET_HASH`

Browser public keys may be placed in `js/payment-public-config.js`. They are only used to open Paystack/Flutterwave checkout when the secure backend initializer is unavailable. Public-key checkout must not mark orders as paid or credit wallets by itself; final confirmation, wallet crediting, and refunds still require server-side secret-key Functions and gateway verification.

Firestore clients no longer create final `orders` or `orderItems`; those writes are intentionally server-side so customers cannot tamper with totals before payment.

## Deployment Checklist

Customer dashboard writes and gateway payments require the latest Firebase backend to be deployed:

- Confirm deployment status: `npm run check:firebase`
- Authenticate the Firebase CLI if needed: `npx --yes firebase-tools@15.26.0 login`
- Set secrets:
  - `npx --yes firebase-tools@15.26.0 functions:secrets:set PAYSTACK_SECRET_KEY --project kandystreat-840b1`
  - `npx --yes firebase-tools@15.26.0 functions:secrets:set FLUTTERWAVE_SECRET_KEY --project kandystreat-840b1`
  - `npx --yes firebase-tools@15.26.0 functions:secrets:set FLUTTERWAVE_SECRET_HASH --project kandystreat-840b1`
- Deploy backend functions, Firestore rules/indexes, and Storage rules: `npm run deploy:backend`
- Deploy frontend hosting: `npm run deploy:hosting`
- Configure Paystack and Flutterwave webhook URLs to the deployed `paystackWebhook` and `flutterwaveWebhook` endpoints.
- Set all payment secrets before live payment testing. Without these secrets, wallet funding and gateway checkout will correctly refuse to start.

## Expansion Points

The structure is ready for admin dashboards, restaurant dashboards, rider tracking, online gateway reconciliation, refunds, loyalty rewards, referrals, inventory, analytics, push notifications, and multi-restaurant support. Future high-volume analytics should read from `orderItems` and append-only `transactions` instead of scanning nested order arrays.
