# StudentPerks deployment correction task

The deployed site must be brought back to the approved StudentPerks visual system already stored in this repository. Do not invent a new design language. Preserve all existing working authentication, Supabase/database logic, routes, claiming, saved offers, QR generation, wallet records, admin/partner tools and analytics. Change presentation and component structure only where needed.

## Critical diagnosis

The current `index.html` has drifted far away from the approved homepage. It currently uses a dark black theme, Bebas Neue display typography, black hero, dark search, dark category pills and a different visual language. The approved homepage is the white/light StudentPerks design with lime accents, photographic hero, rounded white cards and the exact section order defined in the approved desktop/mobile references.

Use these repository files as source of truth:
- `docs/design-references/public-homepage-desktop.jpg`
- `docs/design-references/public-homepage-mobile.jpg`
- `docs/design-references/DESKTOP-HOMEPAGE.md`
- `docs/design-references/HERO-TEXT-UI.md`
- `docs/design-references/WALLET-SECTION.md`
- `assets/desktop/layout.json`
- `assets/desktop/tokens.css`
- `assets/desktop/backgrounds/hero-table-mountain-clean.webp`
- `assets/desktop/hero-slogan.png`
- `assets/desktop/student-advantage-badge.png`
- `assets/desktop/wallet-slogan.png`
- `assets/desktop/reference-sections/`
- `assets/icons/approved/`
- `assets/sections/verify-save/`
- `assets/layered/backgrounds/`

## Homepage rebuild

Rebuild the presentation of `index.html` so it matches the approved StudentPerks homepage, not the current black/Bebas design.

### Header
- White/light header.
- StudentPerks South Africa logo/branding exactly as approved.
- Desktop navigation should be clean and restrained.
- Mobile should show Sign in and the approved hamburger treatment.
- Remove the current black nav visual treatment.

### Hero
Use exact approved copy:

Same students
brighter tomorrows

Student life costs less here.

Discover verified deals, events and opportunities made for South African students.

Join StudentPerks →
Sign in

- Use `assets/desktop/backgrounds/hero-table-mountain-clean.webp` on desktop.
- Match the approved mobile hero reference below 700 px.
- Use the supplied handwritten artwork and green underline asset rather than inventing a new script treatment.
- Do not use Bebas Neue for the main hero.
- Remove the current all-caps black hero treatment.
- Keep heading, body copy and buttons as live HTML.

### Trust indicators
Match the approved three items:
- Free for students
- Verified offers
- Built for SA students

Use approved artwork/icons only. No emoji and no generic icon library substitutions.

### Search and categories
- Large white search field matching the reference.
- Category chips/icons must match approved StudentPerks artwork.
- Use approved icons under `assets/icons/approved/`.
- Preserve existing search/filter functionality.

### Popular student deals
- Keep real database-driven cards.
- Current known live businesses are Crates & Boxes and Custom Mugs only.
- Do not publish Hungry Lion, Terbodore, CityROCK or any other demo brand just because it appears in a visual reference.
- Do not duplicate the two live businesses simply to fill a grid.
- Card styling must match the approved white rounded StudentPerks deal cards with lime claim CTA treatment.

### How StudentPerks works
Match the approved three-step section and approved icons:
1. Create your free account
2. Verify your student status
3. Claim and redeem your deals

Use the exact approved icons already stored in the repository. Do not use icon libraries or emojis.

### Wallet homepage banner
Use exact approved wording:
- Your deals, all in one place.
- Once verified, your StudentPerks Wallet keeps your claimed offers ready to use.
- Join StudentPerks →
- Your student advantage always on hand

Match `assets/desktop/reference-sections/03-wallet.png` and `docs/design-references/WALLET-SECTION.md`.

### Events and opportunities
- Preserve database-driven content.
- If there are no live records, show polished empty states matching the approved design rather than fake demo events/jobs.
- Keep the exact visual proportions shown in the approved references.

### Verify once section
Rebuild from `assets/sections/verify-save/` and the approved reference. Do not approximate the icons or handwritten decorative parts.

### Final CTA and footer
Restore the approved StudentPerks black closing CTA and approved footer treatment from the reference, rather than carrying the current all-black page theme through the whole site.

## Student dashboard

Use `docs/CODEX-STUDENT-DASHBOARD-FINAL-PROMPT.md` as the primary dashboard specification.

The current dashboard is closer to the approved design than the homepage, so DO NOT replace working dashboard logic. Refine the visual layer only.

Required corrections:
- Match the approved white/light dashboard spacing and proportions exactly.
- Match header logo, notification bell, avatar sizing and spacing to the reference.
- Match greeting size and verified badge.
- Match the large black wallet card proportions, radius, internal spacing, StudentPerks branding and lime details.
- Keep student-specific values fully dynamic: name, institution, verification status, verification expiry, member/card number, unique code and QR.
- The QR must remain unique to each logged-in student and come from the existing wallet/redemption system.
- Never hard-code Alex Maseko, Thando Mokoena, sample member numbers, sample codes or a shared QR.
- Match stat tiles, Active Deals, expiry alert, Recommended for you, Upcoming for you, Recent activity and fixed bottom navigation to the approved screenshot.
- Do not use the approximate `dashboard-symbols.svg` wherever it visibly differs from the reference. Prefer exact approved icon files already in `assets/icons/approved/` where available.
- Do not introduce demo brands to populate dashboard sections. Use live database content only.

## Responsive rules

- Under 700 px: treat the approved mobile references as the exact target.
- 768 to 1199 px: preserve the same visual language with reduced grid columns.
- 1200 px and wider: use the approved desktop composition and the 930 px content width from `assets/desktop/layout.json`, with hero/verification backgrounds allowed to span wider where appropriate.
- No horizontal overflow.
- No stretched logos.
- No clipped text.
- No giant blank spaces caused by having only two live deals.

## Do not break

Before changing markup, identify and preserve all JS selectors, IDs and functions tied to:
- Supabase auth
- account verification
- deal loading
- search/filtering
- claim/redeem actions
- saved offers
- wallet data
- QR generation
- user profile/avatar
- admin/partner routes
- analytics

If a visual rebuild requires moving markup, preserve the same IDs/data attributes or update the related JS carefully. Do not delete working functionality just to simplify the HTML.

## Verification before finishing

Check the finished result against BOTH approved homepage references and the approved dashboard screenshot.

Confirm:
- homepage no longer uses the current black/Bebas theme;
- homepage section order matches the approved reference;
- exact approved hero wording is used;
- approved icons/artwork are used rather than generic replacements;
- only real businesses appear;
- Crates & Boxes and Custom Mugs render correctly;
- dashboard card remains dynamic per student;
- QR/member number/code are never shared or hard-coded;
- auth, claim, save, redeem, wallet and profile functions still work;
- mobile and desktop both visually match the approved StudentPerks versions;
- build/deployment completes without console errors.

Do not redesign unrelated admin or partner functionality unless a shared CSS change accidentally breaks it. Fix visual regressions before finishing.