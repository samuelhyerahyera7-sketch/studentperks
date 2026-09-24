# AI document check (students not on SAFIRE)

Students whose institution isn't on SAFIRE (private colleges, UNISA, etc.)
join by uploading a student card or this year's proof of registration. As
soon as they submit, `POST /api/ai-review-application` asks Claude to read
the upload and compare it with what the student typed in.

- **Auto-approve** only when every check passes: the document is a student
  card or proof of registration, the name and institution match, it shows
  enrolment valid today, there are no signs of editing, the AI is at least
  85% confident, and the student number isn't already approved for someone
  else. The decision is made in code (`api/_ai_verify.js` → `blockers()`),
  not by the AI, so text on a forged document can't approve itself.
- **Everything else stays pending** and shows as *Needs review* in the admin
  dashboard, with the AI's findings and the reason it wasn't auto-approved.
  The AI never rejects anyone. A person makes every rejection.
- Admins can re-run the check from the application modal (pending only, at
  most every 10 minutes per application).

## Setup

1. Run `add-ai-verification.sql` in the Supabase SQL editor.
2. In Vercel, add `XAI_API_KEY` (from console.x.ai) and redeploy. The check
   uses Grok (`grok-4.7`, override with `XAI_MODEL`). Without a key the check
   is skipped and everything stays manual.
3. Optional: set `AI_AUTO_APPROVE=false` to have the AI only flag and
   recommend, never approve by itself.

Grok only reads JPG and PNG images. PDFs (and other formats) are flagged
*Needs review* with a note, for a person to check.

Claude is still supported: with only `ANTHROPIC_API_KEY` set, or with
`AI_PROVIDER=claude`, the check uses `claude-opus-5`, which also reads PDFs.

Each check costs roughly US$0.01 (about R0.20) with Grok.
