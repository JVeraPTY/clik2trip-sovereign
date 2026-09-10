# Phase 4 — authorized settlement evidence

Status: **settlement observed on physical hardware on 10 September 2026; one
evidence row still outstanding**. A physical Android arm64 device completed the
whole flow, from a live hold through a biometric authorization to a settlement
verified independently on Sepolia. The deliberate denial run below has not been
performed yet, so this phase is not recorded as passed and Phase 5 must not
start until it is.

Phase 4 passes only when that device completes this flow end to end:

1. Start from a live Phase 3 hold whose countdown is still running.
2. Re-read the hold, its price snapshot, and its exact slot from the Clik2Trip
   Gateway immediately before the final summary is built.
3. Show a frozen summary with amount, network, token, recipient, expiry, the
   estimated fee, and the statement hash.
4. Require an explicit biometric or PIN authorization taken after that summary
   is displayed.
5. Evaluate the deterministic Policy Engine against the summary and the intent,
   and refuse on any mismatch.
6. Send the test USD₮ transfer with WDK on Ethereum Sepolia.
7. Verify the settlement independently: resolve the ERC-4337 UserOperation
   through the bundler, then re-read the receipt, the ERC-20 transfer logs, and
   the confirmation depth from a separate Sepolia JSON-RPC endpoint.
8. Display the result as a sandbox receipt and keep the Clik2Trip booking status
   visibly independent from it.

## Contract boundary

| Field | Value |
| --- | --- |
| Network | Ethereum Sepolia only, chainId `11155111` |
| Test token | `0xd077a400968890eacc75cdc901f0356c943e4fdb`, 6 decimals |
| Transfer path | WDK ERC-4337 UserOperation through the configured bundler |
| Verification RPC | A Sepolia JSON-RPC endpoint independent of the bundler |
| Required confirmations | 2 |
| Authorization TTL | 60,000 ms after the biometric or PIN confirmation |
| Minimum hold remaining | 120,000 ms at authorization time |
| Maximum amount | 100,000,000 base units (100 test USD₮) |
| Replay guard | Per-hold attempt lock plus a ledger of the 16 most recent settled transaction hashes |
| Settlement result label | Sandbox receipt; never a Clik2Trip payment or booking confirmation |

The model never receives a seed, a private key, a signature, or a callable
transfer method. The transfer is prepared from the server's own price snapshot
and executed only after the traveler authorizes the displayed summary.

## Denial coverage under evaluation

The Policy Engine refuses with `DEMO_MAINNET_FORBIDDEN`, `CHECKOUT_EXPIRED`,
`HOLD_EXPIRING`, `CHAIN_MISMATCH`, `TOKEN_MISMATCH`, `RECIPIENT_MISMATCH`,
`AMOUNT_MISMATCH`, `STATEMENT_HASH_MISMATCH`, `HUMAN_AUTHORIZATION_REQUIRED`,
`AUTHORIZATION_EXPIRED`, or `BUDGET_EXCEEDED`. The verifier refuses with
`CHAIN_MISMATCH`, `CHECKOUT_EXPIRED`, `TRANSACTION_FAILED`, `TOKEN_MISMATCH`,
`SENDER_MISMATCH`, `RECIPIENT_MISMATCH`, `AMOUNT_MISMATCH`, `FINALITY_PENDING`,
or `TRANSACTION_ALREADY_USED`. All of these are covered by unit tests. The rows
below record which ones were exercised on the device.

## Build under evaluation

This table is filled. The build below carries the complete Phase 4 code and is
installed on the device; only the run itself is outstanding.

| Field | Value |
| --- | --- |
| Device manufacturer and model | Xiaomi 23117RA68G |
| Android version and API level | Android 16, API 36 |
| CPU architecture | arm64-v8a |
| Build installed on device at | 10 September 2026, 00:39 local, streamed ADB update over the Phase 3 build |
| Release APK SHA-256 | `8cd1dd80531a0125096092abcb8810fdce137b3fc60ddb7fa846685de83ac72c` |
| Release APK size | 256,571,362 bytes |
| Android signature | APK Signature Scheme v2 verified with the local debug certificate |
| JavaScript bundle | Hermes bytecode version 96, rebuilt from the current source; the Policy Engine, verifier, and settled-transaction ledger symbols are present in it |
| Launch check | Passed; the app started with no Java or native crash and the wallet and QVAC state from the previous build survived the update |

Input injection over ADB is blocked on this device because MIUI requires "USB
debugging (Security settings)", which the phone will not enable without a SIM
and a verified Mi account. `uiautomator dump` is also unusable here: the hold
countdown repaints every second, the window never reaches the idle state the
dump waits for, and it returns a stale hierarchy. The rows below must therefore
be observed by hand and captured with `adb exec-out screencap`.

