# Product

<!-- impeccable:product-schema 1 -->

> This is a derived product record. `Product_description.md` and `Specs.md` remain the source of truth. Confirmed decisions from the 2026-08-14 planning session resolve ambiguities for implementation.

## Platform

web

## Stack

Delegated and confirmed: a vertical-slice modular monolith using Next.js 16 App Router, React 19, strict TypeScript, Node.js 24 LTS, PostgreSQL 17, and Prisma ORM 7 GA. Local development and automated tests use standard PostgreSQL 17 containers through Docker Compose: a persistent `tender_dev` database and an isolated disposable `tender_test` database. Prisma ORM is the application query/migration layer; Prisma Postgres is only an optional future managed host and is not required. The UI uses Tailwind CSS 4 with custom design tokens and accessible headless primitives. Authentication, file storage, maps, payments, and notifications sit behind replaceable adapters. Vitest covers domain and service behavior; Playwright covers browser journeys.

## Users

- Clients: private individuals, construction companies, developers, organizations, stores, and institutions that need construction or repair work.
- Providers: construction companies, repair teams, and individual specialists who discover relevant tenders and submit offers.
- Future provider groups: carriers, equipment owners, day laborers, material suppliers, and stores.
- Administrators: technical and administrative operators who manage users, content, payments, trust signals, and reports without selecting tender winners or arbitrating user disputes.

## Product Purpose

The product gives construction-sector clients one structured place to publish needs and receive comparable competitive offers. Providers gain a recurring, category-relevant source of work. Success means a client can move from a clear tender to a recorded completed engagement, while the platform preserves price transparency, privacy before paid access, and trustworthy post-completion reviews.

## Positioning

This is a construction procurement and service tender system, not a general classifieds site. Its defining mechanism combines structured construction requirements, paid provider access, deadline-based automatic lowest-price selection, recorded agreements, verified completion, and job-bound reviews.

## Operating Context

- Phase 1 market: Georgia.
- Initial interface languages: Georgian and English.
- Initial currencies: GEL and USD.
- Initial marketplace vertical: construction and repair tenders.
- Clients publish tenders for free.
- Providers see masked tender summaries, unlock full details, and then submit offers.
- A mock payment adapter is used while the core workflow is proven. A Georgian-compatible payment provider is integrated later through the same payment contract.
- The winning valid offer is selected at the tender deadline. Lowest price wins; earliest submission breaks an equal-price tie. Clients cannot select a different bidder.

## Capabilities and Constraints

- Responsive web application with client, provider, and administrator workspaces.
- Photos and PDF/JPG project documents.
- Location entry, map pinning, reverse geocoding, and route distance where the vertical requires it.
- Hidden personal contact information and hidden exact location until access is granted.
- Listing access prices from the source documents: one tender USD 1, monthly USD 20, annual USD 200.
- No escrow, legal arbitration, financial-dispute adjudication, or private contractor selection.
- Reviews require a platform-recorded completed agreement and a substantive comment.
- International markets, additional languages, and additional verticals follow the Georgia construction/repair MVP.

## Brand Commitments

- Working project name: `tender-marketplace`.
- The reference application at `C:\Users\mefar\repos\tender-marketplace` may inform business logic and edge cases only. Its visual design is not an authority and must not be copied.
- The interface must communicate reliability, clarity, price transparency, and construction-sector competence without resembling a generic classifieds template.

## Evidence on Hand

- `Product_description.md`: detailed product description and intended business rules.
- `Specs.md`: concise binding requirements and required technology family.
- `C:\Users\mefar\repos\tender-marketplace`: non-authoritative logic reference containing useful workflows and known design/modeling problems.
- No approved logo, photography library, testimonials, customer logos, market statistics, or legal claims are currently available. Future work must not fabricate them.

## Product Principles

1. Prove one complete marketplace loop before adding vertical breadth.
2. Keep tender, bid, agreement, and review lifecycles separate and explicit.
3. Make every commercial or trust decision explainable and auditable.
4. Reveal sensitive information only after a recorded entitlement grants access.
5. Design for Georgian users first while keeping localization and currency boundaries extensible.

## Accessibility & Inclusion

Target WCAG 2.2 AA for all public and authenticated interfaces. Core workflows must support keyboard navigation, visible focus, semantic form errors, reduced motion, sufficient contrast, and Georgian/English content expansion without truncation.
