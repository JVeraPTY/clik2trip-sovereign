import { createSepoliaWdkConfig } from '@clik2trip/wdk-wallet';

export const wdkConfig = createSepoliaWdkConfig({
  providerUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL,
  bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL,
  paymasterUrl: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL,
});
