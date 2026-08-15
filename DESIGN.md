---
name: Tender
description: A focused, trustworthy interface for Georgia's construction marketplace.
colors:
  ink: "#09090b"
  body: "#3f3f46"
  muted: "#71717a"
  page: "#ffffff"
  subtle: "#fafafa"
  pressed: "#f4f4f5"
  border: "#e4e4e7"
  border-strong: "#a1a1aa"
  trust: "#047857"
  trust-soft: "#ecfdf5"
  error: "#b42318"
  error-soft: "#fef3f2"
  focus: "#2563eb"
typography:
  display:
    fontFamily: "Geist Sans, Noto Sans Georgian, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.875rem, 6vw, 2.5rem)"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Geist Sans, Noto Sans Georgian, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Sans, Noto Sans Georgian, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Sans, Noto Sans Georgian, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "8px"
  segmented: "10px"
  status: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    height: "44px"
---

# Design System: Tender

## Overview

**Creative North Star: "Focused Column"**

Tender uses a deliberately narrow task frame to make commercial identity feel calm, exact, and trustworthy. Vercel is the craft benchmark for restraint and finish, not a template: Tender's verification states, capability truth, and Georgian-first typography make the world its own.

The system is typographically led and nearly monochrome. Negative space carries hierarchy; crisp borders describe controls; emerald appears only when trust is established; red appears only when repair is required. Interfaces state what is true and never fill an unfinished marketplace with decorative or fabricated content.

**Key Characteristics:**

- One stable, top-anchored task frame across pending, error, and success states.
- Georgian and English receive equal hierarchy, target size, and copy density.
- Flat white surfaces, near-black actions, crisp neutral rules, and rare semantic color.
- Direct-on-page forms instead of floating cards or marketing side panels.

## Colors

The palette is restrained and operational: neutral ink and paper own the interface, while semantic color is scarce enough to remain meaningful.

### Primary

- **Tender Ink:** The governing near-black for primary actions, headings, and high-confidence text.
- **Verified Emerald:** Reserved for verified identity, safely active access, and completed progress.
- **Repair Red:** Reserved for invalid fields, denial states, and actions the user must repair.
- **Focus Blue:** Used only for keyboard focus and active input focus, where familiarity outranks brand color.

### Neutral

- **Clear Paper:** The page and control surface.
- **Quiet Paper:** The subtle hover and low-emphasis surface.
- **Pressed Paper:** Segmented-control beds and neutral state halos.
- **Working Graphite:** Body copy that supports rather than competes with headings.
- **Muted Graphite:** Descriptions, inactive progress, and secondary metadata.
- **Hairline / Strong Hairline:** Default and interactive border roles.

### Named Rules

**The Scarce Signal Rule.** Emerald means verified or safely active; red means repair; blue means focus. Never use those colors as decoration.

**The Paper-and-Ink Rule.** White and near-black must still describe the page when every semantic color is removed.

## Typography

**Display Font:** Geist Sans with Noto Sans Georgian glyph fallback  
**Body Font:** Geist Sans with Noto Sans Georgian glyph fallback

**Character:** Geist provides compact, professional Latin forms; Noto Sans Georgian supplies a strong native Georgian texture without changing the hierarchy. Both scripts use the same roles and spacing logic.

### Hierarchy

- **Display** (650, fluid 30–40px, 1.08): page task and workspace headings only.
- **Title** (600, 18px, 1.5): state, empty-state, and section titles.
- **Body** (400, 16px, 1.5): instructions and explanatory copy inside the 460px measure.
- **Label** (600, 14px, 1.5): sentence-case field and capability labels.
- **Supporting** (400, 13px): field descriptions, inactive progress, and secondary metadata.

### Named Rules

**The Equal-Script Rule.** Georgian may wrap earlier, but it is never reduced to a smaller role or lighter emphasis than English.

**The Tight-Heading Rule.** Display headings use compact tracking; body copy never inherits display compression.

## Layout

Identity and workspace surfaces use a 460px maximum content measure. The frame is centered horizontally and anchored with 48–104px of responsive top space below a 64px header. Desktop adds negative space instead of additional regions or marketing content.

At 608px and below, the frame becomes full width with 20px inline gutters. The header stays compact, and Georgian copy wraps without truncation. Form fields stack in one column; only the workspace switcher uses a paired layout, and each target remains at least 44px tall.

