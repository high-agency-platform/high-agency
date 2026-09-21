# Season 1 onboarding and QA

Students join through `/join?invite=…`, verify their chosen email with a single-use Firebase email link, and complete the existing two-step profile flow with optional photo/details. Private identity fields stay in `privateProfiles`; public names remain `First L.`. Members enter immediately after completing the profile, including under-18 members. Signup does not collect a parent email or send an approval request. New profiles record `consentStatus: "none"`; historical consent records are retained but do not gate participation.

A `seasonInvites/{sha256(code)}` record authorizes up to 50 distinct verified accounts for 30 days. Claiming writes `memberships/{uid}` and increments `used` atomically. Reopening an invite as the same account does not consume another place. Incomplete profiles can resume by signing in again. Existing profiles and staff-approved mentors retain access; new students do not need `approvedMembers` records. Anyone holding an invite can use it, so share it with the selected cohort only.

After review, create a production invite with:

```sh
./node_modules/.bin/tsx scripts/season-invite.mts --production
```

To revoke an invitation, use its Firestore document ID:

```sh
./node_modules/.bin/tsx scripts/season-invite.mts --production --revoke <document-id>
```

Revocation stops new joins without removing existing members. Sign-in mail fails visibly if the provider is missing; it never logs authentication links. Production requires the existing Resend/Firebase Admin configuration.

## Isolated QA

```sh
npm run dev:qa
```

This starts Next.js on port 3001, Auth on 9099, and Firestore on 8088 under `demo-highagency`. Synthetic data resets when emulators restart. It uses a separate `.next-qa` build directory and never needs production credentials or sends real email.

- Mentor: `http://127.0.0.1:3001/qa` → Mentor view.
- Student: `http://localhost:3001/qa` → Student view.
- New onboarding: either `/qa` → Test onboarding (signs out the account on that hostname). Enter a synthetic email such as `new-member@example.test`, then use **Verify test email** in the QA inbox.

The two hostnames keep Firebase sessions separate. Both reflect current working-tree edits. `/api/access/qa` returns 404 unless development mode, the demo project, and both emulators are configured. Production never returns QA verification links.

## Mentor releases and Slack

At `/mentor/track`, choose **Release**, then **Save track**. Students see each milestone title in the horizontal track row, with a lock on unreleased steps. Only released steps include details and deliverables, refreshed within 10 seconds; direct reads of the full season document are mentor-only. Submission routes also reject unreleased/draft work. Existing tracks with no flags expose only the first milestone until mentors save release choices. Milestone IDs and proof remain stable. Steps with proof cannot be removed or hidden by a save.

Community posting, the feed, and peer proof browsing are removed. Old feed documents are retained but client-inaccessible. Steps default to a direct **Complete** action. Mentors can enable **Require proof** per step; proof is then visible to its author and mentors, and the selected review mode applies. Existing submissions retain their review history when the setting changes. Resources links to `https://high-agency-group.slack.com/archives/C0C26UD8RRB` and the one-page `high-agency-structure.pdf`, which opens in the browser. No temporary-link badge is shown.

## Profile and member experience

Domains and profile links are optional. **Other** reveals a short inline domain field; values over 20 characters show an error and disable saving. Firestore also rejects new operator domain values over 20 characters. Unchanged legacy domains remain editable with the rest of a profile. GitHub, LinkedIn, and website inputs stay visible in one compact row; extra bio and proof fields remain under **More about you**.

The hover-expandable and pinnable right-hand member list shows mentors first, then operators. Selecting a member opens their existing public profile card; private identity fields and emails are not included.

## Verification and reuse

Run `npm run test:rules`, `npm run test:season`, `npm run test:consent`, `npm run test:mentor`, `npm run lint`, and `tsc --noEmit`.

The implementation extends `accessGate`, the existing Firebase email-link endpoints, profile/private-profile writes, `ProfilePhoto`, `SeasonEditor`, and `seasonServer`. `AccessForm` shares the login form with `/join`. The new student season reader is required because Firestore rules cannot hide individual fields inside the existing season document. The local QA routes and launcher provide repeatable isolated browser tests; the existing QA script targets the live project and cannot serve that purpose. The invite script reuses the access service because existing mentor invites are single-use and grant a different role.

Calendar connections sync enrolled sessions, including edits, departures, cancellations, and existing bookings. Failed syncs have a compact retry control; Google OAuth is disabled in emulator QA without extra QA-only page copy. Real Google consent and redirect configuration still need production verification.