## Defect found and fixed during the first device attempt

The first run on the device failed before any transfer was prepared. The
per-hold attempt lock built its key as `sandbox-payment-attempt:${hold.id}`, and
SecureStore rejects any key outside `[A-Za-z0-9._-]`, so `prepareCheckout` threw
`Invalid key provided to SecureStore` on its first statement. The key is now
built by `sandboxAttemptKey` in `apps/android/src/lib/secure-store-key.ts`,
which replaces every character SecureStore forbids and refuses an identifier
that leaves nothing to key on. The build recorded above contains the fix.

This defect was reachable only on the device: the unit tests never touched
SecureStore, and the failure surfaced the moment a real server-issued hold
identifier was interpolated into a real keystore call.

## Diagnostic ordering fixed during the second device attempt

The second attempt cleared the attempt lock and failed at the fee quote with the
bundler's own `eth_estimateUserOperationGas rpc call failed`. The bundler was
healthy: it answered `eth_chainId` with `0xaa36a7` and listed four supported
entry points. The real cause was an unfunded payer account, confirmed directly
against Sepolia — no contract code at the account, zero native ETH, and a zero
test USD₮ balance. Because the paymaster charges its fee in the same test token,
an empty account makes the bundler's gas estimation fail with an error that
hides the cause.

## Wallet reopening fixed during the third device attempt

The third attempt reached the wallet step and failed with `Wallet with walletId
"clik2trip-sovereign-testnet" already exists`. WDK derives `NO_WALLET` from a
wallet list that is still empty while it resolves what secure storage holds, so
an existing wallet was offered for creation, and creating it throws. The wallet
then sat in `ERROR`, a state whose branch rendered no button at all, leaving no
way to retry without restarting the app.

`openWallet` now unlocks when the wallet list already knows the wallet, and
falls back to unlocking when creation reports that it exists. The button is also
rendered in `ERROR`, and its label follows the wallet list rather than the
aggregate status.

The compatibility gate's own "WDK testnet" card was removed in the same change.
It opened the same `clik2trip-sovereign-testnet` wallet from a second control
that knew nothing about the first, it carried an unfixed copy of the race
described above, and its notice still read "la transferencia aún no está
habilitada", which stopped being true once this phase's transfer was
implemented. The compatibility gate's exit criterion is already recorded in
`docs/compatibility-gate.md` against the APK that passed it, and this phase's
own flow exercises the wallet more thoroughly: it unlocks, derives accounts,
signs, and sends.

`prepareCheckout` now reads the token balance before it quotes the fee and
refuses with `SALDO_USDT_PRUEBA_INSUFICIENTE` when the balance cannot even cover
the amount, so an unfunded demo fails legibly. The balance is checked a second
time against amount plus fee once the quote returns. A bundler error now means
an actual bundler problem.

## Physical-device result

Run completed on 10 September 2026 at 00:51 local on the Xiaomi 23117RA68G.

| Evidence | Result |
| --- | --- |
| Live hold re-read before the summary | Passed; the hold resolved unchanged with a running countdown and status `NUEVA` |
| Frozen summary displayed with amount, network, token, recipient, expiry, fee, and statement hash | Passed; 75.5 USD₮, Ethereum Sepolia chainId 11155111, token `0xd077a400…3e4fdb`, recipient `0xCF053d79…557Fc8`, expiry `2026-09-10T05:52:49.477Z`, fee 2.58705 USD₮, statement hash `0x4d0bfe23…43d1ed` |
| Test USD₮ balance sufficient for amount plus fee | Passed; 100 USD₮ held against 75.5 plus a 2.58705 quote |
| Biometric or PIN authorization required and taken after the summary | Passed; the transfer proceeded only after the device authentication returned success |
| Policy Engine allowed the transfer | Passed; no denial code was raised |
| WDK UserOperation submitted | Passed; UserOperation `0xb1c15322…8fbb8b` |
| UserOperation resolved to a transaction hash through the bundler | Passed; resolved to `0x88eb3c83…d8820b` |
| Independent RPC confirmed chain, success, token, sender, recipient, and amount | Passed; re-verified a second time from the workstation against a public Sepolia endpoint — chainId 11155111, receipt status 1, one ERC-20 transfer of exactly 75,500,000 base units from the payer account to the sandbox merchant in block 11,673,005 |
| Confirmations observed | 2 at verification time, the configured requirement; 12 when re-checked from the workstation |
| Sandbox receipt displayed | Passed; shown as "RECIBO SANDBOX VERIFICADO" with its confirmation count and transaction hash |
| Clik2Trip booking status shown as independent from the sandbox payment | Passed; the receipt read "Payment sandbox: VERIFICADO · Booking Clik2Trip: NUEVA. Son estados independientes." |
| Settled fee against the quote | Settled at 1.468652 USD₮ against a 2.58705 quote; the payer's closing balance of 23.031348 USD₮ accounts for the amount and that fee exactly |
| Second authorization attempt on the same hold refused | Not exercised in this run. The mechanism was observed on the previous hold, whose attempt lock was written and which correctly refuses retries. |
| No seed, private key, full wallet address, or image written to a log | Passed; 16,976 logcat lines inspected with zero occurrences of either full wallet address, of `mnemonic`, `seedPhrase`, `privateKey` or `entropy`, and of any captured-image path |

