# Verify once. Save all year.

Use `assets/sections/verify-save/section-reference.png` as the visual source of truth.

## Assets

- `background.svg`: scalable black banner background.
- `brighter-students-mark.png`: transparent handwritten artwork extracted from the approved reference.
- `lime-rays.svg`: decorative lime strokes beside the button.
- `arrow-right.svg`: button arrow.
- `content.json`: exact editable copy and link target.

## Structure

```html
<section class="verify-save">
  <img class="verify-save__mark" src="/assets/sections/verify-save/brighter-students-mark.png" alt="Brighter students, brighter tomorrows" />
  <div class="verify-save__copy">
    <h2>Verify once. Save all year.</h2>
    <p>Join thousands of South African students unlocking exclusive deals, events and opportunities.</p>
  </div>
  <img class="verify-save__rays" src="/assets/sections/verify-save/lime-rays.svg" alt="" />
  <a class="verify-save__button" href="/signup">
    <span>Create your free account</span>
    <img src="/assets/sections/verify-save/arrow-right.svg" alt="" />
  </a>
</section>
```

```css
.verify-save {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 44px auto;
  align-items: center;
  gap: 24px;
  min-height: 130px;
  padding: 24px 5%;
  color: #fff;
  background: #080909 url('/assets/sections/verify-save/background.svg') center/cover no-repeat;
}
.verify-save__mark { width: 125px; height: auto; }
.verify-save__copy h2 { margin: 0 0 6px; font-size: clamp(30px, 3.2vw, 48px); line-height: .98; font-weight: 900; letter-spacing: -.04em; }
.verify-save__copy p { max-width: 570px; margin: 0; font-size: 16px; line-height: 1.3; }
.verify-save__rays { width: 44px; }
.verify-save__button { display: inline-flex; align-items: center; gap: 18px; padding: 16px 28px; color: #080808; background: #b7ff19; border-radius: 999px; font-weight: 900; text-decoration: none; white-space: nowrap; }
.verify-save__button img { width: 20px; height: 20px; }
@media (max-width: 700px) {
  .verify-save { grid-template-columns: 1fr auto; padding: 26px 22px; }
  .verify-save__mark { grid-column: 1 / -1; width: 105px; }
  .verify-save__copy { grid-column: 1 / -1; }
  .verify-save__rays { display: none; }
  .verify-save__button { grid-column: 1 / -1; justify-self: start; margin-top: 4px; }
}
```

Keep the heading, paragraph and button wording as HTML. Do not flatten the entire banner into a single image.
