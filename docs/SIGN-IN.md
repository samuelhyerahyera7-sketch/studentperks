# Student sign-in

StudentPerks has no passwords.

- **University (SAFIRE) students** sign in with their university login. After
  a successful login the ACS handler signs them straight in (one-time link
  from Supabase Auth's admin `generate_link`), so they land on `/dashboard`.
- **Everyone else** requests a sign-in email from the homepage ("Already
  verified? Sign in") or the dashboard. The email has a link **and** a
  6-digit code. The code can be typed on the page they're on, which avoids
  the link opening inside an email app's built-in browser. Both pages call
  `sb.auth.verifyOtp({ email, token, type: 'email' })`.

## Supabase setup (once)

The code only appears in the email if the template includes it:

1. Supabase dashboard → **Authentication → Email Templates → Magic Link**.
2. Add the code to the body, for example:

   ```html
   <h2>Sign in to StudentPerks</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
   <p>Or enter this code on the StudentPerks page: <strong>{{ .Token }}</strong></p>
   <p>The link and code expire in one hour.</p>
   ```

3. Save. Also check **Authentication → Providers → Email → Email OTP
   length** is 6 (the pages accept 6–10 digits either way).
