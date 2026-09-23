# SAFIRE SSO — student verification

Students from a SAFIRE-connected institution can verify instantly through
their university login instead of the manual "upload a student card, wait
for admin review" flow. This is an additional path — students at
institutions not yet on SAFIRE (or who'd rather not use SSO) still use the
existing manual application in `index.html`.

## How it works

1. On the join modal's step 1, the student picks their university from a
   dropdown (`#jn-sso-institution`) and clicks **"Verify instantly with
   your university login"**, which calls `startInstantVerify()` →
   `GET /api/saml/login?inst=<institution name>`.
2. `login.js` builds a signed SAML AuthnRequest and redirects the browser
   straight to that institution's own login page — it does this by
   appending `&idpentityid=<their IdP's entityID>` to the hub redirect,
   which skips the SAFIRE hub's own institution-picker page entirely. The
   student only ever sees their own university's login screen (e.g. the UP
   Portal), never anything branded "SAFIRE". The `inst` → entityID mapping
   lives in `INSTITUTION_IDP_MAP` in `api/_saml.js`, sourced from
   `https://metadata.safire.ac.za/safire-idp-proxy-metadata.xml` (SAFIRE's
   hub proxies each institution IdP under a `birk.php/<institution-host>`
   entityID — that's the value `idpentityid` needs). Institutions not in
   the map (not yet SAFIRE members, or not in our dropdown) fall back to
   the hub's own picker.
3. After login, the student's IdP shows a one-time SAFIRE consent screen
   ("You are about to log into StudentPerks...") — this is SAFIRE's own
   consent module and can't be skipped or hidden (it's what stops an SP
   from silently harvesting attributes), but it names *our* SP, not SAFIRE,
   once we're registered with a proper display name.
4. The IdP/hub POSTs a signed SAML assertion back to `POST /api/saml/acs`.
5. `acs.js` verifies the assertion, checks that the attributes describe a
   `student` affiliation, and upserts the matching `student_applications`
   row with `status='approved'` and `student_email_verified=true` — no
   manual review or card photo needed.
6. The student is redirected back to `/` with `?safire=success&email=...`,
   which triggers the existing Supabase magic-link sign-in flow
   automatically (see `handleSafireReturn()` in `index.html`). A rejection
   (e.g. `not_student`) redirects back with `?safire=error&reason=...` and
   reopens the join modal so they can fall back to manual sign-up.

All the crypto/XML handling goes through
[`samlify`](https://www.npmjs.com/package/samlify) (`api/_saml.js`) rather
than being hand-rolled — signature verification is security-critical and
better left to a maintained library.

This flow mirrors what other SAFIRE-registered student-deals SPs (e.g.
Varsity Vibe) do in production: full-page redirect (not a popup), direct
institution pre-selection to skip the hub picker, and a custom-branded
error state on affiliation mismatch rather than surfacing SAFIRE's own
error page.

## Environment variables (Vercel project settings)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SAFIRE_SP_PRIVATE_KEY` | Yes | — | PEM private key for the SP. Store with literal `\n` line breaks if your env var UI doesn't support multi-line values — `api/_saml.js` un-escapes them. |
| `SAFIRE_SP_CERT` | Yes | — | PEM certificate matching the private key above. |
| `SITE_ORIGIN` | No | `https://studentperks.co.za` | Used to derive the SP entity ID and ACS URL. |
| `SAFIRE_SP_ENTITY_ID` | No | `${SITE_ORIGIN}/api/saml/metadata` | Override only if SAFIRE assigns a different entityID. |
| `SAFIRE_SP_ACS_URL` | No | `${SITE_ORIGIN}/api/saml/acs` | Override only if the ACS is hosted elsewhere. |
| `SAFIRE_IDP_METADATA_URL` | No | `https://metadata.safire.ac.za/safire-hub-metadata.xml` | The federation's published hub metadata (SPs authenticate against the hub, not individual institution IdPs directly). |

Without `SAFIRE_SP_PRIVATE_KEY`/`SAFIRE_SP_CERT` set, `/api/saml/*` fails
closed (metadata endpoint 500s, login/ACS redirect back with an error) and
the rest of the site is unaffected.

### Generating the SP keypair

```sh
openssl req -x509 -newkey rsa:3072 -keyout sp-key.pem -out sp-cert.pem \
  -days 3650 -nodes -subj "/C=ZA/O=<your legal entity name>/CN=studentperks.co.za"
```

Per SAFIRE's SP requirements, certs must be RSA ≥2048-bit (3072 recommended
for new deployments) and use SHA-256, not MD5/SHA-1 — the command above
satisfies both. Keep `sp-key.pem` out of git; paste both files' contents
into the Vercel env vars above.