Spacing follows a 4px base with recurring 8, 12, 16, 24, and 32px intervals. Related label/description/control content stays close; transitions between progress, heading, form, and workspace regions receive the larger steps.

**The Stable Anchor Rule.** State changes replace content inside the same frame. Pending, invalid, expired, reused, success, and access-denied states do not recenter or jump vertically.

## Elevation & Depth

Primary surfaces are flat. Hierarchy comes from whitespace, one-pixel rules, tonal surface changes, and type—not shadows. The contextual help overlay is the sole ambient lift (0 12px 28px rgb(9 9 11 / 8%)) because it temporarily overlaps the page; cards and forms remain shadowless.

**The Flat-by-Default Rule.** A border or tonal shift must solve separation before elevation is considered.

## Shapes

Controls use gently curved 8px corners; the workspace switcher bed uses 10px to contain 8px destinations. Status dots are circular. Borders are crisp, one pixel, and neutral at rest. The system does not use ornamental clipping, oversized pills, or container geometry around whole forms.

## Components

### Buttons

- **Shape:** 8px corners and a minimum 44px target.
- **Primary:** Tender Ink on Clear Paper text, full width inside task forms.
- **Secondary:** Clear Paper with a Hairline border and Tender Ink text.
- **Hover / Focus:** Short 160ms exponential ease-out color/border transition; familiar blue focus ring with 3px separation.
- **Pending:** Keep the action label visible, append lower-emphasis status copy, disable duplicate input, and never collapse to a spinner-only control.

### Inputs / Fields

- **Style:** Clear Paper, Hairline border, 8px corners, 44px minimum height.
- **Focus:** Focus Blue border with a restrained translucent ring.
- **Error:** Repair Red border and specific repair copy below; form-level errors link back to each field.
- **Structure:** Label, optional description, control, then error. Password-manager autocomplete and native input semantics remain intact.

### Navigation

The 64px header holds the wordmark, native help disclosure, and one route-preserving locale destination. Actions are text-led and maintain 44px targets. A dual-capability workspace adds a compact two-part segmented switcher; single-capability users receive no unavailable destination.

### Progress Rail

Account, verification, and profile appear as three equal columns with one-pixel top rules. Completed/current steps use Verified Emerald; future steps remain neutral. The rail communicates position without gamification and disappears where it adds no information.

### Status and Empty States

Terminal auth states use a small semantic dot, concise title/body, and the next safe action inside the stable frame. Workspace empty states use horizontal rules and truthful copy rather than illustrations, cards, metrics, or sample marketplace records.

### Map

The map is a control, not a canvas: it takes the full 460px measure at 260px tall (220px at ≤608px), inside the same one-pixel border and 8px radius as an input. Raster basemap tiles are desaturated so the page stays paper-and-ink and the marks on top stay legible. A precise location is a near-black circular pin with a white ring; an approximate location is a translucent ink area circle and never a pin. Zoom controls are restyled to match secondary buttons, and tile attribution is always visible at Supporting size in Muted Graphite. Scroll-wheel zoom is off so a map inside a scrolling page never traps the page.

**The Quiet-Basemap Rule.** The basemap is context, not content. It is desaturated so the pin, the area circle, and the surrounding form remain the loudest elements.

**The Coarse-Circle Rule.** A map shown before entitlement draws an area, never a point, and that area is sized from the real coordinate coarsening rather than a chosen radius. Drawing a smaller circle would imply precision the viewer was never given.

**The Map-Is-Enhancement Rule.** A map never becomes the only way to complete a task. The latitude and longitude fields stay visible and functional beside it, so the location can be set without a pointer, without tiles, and without sight of the basemap.

## Do's and Don'ts

### Do:

- **Do** keep primary identity tasks inside the stable 460px measure.
- **Do** use sentence-case labels and plain, specific repair copy.
- **Do** preserve the action label during pending states and protect against duplicate submission.
- **Do** reserve emerald for verified trust, red for repair, and blue for focus.
- **Do** test Georgian and English at desktop and mobile widths.

### Don't:

- **Don't** wrap primary forms in floating cards or add a split-screen marketing panel.
- **Don't** use gradients, glass effects, decorative shadows, or fabricated illustrations.
- **Don't** introduce fake tenders, bids, ratings, revenue, or statistics to fill empty workspaces.
- **Don't** expose capability, restriction, verification, or actor identity as editable controls.
- **Don't** use semantic color as decoration or communicate status by color alone.
