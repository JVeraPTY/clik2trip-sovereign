export const sepolia = {
  network: 'ethereum',
  chainId: 11155111,
  chainIdString: '11155111',
  displayName: 'Ethereum Sepolia',
  explorerBaseUrl: 'https://sepolia.etherscan.io/tx/',
  testUsdtContract: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
  testUsdtDecimals: 6,
  paymasterAddress: '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba',
  /**
   * Ceiling for one transfer's fee, in test USD₮ base units (10 USD₮). The
   * ERC-4337 paymaster charges gas in the same test token, and a real Sepolia
   * transfer quoted 2.844336 USD₮, so a lower ceiling refuses ordinary demo
   * traffic. It still bounds a single settlement's cost, and the Policy
   * Engine's own ceiling bounds the amount separately.
   */
  maxFeeBaseUnits: 10_000_000,
} as const;
