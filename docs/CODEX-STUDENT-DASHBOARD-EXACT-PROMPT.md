# Codex task: reproduce the approved StudentPerks student dashboard

Rebuild the logged-in student dashboard to match the approved 706 x 2048 mobile reference as closely as possible. Do not redesign it and do not substitute icon libraries, emojis, generic icons, or newly generated artwork.

## Visual sources of truth
- `assets/ui-approved/student/` contains the approved flattened dashboard artwork/crops.
- `assets/student/wallet-card-template.svg` is the dynamic implementation template for the black StudentPerks wallet card.
- `assets/icons/approved/dashboard-symbols.svg` contains the dashboard symbol sprite. Use these symbols for bell, verified badge, savings/piggy bank, ticket, heart, location, clock, home, deals/tag, wallet, profile/user and arrows.
- Existing approved StudentPerks brand/logo assets remain authoritative.

## Critical dynamic-data rule
The student card must NOT be a static screenshot. Populate it from the authenticated student's real data. At minimum bind:
- student name
- institution
- verification status
- verification-valid-until date where shown on dashboard
- member/card number
- unique wallet/redeem code if the existing data model has one
- QR payload and QR image

Each student must receive their own values. Never hard-code Thando Mokoena, Alex Maseko, SP2507884430, any sample QR, sample redemption code, or sample card number. Do not use the QR placeholder from the SVG in production. Generate/render the QR from the existing unique student wallet/redemption identifier and preserve existing security rules.

## Wallet card appearance
Match the approved black card: rounded black textured/subtle layered background, StudentPerks South Africa branding at upper left, dynamic student identity at lower left, lime verified marker, handwritten white/lime slogan treatment, QR in a white rounded square on the right, and lime Open wallet button. Preserve the proportions and spacing from the approved dashboard reference. The separate promotional card reference is visual guidance only; its sample name and QR are not production data.

## Dashboard layout
Match the reference order and styling:
1. StudentPerks header with notification bell and profile avatar.
2. `Hi, {firstName}` plus verified-student pill, institution and verification validity.
3. Dynamic black wallet card.
4. Three stats cards: amount saved, claimed deals, saved offers.
5. Active deals.
6. Expiring-deal notice.
7. Recommended for you.
8. Upcoming for you.
9. Recent activity.
10. Fixed bottom navigation: Home, Deals, Wallet, Saved, Profile.

Use live database content. Do not publish demonstration brands as real deals. At present the live businesses are Crates & Boxes and Custom Mugs. Other brands visible in the approved mockup are layout/visual references unless they later exist as live database partners.

## Functional requirements
Preserve all existing authentication, database queries, routes, claim/redeem logic, saved offers, wallet behaviour and navigation. Wire the Open wallet button to the existing wallet route/action. The QR must remain scannable and student-specific. If a required dynamic field is absent, add the smallest safe data/model integration rather than hard-coding a sample value.

## Responsive implementation
The 706 px-wide approved mobile dashboard is the primary source of truth. Reproduce it first, then adapt cleanly to narrower phones and desktop without changing the visual language. Do not stretch raster artwork. Do not bake dynamic text into images.

## Verification
Run the project build/tests after implementation. Compare the rendered mobile dashboard against the approved reference section by section. Fix spacing, radii, icon sizing, typography, lime treatments, card proportions and bottom navigation before finishing.