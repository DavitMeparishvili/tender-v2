# VIP Lounge Design

**Status:** Draft for review (2026-10-22).

**Purpose:** a demo-grade VIP feature for a 5-minute presentation. VIP status is granted
by editing the database (or by the seeder); the platform has no flow to buy or grant it.

**Source:** the design handoff `tender-market-vip-lounge.zip` (README, reference HTML,
designs, placeholder logos). This document records which parts of that handoff are
built, which are cut, and where this design deliberately departs from it.

## 1. Scope

### In scope

1. **VIP membership** for any account — client or provider — stored in the database.
2. **Home page VIP Lounge strip** (handoff §3): VIP providers as chips, arrows on
   desktop, "All partners" link.
3. **All partners page** at `/{locale}/partners` (handoff §4) with the service-category
   filter and per-category counts.
4. **VIP badge** on:
   - tenders posted by VIP clients (Discover list, Discover detail, home "Tenders open
     for offers" list);
   - offers submitted by VIP providers (the client's offer comparison);
   - the public profile page of any VIP account.
5. **VIP-first ordering** of tenders and offers (section 4).
6. **Demo seed** creating 8 VIP providers, 2 VIP clients and enough real history for
   ratings and completed counts (section 7).

### Cut for the demo (handoff sections not built)

| Handoff item                          | Decision                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| §6 Admin and back office              | Not built. VIP is set in the database.                                                  |
| §2 rule 1 eligibility (N completed)   | Not enforced. The seed gives every VIP provider real history.                           |
| §2 rule 3 `startsAt`/`endsAt`         | Replaced by an `active` flag (section 3).                                               |
| §5 API endpoints and caching          | Not built. Server components read the database directly, like the home page does today. |
| §4 paging                             | Not built. 8 partners fit on one page.                                                  |
| §11 analytics events                  | Not built.                                                                              |
| "Apply for VIP" flow (§13 decision 3) | The button is a `mailto:` link to a configured contact address.                         |
| Logo upload and validation            | Not built. Logos are static files in `public/vip/logos/`.                               |

## 2. Departure from the handoff: VIP-first ordering

The handoff's business rule 2 says VIP "never affects offer ranking", and its disclosure
copy promises the same. This design **does** list VIP offers first. Neutrality is kept
where it matters:

- **Price ranking is untouched.** `rankBids`, the `lowestPrice` flag, the home hero's
  "lowest offer" figure, the deadline selection run and the standby/fallback order keep
  using price, then `qualifyingSubmittedAt`, then id.
- **VIP is display order only.** The offer comparison is re-sorted for display after
  ranking: VIP offers first, then the rest, each group in price-rank order. The
  "Lowest price" tag can therefore appear on a non-VIP row below VIP rows. That is
  intended, and it shows the client that VIP is placement, not price.
- **The client still chooses.** Nothing about choosing a winner changes.

The disclosure copy (`vip.disclosure`) is rewritten to match (section 8). The landing
page Trust section ("The client decides") stays true and needs no change.

## 3. Data model

New table, one row per VIP account:

```prisma
model VipMembership {
  id           String   @id
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  active       Boolean  @default(true)
  // Public path of a square logo, e.g. "/vip/logos/kartli-build_icon.svg".
  logoPath     String?
  // Localized {"en": "...", "ka": "...", "ru": "..."}. ≤28 characters each.
  serviceLabel Json?
  // Localized, ≤120 characters each. Shown on the All partners page only.
  description  Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([active])
}
```

`User` gains `vipMembership VipMembership?`.

**An account is VIP when it has a membership row with `active = true`.** To grant or
revoke VIP in the demo, insert a row or flip `active`.

**Lounge eligibility** (strip and All partners page): an active membership, the
`PROVIDER` capability, a verified profile (the same test the profile page uses for its
"Verified provider" tag), not disabled, and a non-null `serviceLabel`. VIP clients get
badges and ordering but never appear in the Lounge.

**Partner fields read from existing data**, never from the membership row:

| Card field    | Source                                                            |
| ------------- | ----------------------------------------------------------------- |
| Name          | `UserProfile.displayName`                                         |
| City          | `UserProfile.city`                                                |
| Category      | first entry of `ProviderProfile.specialties`                      |
| Verified tick | the profile page's existing verification test                     |
| Rating        | mean overall score of published reviews received, one decimal     |
| Completed     | count of the provider's `COMPLETED` agreements                    |
| Profile link  | `/{locale}/profiles/{userId}` (the existing public profile route) |

The profile route already exists, so handoff §7's `/providers/{slug}` is not needed and
no slug is added.

## 4. Ordering rules

| Surface                                 | Order                                                 |
| --------------------------------------- | ----------------------------------------------------- |
| Discover tenders (`/provider/tenders`)  | VIP owner first, then the user's chosen sort, then id |
| Home "Tenders open for offers"          | Same as Discover (it uses `searchPublishedTenders`)   |
| Client offer comparison                 | VIP provider first, then price rank (section 2)       |
| Home Lounge strip and All partners page | Daily rotation (below)                                |

**Tenders:** the VIP key goes into the database `orderBy` in
`prisma-tender-repository.ts`, ahead of the existing sort keys, so paging and totals stay
correct. The tender read model gains `ownerIsVip: boolean`.

**Offers:** `ClientBidView` gains `providerIsVip: boolean`, filled through the
`ProviderDirectory` port. A pure function in `bidding/domain` performs a stable sort of
the already-ranked list by `providerIsVip`. `listBids`, `listRankableBids` and the
selection lifecycle queries are **not** changed.

**Lounge rotation** (handoff §2 rule 4): shuffle with a seed equal to the current date
in `Asia/Tbilisi`, so the order is stable within a day. It is implemented as a pure,
unit-tested function. The strip shows at most 12 partners and is hidden when fewer than
4 qualify. With 4–5 partners it shows no arrows.

## 5. Home page strip

Placement and anatomy follow handoff §3. Implementation notes:

- A new `vip` module (`src/modules/vip/{application,domain,infrastructure,ui}`) owns the
  membership read, eligibility, partner stats and rotation, following the existing
  module layout and boundary rules (`pnpm verify:boundaries`).
- `app/[locale]/page.tsx` loads the partners alongside its existing reads and passes them
  to `LandingPage`. The strip is rendered inside the hero `band`: below `hero-stats` on
  desktop, and below the search box on mobile.
- Chips are real `<a href>` links. The scroller uses native scroll and scroll-snap with
  no autoplay. The arrows are a small client component that scrolls 80% of the visible
  width and is disabled at either end. It respects `prefers-reduced-motion`.
- "Partner listing ⓘ" shows the disclosure text as a tooltip (`title` plus an
  accessible description).

## 6. All partners page

Route `app/[locale]/partners/page.tsx`, public (no login), server-rendered. It follows
handoff §4 except:

- **Filter:** the selected category is the `?specialty=` query parameter. Options are
  links or a GET form, so the page works without client JavaScript. Counts come from the
  full eligible set, not the filtered results. An enhancement that avoids a page reload
  is optional.
- **No paging.** The results line still reads "Showing 1–N of N partners".
- **"Become a VIP partner"** (header button and last grid card) is a `mailto:` link to
  `VIP_CONTACT_EMAIL`, falling back to the existing support address in config.
- Plural forms use the existing localization helpers (RU has three forms).

## 7. Badges

One shared `VipBadge` component (gold diamond and the text "VIP", gold `#B8913F` on
`#FFFCF5` with a `#D6C08F` border). It has an accessible label from `vip.badgeLabel`.
It is used on:

- `discovery-list.tsx` tender cards and `discovery-detail.tsx` heading, when
  `ownerIsVip`;
- the landing page open-tenders rows, when `ownerIsVip`;
- `bid-comparison.tsx` provider cell, when `providerIsVip`;
- `app/[locale]/profiles/[id]/page.tsx`, next to the name. When a `logoPath` is set, the
  logo replaces the generic `BrandIcon` avatar, and the disclosure line is shown.

## 8. Copy and i18n

The handoff §8 keys are added under a `vip` namespace in `en.json`, `ka.json` and
`ru.json`. Changes and additions:

| Key              | EN                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------- |
| `vip.disclosure` | VIP partners are listed first. Price ranking and the client's choice never change. |
| `vip.badgeLabel` | VIP member                                                                         |
| `vip.showingAll` | Showing 1–{n} of {n} partners                                                      |

KA and RU strings for these keys are drafted during implementation and flagged for
native-speaker review, as the handoff requires.

## 9. Demo seed

New script `scripts/seed-vip.ts`, exposed as `pnpm seed:vip`. It is **idempotent**: it
finds accounts by email, creates what is missing and updates memberships in place.

**Target database:** it runs against the local dev database. Against the demo deployment
it uses the same guards as `seed-demo.ts` (`tender_demo` database and
`DEMO_SEED_CONFIRM`). The password comes from `DEMO_SEED_PASSWORD` when set, and
otherwise from a fixed local-only value printed at the end of the run.

**Accounts:**

| Accounts                                                    | Role     | VIP | Purpose                                                                                         |
| ----------------------------------------------------------- | -------- | --- | ----------------------------------------------------------------------------------------------- |
| The 8 handoff companies (`kartli-build@vip.tender.test`, …) | Provider | yes | Lounge partners, using the handoff's names, cities, categories, service labels and descriptions |
| 2 client companies (`vip-client-1@…`, `vip-client-2@…`)     | Client   | yes | VIP tenders and VIP-first offer demo                                                            |
| 2 standard providers                                        | Provider | no  | Show non-VIP offers below VIP ones                                                              |
| 1 standard client                                           | Client   | no  | Show non-VIP tenders below VIP ones in Discover                                                 |
| 1 history client                                            | Client   | no  | Owns the completed history tenders                                                              |

The handoff's EN service labels and descriptions are seeded for all three locales until
KA/RU copy is reviewed.

**Live demo data:**

- Each VIP client and the standard client publish one open tender, deadline 14 days out.
- On VIP client 1's tender, three VIP providers and both standard providers bid. A
  **standard provider makes the cheapest offer**, so the demo shows VIP rows first and
  the "Lowest price" tag on a non-VIP row below them.

**History** (for real rating and completed counts): for each VIP provider, the seed
creates 2–5 completed engagements. Each one is a tender owned by the history client, an
accepted bid, a `COMPLETED` agreement and a published review with varied scores. The
seed goes through the same domain paths as `seed-phase-04.ts` where practical, and uses
direct writes otherwise. The handoff's sample numbers (for example "34 completed") are
not reproduced; the cards show what the data supports.

**Logos:** the 8 `*_icon.svg` files are copied to `public/vip/logos/`. The VIP clients
reuse two of the remaining handoff logo styles, or get generated monogram SVGs if none
fit.

## 10. Testing

- Unit: daily rotation (stable within a day, changes across days, deterministic),
  VIP-first offer sort (stable, keeps price order within groups, never changes
  `lowestPrice`), Lounge eligibility filtering, plural summary text.
- Integration: Discover search returns VIP-owned tenders first under every sort option
  and paging stays consistent; partner counts per category.
- Existing suites must stay green (`pnpm lint`, `typecheck`, `test:unit`,
  `test:integration`, `verify:boundaries`).
- Manual demo run-through (section 11) at 1440×900 and 390×844 in EN and KA.

## 11. Demo script (5 minutes)

1. Home page, logged out: the VIP Lounge strip sits in the first screen. Hover a chip,
   use the arrows, then open "All partners".
2. All partners: filter by "Materials & supply", then clear. Open a card to land on the
   partner profile, which shows the VIP badge, logo, rating and completed count.
3. Log in as a provider and open Discover: VIP client tenders are at the top with
   badges.
4. Log in as VIP client 1 and open the tender: VIP offers are listed first, and the
   "Lowest price" tag sits on a cheaper non-VIP offer below them. Point at the
   disclosure line.
5. (Optional) In the database, set `active = false` on one membership and refresh: the
   partner leaves the Lounge and the badges disappear.

## 12. Open points

1. Contact address for "Apply for VIP" (`VIP_CONTACT_EMAIL`).
2. Whether the demo runs locally or on the demo deployment. Both are supported, but
   only the chosen one gets a rehearsal run.
3. KA/RU copy review for the new and changed strings.
