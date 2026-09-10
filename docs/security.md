# Security model

The model can produce a structured recommendation and request that the app prepare a checkout. It cannot access the seed, private key, signing operation, or transfer method. The deterministic Policy Engine compares the persisted checkout with the user's reviewed intent immediately before WDK is invoked.

The application is testnet-only. It pins chain ID, token contract, recipient, amount, statement hash, hold expiry, authorization expiry, and a maximum demo amount. Any mismatch denies the transfer with a stable code.

Images remain in application-private temporary storage only while analysis is in progress and are always deleted when analysis finishes. Performance records contain hashes and aggregate timing only. They never include images, prompt bodies, seed phrases, private keys, or complete wallet addresses.

Offline evidence is derived from Android connectivity state through `expo-network`; it does not call an external reachability service. A run is marked offline only when the device reports no active network before and after inference and no connected event is observed during the run. Unknown connectivity is recorded as online rather than producing a false offline claim.

`EXPO_PUBLIC_*` values are public build configuration and must not contain secrets. Android signing credentials live only in GitHub Actions Secrets. A production wallet or mainnet deployment requires a separate security review and legal and fiscal ADR.

The connected commerce step calls `https://www.clik2trip.com/graphql` for
non-AI catalog, availability, and hold operations. Requests use HTTPS, disable
caching, reject redirects, and validate both variables and responses. No image,
model output, local profile, seed, or signing capability is sent to this API.
There is no remote inference endpoint or fallback.
