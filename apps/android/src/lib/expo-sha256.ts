import * as Crypto from 'expo-crypto';

import type { Sha256Digest } from './sandbox-checkout';

export const expoSha256: Sha256Digest = (statement) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, statement);
