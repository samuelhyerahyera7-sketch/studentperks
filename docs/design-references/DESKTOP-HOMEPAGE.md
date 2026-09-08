# Approved desktop homepage implementation pack

The full visual reference is `docs/design-references/public-homepage-desktop.png`. Use the six files under `assets/desktop/reference-sections/` for section-by-section comparison.

## Canonical desktop assets

- `assets/desktop/backgrounds/hero-table-mountain-clean.webp`: clean hero photograph with no baked-in copy.
- `assets/desktop/layout.json`: reference viewport, section measurements, breakpoints and live-business policy.
- `assets/desktop/tokens.css`: desktop design tokens.
- `assets/desktop/hero-slogan.png`: placement reference for the hero handwritten slogan.
- `assets/desktop/student-advantage-badge.png`: placement reference for the black brush badge.
- `assets/desktop/wallet-slogan.png`: placement reference for the wallet handwritten slogan.
- `assets/sections/verify-save/`: complete layered verification banner kit.
- `assets/layered/backgrounds/`: reusable clean offer photography.
- `assets/icons/approved/`: approved icon family.

The three handwritten crops are visual references from the flattened mockup. Prefer live HTML using a handwritten font or properly licensed final artwork. Do not use rectangular crops if their background edges are visible against the clean hero.

## Desktop order

1. Header
2. Hero with heading, search and three trust indicators
3. Category filters
4. Popular deals
5. Student wallet banner
6. Events and student opportunities
7. Verify once, save all year banner
8. Footer

## Content rules

Only Crates & Boxes and Custom Mugs are currently live. Brands visible in the mockup are layout demonstrations and must not be published as partners. Render real database offers only. Do not duplicate deals to fill the five-card desktop grid. If no events or opportunities exist, use a polished empty state.

## Hero rules

Use `hero-table-mountain-clean.webp` as the photographic layer. Add the heading, highlight, search, trust indicators and decorative marks separately. Keep the left third available for the heading and search. Never merge wording into the photograph.

## Responsive behaviour

- At 1200 px and wider, centre content in a maximum width container while allowing the hero and verification banner backgrounds to span the viewport.
- Between 768 and 1199 px, reduce grid columns and preserve consistent card proportions.
- Below 700 px, switch to the approved mobile layout reference.
- Category chips scroll horizontally when they do not fit.
- Deal cards may use two columns on tablets and one or two columns on phones depending on available width.
- Never introduce large blank areas simply because fewer live deals exist.

## Verification checklist

- Exact section order
- Only real businesses and database content
- Approved SVG icon paths
- No emojis or icon libraries
- No full-page screenshot used as implementation
- No text baked into photographs
- No horizontal overflow
- No stretched logos or images
- No merged or clipped wording
- Existing authentication, database and routes preserved
