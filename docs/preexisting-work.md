# Pre-existing work boundary

The hackathon repository starts on 9 September 2026. The following assets existed before implementation began and must remain visibly disclosed:

- The Clik2Trip and ClikToTrip names, brand assets, product concept, and public website at https://www.clik2trip.com/es/.
- The curated Costa Rica marketplace and its provider and tour catalog.
- The Next.js web application and operations and provider interfaces.
- The GraphQL Gateway and Search, Booking, Payments, and Notification services.
- The PostgreSQL, Redis, SQS, SES, S3, CloudFront, ECS, CDK, monitoring, and deployment work in the original repository.
- Booking availability, Redis hold, state-machine, payment idempotency, webhook, voucher, and notification flows.
- The business report and technical RFC dated 8 August 2026.
- The final business report and RFC 002 prepared before code implementation on 9 September 2026.

New hackathon work is limited to this repository: the Android experience, QVAC and VisionPsy integration, local travel memory and RAG, typed mobile Gateway client, Policy Engine, WDK wallet integration, testnet checkout experience, settlement-verifier adapter, performance evidence, evaluation dataset, GitHub workflows, APK, and demo materials.

The Android client's visual identity is pre-existing Clik2Trip work. `apps/android/assets/clik2trip-mark.png` is the existing brand mark, copied unchanged, and the tokens in `apps/android/src/theme/brand.ts` are transcribed from the web application's `apps/web/src/app/globals.css`. The web application remains the source of truth for both; only their application to this Android screen is new hackathon work. The brand typeface, Plus Jakarta Sans, is not bundled here: the web app self-hosts it as `woff2`, which React Native cannot load.

The four-tour offline snapshot in `packages/qvac-edge/src/tourism.ts` is derived from the pre-existing Clik2Trip development catalog. The snapshot packaging and local QVAC retrieval code are new hackathon work; the tour titles and facts are pre-existing content. Tours owned by the suspended seed provider are deliberately excluded.

Before submission, add the immutable commit or tag that represents the original ClikToTrip baseline and the first commit of this repository.