## Denial run on the device

Record at least one deliberate refusal so the deterministic path is observed and
not only unit-tested. State which denial was provoked and how.

| Evidence | Result |
| --- | --- |
| Denial code provoked | |
| How it was provoked | |
| Transfer prevented | |

## Fee ceiling fixed during the fourth device attempt

The fourth attempt was the first to reach a human authorization. The payer
account held 100 test USD₮, the frozen summary displayed 75.5 USD₮ to the
sandbox merchant on chainId 11155111 with an estimated fee of 2.844336 USD₮,
and the traveler authorized with biometrics. WDK then refused the send with
`Exceeded maximum fee cost for transfer operation.`

`transactionMaxFee` and `transferMaxFee` were both 100,000 base units, that is
0.1 test USD₮. The paymaster charges gas in the same test token, and a real
Sepolia transfer costs far more than that, so the ceiling refused ordinary demo
traffic. Both now read `sepolia.maxFeeBaseUnits`, set to 10 test USD₮.

The more serious defect was the ordering. The app had the quote in hand, showed
it, asked for the fingerprint, and only then hit a ceiling it could have checked
beforehand. It left the flow in `UNKNOWN` — the state that exists for a genuinely
uncertain settlement and tells the traveler not to retry — when nothing had been
submitted at all. `prepareCheckout` now compares the quote against the ceiling
and refuses with `COMISION_EXCEDE_LIMITE` before the summary is authorized, so
the refusal is deterministic and lands in front of the human decision.

Nothing was ever broadcast. Verified directly against Sepolia after the failure:
the payer still held its full 100 test USD₮, the sandbox merchant held zero, and
the payer's smart account had no deployed code. The attempt lock for that hold
was written, so that hold correctly refuses any retry.

## Independence of the two statuses, observed rather than asserted

After the settlement was verified, the Clik2Trip booking left the state it was
in at authorization time. The Gateway later reported `BK-QDV7WL` as `EXPIRADA`
with a `holdExpiresAt` already in the past. The booking was also acted on from
the Clik2Trip website around the same time, so this record does not claim which
of the two ended the hold.

What matters is what did not change. The settlement stands exactly as verified:
receipt status 1 in block 11,673,005, and the sandbox merchant still holding
75.500000 test USD₮. A booking that stopped being live did not, and cannot,
reverse a settled on-chain transfer. This is the independence the architecture
claims, demonstrated by events rather than by a label in the interface.

It also exposes the gap that independence leaves behind. This phase implements
no refund, void, or reconciliation path, so a settled sandbox payment against a
booking that later expires or is cancelled simply stays settled. That is
acceptable for a testnet sandbox that changes no real Clik2Trip payment or
booking, and it is exactly the case the production legal, fiscal, operational,
and security ADR has to answer before any of this leaves testnet.

## Privacy-safe record

The structured record for this run is committed at
`evaluation/device-runs/phase-4-authorized-settlement-2026-09-10.json`. It omits
booking identifiers, customer data, full wallet addresses, and secrets, in line
with the other device-run records. The transaction hash is public chain data on
a testnet and is recorded.

## Result

The settlement path is evidenced. One physical device took a live server hold,
revalidated it, froze a summary, required a human authorization, passed the
deterministic Policy Engine, transferred 75.5 test USD₮ on Ethereum Sepolia
through WDK, and verified that settlement against an endpoint independent of the
bundler. The transfer was re-verified afterwards from a separate machine and
matched on chain, sender, recipient, and amount to the base unit. The Clik2Trip
booking remained `NUEVA` throughout, so the two statuses stayed independent.

Phase 4 is not recorded as passed yet. The deliberate denial run is still
outstanding, and it matters: four defects in this phase were found only by
running it on hardware, and three of them sat directly on the refusal path.
Phase 5 must not start until that run is recorded above.
