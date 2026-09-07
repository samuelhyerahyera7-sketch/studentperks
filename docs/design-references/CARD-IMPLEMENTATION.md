# Wallet card and green accent implementation

Do not copy the membership card or handwritten text from the flattened mockup image. Build the card as responsive HTML so student details remain readable, accessible, and connected to real account data.

## Canonical assets

- `/assets/brand/wallet-card-background.svg`: decorative card background only.
- `/assets/brand/lime-underline.svg`: underline beneath a short phrase.
- `/assets/brand/lime-highlight.svg`: broad lime highlight behind selected headline words.
- `/assets/brand/lime-rays.svg`: optional small accent beside a call to action.

## Required wallet card structure

```html
<article class="student-card" aria-label="Verified StudentPerks membership card">
  <div class="student-card__brand">Student<span>Perks</span></div>
  <div class="student-card__details">
    <strong data-student-name>Student name</strong>
    <span data-institution>Institution</span>
    <span class="student-card__verified">Verified student</span>
    <small>Member no. <span data-member-number>SP000000</span></small>
  </div>
  <div class="student-card__qr" data-qr-container></div>
</article>
```

```css
.student-card {
  position: relative;
  min-height: 220px;
  padding: 24px;
  overflow: hidden;
  color: #fff;
  border-radius: 24px;
  background: #0d0d0d url('/assets/brand/wallet-card-background.svg') center/cover no-repeat;
  box-shadow: 0 18px 45px rgba(0, 0, 0, .2);
}
.student-card__brand { font-size: 1.4rem; font-weight: 900; }
.student-card__brand span,
.student-card__verified { color: #b7ff19; }
.student-card__details { display: grid; gap: 6px; margin-top: 54px; }
.student-card__details strong { font-size: 1.35rem; }
.student-card__qr {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 96px;
  aspect-ratio: 1;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
}
```

## Green underline usage

Keep the words as HTML text. Position the underline behind the words as a separate decorative image.

```html
<span class="lime-underlined">Save all year.</span>
```

```css
.lime-underlined { position: relative; display: inline-block; z-index: 0; }
.lime-underlined::after {
  content: '';
  position: absolute;
  z-index: -1;
  left: -2%;
  right: -2%;
  bottom: -.18em;
  height: .34em;
  background: url('/assets/brand/lime-underline.svg') center/100% 100% no-repeat;
}
```

Never place wording inside the underline SVG. Never turn the student name, institution, membership number, verification status, button wording, or slogan into an image.
