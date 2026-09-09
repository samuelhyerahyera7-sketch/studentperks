# Codex task: StudentPerks student dashboard

Rebuild the logged-in StudentPerks student dashboard to match the approved mobile dashboard reference exactly in layout, spacing, proportions, typography, lime accents, card styling, deal-card layout, stat tiles and bottom navigation.

## Source of truth

Use the approved student-dashboard screenshot and the approved StudentPerks assets already in the repository as the visual source of truth. Do not redesign the page and do not substitute generic icon-library symbols, emojis or approximate artwork.

Where exact dashboard PNG symbol crops are available under `assets/icons/approved/dashboard-exact/`, use those exact PNGs rather than redrawing them. If that folder is not present yet, do not silently substitute the older approximate SVG set. Keep existing approved icons only where they visually match the reference exactly.

## Dynamic student card

The black StudentPerks wallet card must visually match the approved reference, but all student-specific information must remain live and dynamic. Do not bake example student data into an image.

Bind these fields to the authenticated student's real data:
- first name / display name
- full name
- institution
- verification status
- verification expiry date
- member/card number
- unique wallet/redeem code
- QR code

The QR code must be generated uniquely for each student from the existing StudentPerks wallet/redemption data and must never be a shared static QR image. The member number and any redeem code must also come from each student's record.

Keep the decorative parts of the card static, including StudentPerks branding, black card surface, lime accents and handwritten StudentPerks wording. Render student data, the QR code and dynamic status text as live layers over the card.

## Dashboard layout

Match the approved reference section by section:
1. StudentPerks header with notification icon and profile avatar.
2. Greeting and verified-student badge.
3. Verification institution and expiry information.
4. Large black StudentPerks wallet card.
5. Three statistic tiles for saved amount, claimed deals and saved offers.
6. Active deals section.
7. Expiring-deal notification strip.
8. Recommended-for-you section.
9. Upcoming-for-you section.
10. Recent activity section.
11. Fixed bottom navigation with Home, Deals, Wallet, Saved and Profile.

## Live-content rule

Only display real businesses, offers, events and opportunities returned by the existing database. Do not publish demo brands simply because they appear in the reference screenshot. At present, Crates & Boxes and Custom Mugs are the known live businesses. Preserve the existing database-driven logic so new businesses automatically appear when added.

## Existing functionality

Do not break or replace authentication, verification, database queries, deal claiming, redemption, saved offers, wallet records, QR generation, routes or user profiles. Reuse existing functionality and change only presentation/components where required.

## Responsive behaviour

Treat the supplied mobile reference as the primary exact target. Preserve proportions and spacing closely. Build a responsive desktop/tablet expansion without inventing a different visual language.

## Verification before completion

Run the project build and tests. Check the dashboard at mobile width against the approved reference. Confirm that:
- no generic/emoji icons have replaced the approved symbols;
- example names, member numbers, codes and QR codes are not hard-coded;
- changing the logged-in student changes the card data and QR;
- only real database content appears in deal/event/opportunity sections;
- the dashboard card and bottom navigation visually match the approved reference.

Do not redesign unrelated pages.