# Phase 3 — connected commerce evidence

Status: **passed on physical Android hardware, 9 September 2026**.

Phase 3 passes only when the physical Android device completes this flow through
the public Clik2Trip GraphQL Gateway:

1. Select one recommendation produced by the local Phase 2 flow.
2. Resolve the current catalog record by its known slug and verify its
   `tourRefId` against the local recommendation.
3. Read current availability and display only unblocked slots with enough
   `spotsLeft`.
4. Re-read the catalog record and exact slot immediately before the mutation.
5. Create a guest booking hold and display the immutable price snapshot,
   booking code, and server-provided expiry as a live countdown.
6. Make no payment and never infer a booking confirmation from the hold.

## Contract boundary

| Field | Value |
| --- | --- |
| Gateway | `https://www.clik2trip.com/graphql` |
| Catalog source | Search Service projection through Federation |
| Availability and hold owner | Booking Service through Federation |
| Mobile transport | HTTPS POST, redirects rejected, `no-store` |
| Validation | Zod on variables, GraphQL envelopes, and returned domain objects |
| Hold duration | 900 seconds, supplied by the server as `holdExpiresAt` |
| Demo customer | Reserved `example.com` address; no personal data required |
| Release APK SHA-256 | `cfd4359fb8ed22faa4a8ce8b9861a0044b12d897a0b33fd80b98174a804403f2` |
| Release APK size | 256,545,218 bytes |
| Android signature | APK Signature Scheme v2 verified |

The client stores no live price or capacity as local truth. The offline catalog
contains neither field. The hold response's `priceSnapshot` is displayed as the
frozen amount for the next phase.

## Result

| Evidence | Result |
| --- | --- |
| Real Gateway contract probe | Passed; seven public tours returned on 9 September 2026 |
| Real availability probe | Passed; live slots returned with capacity, reserved, active-hold-adjusted `spotsLeft`, and block state |
| Typed client unit and contract-shape tests | Passed |
| Release APK build and installation | Passed; installed over the prior build on the physical Android device without clearing cached models |
| Physical-device price and capacity revalidation | Passed; the selected recommendation resolved to the same live `tourRefId`, USD 75.50 per person, with five spots left |
| Physical-device hold creation | Passed; one traveler, future slot on 11 September 2026 at 08:00, using only reserved demo customer data |
| Frozen total and visible expiry countdown | Passed; server snapshot displayed USD 75.50 and the countdown was observed at 14:31, with an explicit no-payment notice |

No payment intent, transfer, or booking confirmation was created or inferred in
this phase. Phase 4 may now start.
