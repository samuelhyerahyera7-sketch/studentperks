# Exact StudentPerks public homepage assembly guide

This guide is for rebuilding the approved September 7 StudentPerks public homepage as closely as possible from the exact assets already stored in this repository.

## Source of truth

Use these references first:

- `docs/design-references/public-homepage-mobile.jpg`
- `docs/design-references/public-homepage-desktop.jpg`
- `docs/design-references/APPROVED-ASSETS.md`

Do not create a new visual direction. Do not generate replacement icons, handwritten graphics, photographs, logos, decorative strokes, card artwork, or section banners when an approved asset already exists.

## Exact raster artwork already in GitHub

Use the approved raster artwork under `assets/ui-approved/public/`:

- `hero-approved.png` - exact approved mobile hero artwork and visual treatment
- `deal-crates-boxes-approved.png` - exact Crates & Boxes deal artwork
- `wallet-banner-approved.png` - exact approved Wallet banner artwork
- `partner-banner-approved.png` - exact approved business-partner banner artwork
- `final-cta-approved.png` - exact approved closing black CTA artwork

The following files remain reference-only because these businesses are not confirmed live partners:

- `deal-hungry-lion-approved.png`
- `deal-terbodore-approved.png`
- `deal-cityrock-approved.png`

Never publish these reference-only brands as live deals unless the database later confirms them as live.

## Live businesses

At present, the public homepage must treat only these businesses as live:

1. Crates & Boxes
2. Custom Mugs

For Crates & Boxes, use its approved artwork where appropriate.

For Custom Mugs, use the real business image/logo/content already supplied by the application/database. Do not invent a logo, offer, percentage, location, photograph, or wording just to make it match the reference.

Do not duplicate Crates & Boxes or Custom Mugs to fill empty card slots.

## Exact interface symbols

Use the SVG files already in `assets/icons/` and especially the latest approved versions under `assets/icons/approved/` where available.

The homepage visual language must use the repo assets rather than emojis, Lucide, Font Awesome, Material Icons, or newly generated replacements.

Required UI symbols include:

- search
- menu
- user/profile
- arrow right
- lock
- location
- food
- entertainment
- fashion
- travel
- tech
- deals/all
- trust/verification/student indicators
- How StudentPerks Works step icons

Use the latest approved SVG variant for any icon that has multiple versions.

## Decorative graphics and handwritten treatments

Use existing approved assets in the repo for:

- `Same students / brighter tomorrows`
- lime hand-drawn underline/highlight
- StudentPerks decorative lime strokes
- Wallet handwritten slogan/treatment

Do not substitute a generic script font when an approved graphic is available.

## Required page order

Match the approved mobile homepage structure:

1. Header
2. Hero
3. Three trust indicators
4. Search field
5. Category pills
6. Popular student deals
7. How StudentPerks works
8. Wallet banner
9. Events for students
10. Student opportunities
11. Business partner banner
12. Ready to start saving CTA
13. Footer

Desktop must be a responsive expansion of this same design language, not a different website design.

## Important implementation rule

Approved full-section raster crops may be used as exact visual references, but interactive interface text, buttons, search fields, navigation, deal data and routes should remain live HTML/components whenever practical. Decorative artwork that Codex cannot reproduce accurately may use the exact approved image asset.

## Content policy

The reference mockup contains demonstration brands and demonstration events/opportunities. They show layout only. Database content decides what is actually rendered live.

Only Crates & Boxes and Custom Mugs are confirmed live businesses at the time of this guide.
