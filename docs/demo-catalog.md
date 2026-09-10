# Demonstration catalog, device region and the sandbox tariff

Three changes, made on 10 September 2026, so that the demonstration and the
measurement runs have enough material to be worth watching:

1. A **demonstration catalog** of 52 authored experiences across nine regions of
   Panama, scoped to the device's location.
2. A **device region** resolved once at start-up, from a deliberately coarse fix.
3. A **sandbox tariff**, so a faucet balance of a few tens of test USD₮ funds
   many settlement runs instead of one or two.

None of this changes the boundaries in `AGENTS.md`. Clik2Trip remains the only
source of truth for real catalog, price, capacity, holds, payments and bookings;
the demonstration path never touches it.

## 1. The demonstration catalog

`packages/qvac-edge/src/demo-catalog.ts`.

### Where the data came from

The descriptions are written for this repository. They describe activities that
genuinely exist at the coordinates given — the Miraflores locks, the Otoque day
trip, kitesurf at Punta Chame, Coiba, San Blas — but:

- No booking platform's site was crawled to build the file.
- No text, photograph, price or record was copied from one.
- No real operator is named. Providers are labelled `Operador demo <región>`, so
  a demonstration cannot be mistaken for a listing of a real business.

`priceFrom` is a plausible reference figure for that kind of activity, not a
quote. It exists so the demonstration checkout has a total to freeze.

If real inventory is wanted later, the compliant route is a partner API with
credentials, seeded at build time by a script — not a scraper. That was
considered and deliberately not built.

### How it stays distinguishable from real inventory

Every entry carries `source: 'demo-seed'` and a `demo-` prefixed `tourRefId`,
and this is enforced by test rather than by convention. That marker is carried
all the way to the screen:

- The card in the list shows a `DEMO` pill.
- The detail screen shows a notice before any price, saying the entry is sample
  data and the reservation exists only on this phone.
- The settlement panel repeats it above the authorization button.

The four approved Clik2Trip tours keep `source: 'clik2trip'` and carry **no**
price of their own. The Gateway is the only source of a figure that may be
charged, and the offline snapshot must not be able to imply one.

### Which entries a device ingests

`toursForRegions(regionIds)` returns:

- the four Clik2Trip tours, **always**, whatever the location — letting the real
  payment path disappear because of where the phone is standing would make the
  demonstration worse, not more accurate; plus
- the demonstration entries belonging to the resolved regions.

The RAG workspace is named `clik2trip-<snapshot version>-<regions>`, so moving
regions builds a new corpus and leaves the old one on disk.

The snapshot version moved to `approved-seed-es-2026-09-10-v2`. A device that
ingested v1 re-ingests rather than searching a stale corpus.

## 2. Device region

`packages/qvac-edge/src/regions.ts` and `apps/android/src/lib/use-device-region.ts`.

Twelve regions, each a centroid and a radius. Resolution picks the nearest
centroid the device is actually inside; a fix in uncovered territory falls back
to Panama City rather than claiming a region hundreds of kilometres away.
Neighbouring regions within 150 km of the device are added, which from Panama
City reaches the Pacific islands, Coclé and Portobelo — all ordinary day trips —
without dragging in Chiriquí.

### What is done with the location

- Only `ACCESS_COARSE_LOCATION` is requested. `expo-location` ships
  `ACCESS_FINE_LOCATION` in its own manifest, so that permission is removed at
  merge time via `android.blockedPermissions`; it is never requested.
- The fix is rounded to one decimal — roughly 11 km — inside `coarseFix`, before
  anything else receives it. That is far finer than the 150 km decision it
  feeds.
- Only the resolved region id and name are kept. The coordinates are used to
  pick a region and dropped. Nothing is stored, logged or transmitted.
- A refused permission, a disabled radio, or a fix that never arrives within
  eight seconds are all ordinary outcomes, not failures. Each resolves to the
  fallback region and the onboarding continues. The screen says
  `Sin ubicación: mostrando Ciudad de Panamá` rather than pretending.

## 3. The sandbox tariff

