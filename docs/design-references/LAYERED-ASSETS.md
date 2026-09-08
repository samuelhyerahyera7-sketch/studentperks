# Layered asset implementation

The original approved mockups remain unchanged under `assets/ui-approved/`. The assets in `assets/layered/` are the editable implementation set.

## Folder roles

- `backgrounds/`: clean photographs with no wording, logos, hearts, badges, or buttons.
- `logo-references/`: crops from the approved mockup for placement reference only. Replace these with official partner-supplied logo files before launch.
- `overlays/`: reusable SVG shapes and interface graphics. They contain no changeable wording.
- `content.json`: the exact editable copy shown in the approved mockup.

## Required stack order

```html
<article class="offer-card">
  <img class="offer-card__photo" src="/assets/layered/backgrounds/hungry-lion-food-clean.webp" alt="" />
  <img class="offer-card__logo" src="/assets/partners/hungry-lion.svg" alt="Hungry Lion" />
  <button class="offer-card__heart" aria-label="Save Hungry Lion offer">
    <img src="/assets/layered/overlays/heart-button.svg" alt="" />
  </button>
  <span class="offer-card__badge">MEAL DEAL</span>
</article>
```

```css
.offer-card { position: relative; overflow: hidden; border-radius: 18px; aspect-ratio: 319 / 136; }
.offer-card__photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.offer-card__logo { position: absolute; left: 16px; top: 16px; width: 30%; max-height: 45%; object-fit: contain; object-position: left top; }
.offer-card__heart { position: absolute; right: 10px; top: 10px; width: 34px; border: 0; padding: 0; background: transparent; }
.offer-card__badge { position: absolute; right: 12px; bottom: 12px; padding: 8px 18px; border-radius: 999px; background: linear-gradient(90deg,#b7ff19,#d8ff83); color: #080808; font-weight: 900; }
```

## Rules

1. Never merge wording into a photograph.
2. Never regenerate logos or copy. Use `content.json` for exact wording.
3. Use CSS for buttons, cards, shadows, gradients, and responsive positioning.
4. Use the SVG overlays only for decorative shapes and icons.
5. Use the full approved screenshots to verify final placement and proportions.
6. Treat the reconstructed clean photos as editable implementation backgrounds; retain the approved flattened crops as the visual comparison baseline.
