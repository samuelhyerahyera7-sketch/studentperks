# SAFIRE SSO — student verification

Students from a SAFIRE-connected institution can verify instantly through
their university login instead of the manual "upload a student card, wait
for admin review" flow. This is an additional path — students at
institutions not yet on SAFIRE (or who'd rather not use SSO) still use the
existing manual application in `index.html`.

## How it works

1. A student clicks **"Verify instantly with your university login"** on
   the join modal, which links to `GET /api/saml/login`.
2. That endpoint builds a signed SAML AuthnRequest and redirects the
   browser to the SAFIRE Hub (`https://iziko.safire.ac.za/`), which shows
   the student their institution's login page (via the hub's
   discovery/proxy).
3. After they log in, the hub POSTs a signed SAML assertion back to
   `POST /api/saml/acs`.
4. `acs.js` verifies the assertion, checks that the attributes describe a
   `student` affiliation, and upserts the matching `student_applications`
   row with `status='approved'` and `student_email_verified=true` — no
   manual review or card photo needed.
5. The student is redirected back to `/` with `?safire=success&email=...`,
   which triggers the existing Supabase magic-link sign-in flow
   automatically (see `handleSafireReturn()` in `index.html`).

All the crypto/XML handling goes through
[`samlify`](https://www.npmjs.com/package/samlify) (`api/_saml.js`) rather
than being hand-rolled — signature verification is security-critical and
better left to a maintained library.

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
   - SAFIRE's SP requirements
     (https://safire.ac.za/technical/saml2/sp-requirements/) also expect
     `<mdui:UIInfo>` (display name, description, privacy statement URL,
     logo) and technical/support/security contacts in the metadata — those
     aren't in `api/_saml.js` yet and should be added before submitting
     (samlify's `ServiceProvider()` config accepts a `metadata` object with
     these; see samlify's README for the exact shape).

## Testing before registration completes

The test IdP (https://testidp.safire.ac.za/) is reachable through the same
hub today, so `/api/saml/login` → SAFIRE Hub → pick "SAFIRE Test IdP" →
simulate a user works without waiting on the admin/registration steps —
SAFIRE's own onboarding email notes real institution IdPs only start
working once both halves of the join process are complete.

## Affiliation → verification mapping

`api/_saml.js` treats a student as verified when `eduPersonScopedAffiliation`
or `eduPersonAffiliation` contains the value `student` (case-insensitive,
ignoring the `@scope` suffix). Staff/alum/member-only accounts are turned
away with `?safire=error&reason=not_student` rather than silently granted
access, since StudentPerks is student-only.