`apps/android/src/config/sandbox-tariff.ts`.

A faucet hands out a few tens of test USD₮. Settling a 75.50 booking total
one-for-one spends the balance in a run or two, which is not enough to gather
evidence or rehearse a demonstration.

### What the tariff does not reduce

The ERC-4337 paymaster charges gas in the same test token. A recorded Sepolia
settlement quoted 2.844336 USD₮ in fee and settled at 1.468652 USD₮, and
`sepolia.maxFeeBaseUnits` caps a single fee at 10 USD₮.

So the fee, not the transferred amount, is what actually bounds how many runs a
balance affords. At roughly 1.5–2.8 USD₮ of fee per settlement, a 23 USD₮
balance funds somewhere around eight to fifteen runs — not hundreds. The tariff
turns the amount from the dominant cost into a rounding error; it does not make
a settlement free, and no configuration here can, because the gas is real.

`EXPO_PUBLIC_SANDBOX_TARIFF_USDT` decouples the two:

| Value | Effect |
| --- | --- |
| unset | 0.01 test USD₮ per settlement |
| a decimal, e.g. `0.05` | that amount per settlement |
| `full` | the frozen booking total, as Phase 4 recorded it |
| anything else | 0.01, and the screen shows `TARIFA_SANDBOX_INVALIDA` |

An invalid value is never silently accepted: it falls back to the default and
says so, rather than letting a typo decide what gets paid.

### Why this does not weaken the authorization

The nominal is a testnet artefact, never a claim about what an experience costs.
The safeguards that make the authorization meaningful are all preserved:

- `WalletCheckout` carries `bookingTotal`, `bookingCurrency` and `tariffMode`
  alongside `amountBaseUnits`.
- The canonical statement — the exact bytes the traveler's biometric or PIN
  authorizes — covers all four. Swapping the booking total behind the traveler
  breaks the hash even when the transferred amount is identical. This is tested.
- The screen shows both figures, never one instead of the other: `Total de la
  reserva: USD 75.50` above `Se transferirá: 0.01 USD₮`, with a note saying the
  second is a testnet nominal.
- The biometric prompt itself names both.
- The Policy Engine, the balance and fee checks, the hold revalidation and the
  independent settlement verification are untouched.

### Effect on recorded evidence

The Phase 4 evidence of 10 September 2026 records `amountBaseUnits: 75500000`
and no statement hash, so nothing recorded is invalidated. That run is
reproducible with `EXPO_PUBLIC_SANDBOX_TARIFF_USDT=full`.

The canonical statement's serialized form did change — three fields were
appended — so statement hashes computed before this change will not reproduce.
No recorded evidence contains one.

## The demonstration booking path

`apps/android/src/lib/demo-booking.ts` and `booking-source.ts`.

A demonstration entry does not exist in the Gateway, so it cannot have a real
hold. `BookingSource` gives the detail screen and the settlement step one
interface with two implementations — the Gateway, and a local one — so neither
screen branches on which it holds, except to say on screen when a hold is not a
reservation.

The demonstration implementation:

- generates availability deterministically from the tour reference and date, so
  the same tour shows the same slots on every run, some days are genuinely full,
  and one day a week has no departure at all;
- freezes a price snapshot from the reference price and the party size;
- expires on the same fifteen-minute clock as a real hold;
- records `{ source: 'demo-seed', bookable: false }` in its own policy snapshot;
- keeps issued holds in a store and **re-reads** them there, so the revalidation
  the settlement step performs before payment is a real re-read rather than a
  tautology.

A demo hold lives in the app process, disappears when the app closes, and is
never sent to Clik2Trip. Nothing is reserved and no operator is contacted.

## Running it

```bash
pnpm install
cp apps/android/.env.example apps/android/.env
pnpm check
pnpm android:prebuild   # required: the location permission changes the manifest
pnpm android:device
```

`pnpm android:prebuild` must be re-run after this change. The Android manifest
gains `ACCESS_COARSE_LOCATION` and drops `ACCESS_FINE_LOCATION`, and a build
from before this change will not have either.
