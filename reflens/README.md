# RefLens

A global rugby union supporters' platform. Every week's internationals are
uploaded with results and stats, and every key referee and TMO decision is
reviewed by AI against the video evidence and the Laws of the Game.

```
npm install
npm run dev      # http://localhost:5173
npm test         # access rules, stats, scorecards, search, ingest, API validation
npm run lint
npm run build
```

Set `ANTHROPIC_API_KEY` (in `.env.local` or the host's environment) to turn on
real AI reviews. Without it, uploads still work end to end and the review is
clearly marked **Offline preview**.

## What's in it

| Area | What it does |
|---|---|
| **Results** | Weekly rounds of internationals, with every match's score, stats and key decisions |
| **Match page** | Score, side-by-side stats, a timeline of key decisions with AI verdict + reasoning, supporter votes, discussion |
| **Teams** | Standings table; team pages with record, form, stats, and "refereeing impact" (contradicted calls against vs. in favour) |
| **Referees & TMOs** | Scorecard per official: evidence-supported %, contradicted calls, breakdown by law area, supporter agreement |
| **Search** | One box across teams, matches, officials and decisions |
| **Evidence** | Supporters upload a clip or screenshots → frames extracted in the browser → AI review → follow-up questions to the reviewer |
| **Account** | Register by the team you support; free or US$2.50/yr supporter membership |
| **Desk** (admin) | Import the weekly round feed; moderate posts; adopt a supporter's AI review as a decision's official RefLens review |

## Membership

All the rules are in `src/lib/access.js`.

| | Free | Supporter US$2.50/yr |
|---|---|---|
| Results, stats, decisions, AI verdicts | ✓ | ✓ |
| Read discussions | ✓ | ✓ |
| Post and reply (across all teams) | | ✓ |
| Vote on decisions | | ✓ |
| Upload evidence for AI review | | ✓ |
| Ask the AI follow-up questions | | ✓ |

Supporters register under one team, and their posts carry that team's badge,
but they can post in any match's discussion.

## Demo accounts

Sign in on the Account page with no password:

- `aroha@example.com`: free member (sees the upgrade prompts)
- `siya@example.com`: paid supporter
- `desk@example.com`: desk/admin (import rounds, moderate)

## How the AI review works

1. The supporter picks the match and decision (or describes one that isn't
   listed) and adds a video or up to 12 screenshots.
2. `src/lib/frames.js` samples 2–12 still frames in the browser. **The video
   never leaves the device**, which keeps requests small and means RefLens is
   not hosting broadcast footage.
3. `api/review.js` sends the frames plus the context to Claude (`claude-opus-5`,
   adaptive thinking, structured JSON output). The prompts live in `api/_prompt.js`. They tell the model to
   - judge only against the frames and the Laws of the Game;
   - treat the supporter's description as a claim to check, not as evidence;
   - answer "inconclusive" rather than guess;
   - criticise decisions, never the people making them;
   - follow the head-contact process for foul play.
4. The verdict is one of *Supported by evidence*, *Marginal*, *Contradicted by
   evidence* or *Inconclusive*, with a confidence, observations that cite frame
   numbers, the law test applied, what the footage can't show, and the key frame.
5. The supporter can push back ("in frame 4 his arm is tucked…") and the
   reviewer answers with the same frames in view.

Referee scorecards count Supported as 1 and Marginal as ½. Contradicted counts
0, and Inconclusive is left out entirely: footage that can't settle a call is
not evidence against the official.

## Weekly round import

The desk pastes (or a scheduled job posts) one JSON document per round. The
format is documented at the top of `src/lib/ingest.js`. The whole round is
validated before anything is stored. Unknown teams or officials, scores that
don't add up, and unknown law areas all reject the round.

## What this build is, and what isn't real yet

A complete, working front end with a real AI endpoint. As in `powershare/`,
there is no database: members, posts, votes, evidence and imported rounds are
kept in `localStorage`. The data model has the shape the database tables would
have.

**Sample data.** Teams are real. Scores, stats and decisions are generated, and
**the referees and TMOs are fictional on purpose**. Don't publish a performance
score against a real, named official until every decision behind it has real
evidence and a real review.

Before launch:

1. **Server-side auth and subscription check.** `authorize()` in
   `api/review.js` is a stub. Until it checks a real session and an active
   membership, anyone can spend your API credit. There is a per-IP rate limit
   in the meantime.
2. **Payments.** The checkout is simulated (`recordSubscriptionPayment` stands
   in for the payment provider's webhook). At US$2.50, card fees take a big
   share of each payment (Stripe's standard 2.9% + 30¢ is about 15%). Consider
   app-store billing, a regional price, or showing US$2.50 as the headline
   with local-currency pricing.
3. **AI cost per review.** 8 frames (about 6k image tokens) plus reasoning costs
   roughly US$0.05–0.15 per review on Opus. After fees, US$2.50/year pays for
   only about 15–25 reviews, so cap reviews per member (for example 20 a year,
   with top-ups), review official decisions once and share the result with
   everyone, and measure whether a cheaper model holds up for first-pass reviews.
4. **Database and storage.** Move `store.js` to Postgres (Supabase fits well).
   The stored frames are small JPEGs; keep them in object storage, not in the row.
5. **Results and stats feed.** Pick a licensed rugby data provider for the
   weekly round. The ingest validator is ready for it.

## Legal risks

- **Footage rights.** International match footage belongs to broadcasters
  and unions. RefLens links to licensed highlights and never hosts match
  video. Supporter uploads are reduced to still frames on the device, and the
  upload form asks for footage the uploader has the right to share. Get
  advice on fair dealing / fair use for criticism and review in your launch
  markets.
- **Defamation.** Criticising named officials is legitimate when it is about
  decisions and grounded in evidence. The prompts, the discussion placeholder
  and the desk moderation tools all push that way, and every scorecard is
  labelled unofficial. Keep it that way.
- **Not affiliated.** Don't use World Rugby or union marks or logos.