## Joining the federation

This code is the *technical* half of joining SAFIRE
(https://safire.ac.za/participants/sp/join/). Two things still need to
happen outside this repo, and both are needed before real institution IdPs
(not just the test IdP) will work:

1. **Administrative** — sign SAFIRE's Participation Agreement via Adobe
   Sign. SAFIRE needs: the full legal name of the signing entity (+
   company registration number, if applicable), and the signer's name and
   email.
2. **Technical registration** — once `SAFIRE_SP_PRIVATE_KEY`/`SAFIRE_SP_CERT`
   are set and deployed, submit our metadata for review:
   - Metadata URL: `https://studentperks.co.za/api/saml/metadata`
   - Validate it first at https://safire.ac.za/technical/resources/validating-metadata/
     (or http://validator.safire.ac.za/) before sending it in.
   - `api/_saml.js`'s `getMetadataXml()` adds everything samlify's
     builder doesn't emit: `<mdui:UIInfo>` (display name, description,
     information/privacy URLs, logo), `<AttributeConsumingService>`
     (`REQUESTED_ATTRIBUTES`), `Organization`, and technical/support/security
     `ContactPerson` elements. It must **not** include
     `mdrpi:RegistrationInfo` — SAFIRE adds that when publishing.
   - Contact addresses are published, so they must be role accounts, not a
     personal inbox. They default to `admin@studentperks.co.za`; override
     with `SAFIRE_TECH_CONTACT_EMAIL`, `SAFIRE_SUPPORT_CONTACT_EMAIL`,
     `SAFIRE_SECURITY_CONTACT_EMAIL` (and `SAFIRE_TECH_CONTACT_NAME`,
     `SAFIRE_ORG_NAME`, `SAFIRE_ORG_URL`, `SAFIRE_LOGO_URL`).
   - The service description deliberately doesn't mention SAFIRE — students
     shouldn't need to know the federation exists.

## Testing before registration completes

The test IdP (https://testidp.safire.ac.za/) is reachable through the same
hub today and works without waiting on the admin/registration steps —
SAFIRE's own onboarding email notes real institution IdPs only start
working once both halves of the join process are complete. It isn't in
`INSTITUTION_IDP_MAP` (it's not a real university, so it's not in the join
modal's dropdown), so to test: pick **"My university isn't listed"** in the
dropdown, which calls `/api/saml/login` with no `idpentityid` hint and
falls through to the hub's own picker — "SAFIRE Test Identity Provider" is
selectable there, and lets you simulate different user types/affiliations.

## Affiliation → verification mapping

`api/_saml.js` treats a student as verified when `eduPersonScopedAffiliation`
or `eduPersonAffiliation` contains the value `student` (case-insensitive,
ignoring the `@scope` suffix). Staff/alum/member-only accounts are turned
away with `?safire=error&reason=not_student` rather than silently granted
access, since StudentPerks is student-only.

## Home institution

The student's institution is the scope of their `student@<scope>`
`eduPersonScopedAffiliation` value (e.g. `student@up.ac.za` → `up.ac.za`),
as SAFIRE recommends. `schacHomeOrganization` is no longer requested. It is
only used as a fallback if an IdP sends it anyway.
