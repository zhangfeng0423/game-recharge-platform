# Game Recharge Platform

A Next.js storefront for USD game top-ups, with Supabase accounts, Stripe Checkout, merchant product management, and **manual recharge fulfillment**.

游戏充值平台：玩家填写游戏 ID 和区服，付款后由经营者人工充值，再在后台确认交付。**已收款和已充值是两个独立状态。**

## Current scope

- English / Chinese catalogue, game details and accessible product dialogs.
- Email/password accounts, email password recovery, and Google OAuth callback support (requires provider setup).
- Player order history, scoped to the signed-in buyer.
- Merchant game / SKU create, edit and delete, scoped to the signed-in merchant. Products referenced by orders cannot be deleted.
- Merchant order queue and an admin overview of accounts and orders.
- Stripe-hosted Checkout; prices and merchant ownership are taken from the database.
- Signed, transactional payment callbacks with amount / currency / session matching, replay protection and no paid-to-failed regression.
- Manual delivery status and a buyer-visible delivery note, with an audit event identifying the operator.

This is a repair of an earlier prototype. Passing the local checks below is **not** proof that a particular Supabase / Stripe deployment is ready. Actual service configuration and a test payment must be checked before accepting money.

## Run locally

Use Node.js 22 and the pnpm version specified in `package.json`.

```bash
git clone https://github.com/zhangfeng0423/game-recharge-platform.git
cd game-recharge-platform
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in your own Supabase project and Stripe test credentials.
pnpm dev
```

Open http://localhost:3000/en or http://localhost:3000/zh . Never commit `.env.local` or real credentials.

### Database setup

Back up an existing database and inspect its migration history and schema first. Do not reset a database containing real accounts or orders.

For a **fresh** Supabase project, run these SQL files in the SQL editor in this exact dependency order:

1. `supabase/migrations/20250109_001_initial_schema.sql`
2. `supabase/migrations/9999_merchant_analytics_rpc.sql`
3. `supabase/migrations/20261028160000_launch_hardening.sql`
4. `supabase/migrations/20261028170000_manual_fulfillment.sql`
5. `supabase/migrations/20261028180000_payment_mode.sql`

For a project that already has the two legacy schemas, inspect compatibility and apply only the three new migrations. The legacy filenames do not form a standard timestamp sequence: **do not blindly run `supabase db push`**. Reconcile migration history before adopting automated migrations.

The hardening migration removes direct client writes to financial orders and role assignments, restricts legacy analytics access, creates profiles within account-creation transactions, and adds an atomic payment-event function. The fulfillment migration adds recipient details, a separate delivery lifecycle, and an operator-scoped confirmation function.

### Account setup

- Configure Supabase Site URL and redirect allowlists for the actual application origins.
- Email confirmation and production email delivery require working Supabase email settings.
- Password recovery starts at `/<locale>/auth/forgot`. Allow the exact callback URL `https://YOUR_HOST/<locale>/auth/callback?next=%2F<locale>%2Fauth%2Freset` for each supported locale. The default Supabase recovery template uses `{{ .ConfirmationURL }}`; with PKCE, open the email link in the same browser that requested it. A verified session is required before setting a new password.
- Configure Google OAuth separately if you want to offer Google sign-in. Its callback is `/<locale>/auth/callback`.
- A user may register as a merchant. **ADMIN is never inferred from an email address or signup metadata.** Set the initial operator's profile role through trusted database administration after verifying the account.
- Audit existing ADMIN profiles from the old application before launch: earlier code inferred privilege from email text.

## Payments and manual fulfillment

Checkout is closed by default. Set `PAYMENTS_ENABLED=true` only after the database migrations, correct public origin, valid Stripe test key and webhook secret are present. Live keys additionally require `ALLOW_LIVE_PAYMENTS=true`.

Register `/api/webhooks/stripe` in Stripe and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`

Use the matching endpoint signing secret in `STRIPE_WEBHOOK_SECRET`. An unconfigured webhook returns 503; invalid signatures return 400; persistence failures return 500 so Stripe can retry.

### Operator workflow

1. Publish real game / SKU descriptions and USD prices through the merchant catalogue editor. Do not advertise unverified bonuses or automatic delivery.
2. The player supplies a game account ID and server. **Never request account passwords.**
3. Stripe confirms payment. A redirect to the return page alone does not mark the order paid.
4. In the merchant order queue (or admin overview), locate a paid, undelivered order and verify its account / server.
5. Perform the recharge outside this application.
6. Record the verified outcome and a buyer-visible delivery reference. Delivery confirmation records the operator and timestamp. A different merchant cannot update the order.
7. If recharge cannot be delivered, mark it for follow-up and resolve it with the buyer. Refunds and chargebacks require separate handling in Stripe; this application does not issue refunds or automatically settle funds to merchants.

Test orders are explicitly labeled. Their callbacks must carry test mode; they must never trigger a real game recharge. Historical orders with unknown mode require verification.

An order's `completed` payment status means **paid**, not delivered. Fulfillment uses `pending`, `attention` and `fulfilled` separately. Financial history is retained when product deletion is attempted.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

- Unit / integration tests check verified identity, buyer order scoping, real PostgreSQL RLS, signed callback handling, replay protection, and manual-fulfillment permissions.
- Database tests run the actual SQL against isolated PGlite PostgreSQL, with a minimal Supabase auth schema. They do not alter a remote database.
- Browser tests start a production build against an isolated HTTP fixture for Supabase. They check catalogue, language, login, role redirects, order pages and closed checkout. Fixture builds use `.next-e2e`, separate from deployable `.next` output. They do not prove delivery of real email, OAuth configuration or live payment processing.
- `pnpm audit --prod --registry=https://registry.npmjs.org` checks current runtime dependency advisories.

## Deploy with Vercel

The repository targets Node.js 22, `pnpm install --frozen-lockfile` and `pnpm build`. Configure environment variables on the intended project and environment; preview and production signing secrets / callback origins must match their respective endpoints.

Before accepting real payments, verify a complete test-mode purchase in the actual deployment: signup / email confirmation → login → merchant product → checkout → signed callback → buyer order → operator delivery confirmation. Also verify a second merchant cannot access or update the order.

Set the correct origin at build time: `NEXT_PUBLIC_*` variables are embedded in the Next.js build. Changing their values requires a new build. Do not promote a fixture build or a preview configured for another database.

## License and feedback

No LICENSE file has been selected for this repository. This README does not grant additional permissions.

Report reproducible problems via [Issues](https://github.com/zhangfeng0423/game-recharge-platform/issues). Do not include credentials, player identifiers or private order data in public issues.
