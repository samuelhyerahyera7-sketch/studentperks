# Codex task: assemble the exact approved StudentPerks public homepage

Do not redesign the StudentPerks homepage.

Read these files before editing code:

1. `docs/design-references/EXACT-PUBLIC-HOMEPAGE-ASSEMBLY.md`
2. `docs/design-references/APPROVED-ASSETS.md`
3. `docs/design-references/public-homepage-mobile.jpg`
4. `docs/design-references/public-homepage-desktop.jpg`

The September 7 mobile reference is the visual source of truth. The desktop version must be a responsive expansion of that same UI, not a different design.

## Use the exact approved assets already in GitHub

Use the artwork in:

`assets/ui-approved/public/`

Required exact approved artwork includes:

- `hero-approved.png`
- `deal-crates-boxes-approved.png`
- `wallet-banner-approved.png`
- `partner-banner-approved.png`
- `final-cta-approved.png`

Use the repo SVG icon family under:

- `assets/icons/`
- `assets/icons/approved/`
- `assets/brand/`

Always choose the latest approved variant when multiple icon versions exist.

Do not use emojis, Lucide, Font Awesome, Material Icons or newly invented icons where the approved SVG exists.

## Live business rule

Only these businesses are currently confirmed live:

- Crates & Boxes
- Custom Mugs

Crates & Boxes may use `assets/ui-approved/public/deal-crates-boxes-approved.png` where appropriate.

Custom Mugs must use the real content/image/logo already available from the application/database. Do not invent any missing Custom Mugs information.

Do not publish Hungry Lion, Terbodore or CityROCK as live businesses. Their approved crops are visual layout references only.

Do not duplicate Crates & Boxes or Custom Mugs to fill the grid.

## Homepage structure

Match the approved reference in this order:

1. StudentPerks South Africa header
2. Approved hero visual treatment
3. Free for students / Verified offers / Built for SA students indicators
4. Large search field
5. Rounded category pills
6. Popular student deals
7. How StudentPerks works
8. Your deals, all in one place Wallet section
9. Events for students
10. Student opportunities
11. Want to reach verified students partner section
12. Ready to start saving black CTA
13. StudentPerks footer

## Hero copy

Use exactly:

Same students
brighter tomorrows

Student life costs less here.

Discover verified deals, events and opportunities made for South African students.

Join StudentPerks →

Sign in

Preserve the approved lime underline/highlight and handwritten treatment using the existing assets in the repository. Do not replace it with a normal CSS underline.

## Wallet copy

Use exactly:

Your deals, all in one place.

Once verified, your StudentPerks Wallet keeps your claimed offers ready to use.

Join StudentPerks →

StudentPerks

Your student advantage always on hand

Use the exact approved Wallet artwork already in the repo when needed to preserve the handwritten/decorative visual treatment.

## Layout and functionality

Rebuild the UI with real responsive HTML/CSS/components. Do not simply show the full-page screenshot as the website.

Keep navigation, buttons, search, authentication and database-driven content functional.

Preserve existing routes, Supabase/database access and authentication.

Use approved raster artwork for decorative/visual elements that cannot be reproduced exactly with live CSS, while keeping functional copy and controls live whenever practical.

Match:

- card radii
- spacing
- lime colour
- black/white balance
- typography hierarchy
- shadows
- icon sizing
- category chip shapes
- deal-card proportions
- handwritten marks
- section spacing
- mobile two-column deal layout
- desktop responsive expansion

Do not create a separate desktop design language.

## Empty states

If database-backed events or opportunities do not exist, show a polished empty state using the same visual language. Do not invent fake events/opportunities.

## Test sizes

Mobile:
- 360px
- 390px
- 430px
- 706px reference width

Desktop:
- 1024px
- 1280px
- 1440px
- 1920px

Check for no horizontal overflow, no clipped wording, no distorted artwork and no stretched logos.

Run the existing build and tests before completion.

Then report:

1. files changed
2. exact approved assets used
3. icons used and their paths
4. live businesses rendered
5. reference-only businesses excluded
6. routes preserved
7. build/test status
8. any remaining visual differences from the approved September 7 mockup
