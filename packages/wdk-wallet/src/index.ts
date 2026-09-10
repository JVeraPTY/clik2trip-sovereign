import { BaseAsset, type WdkConfigs } from '@tetherto/wdk-react-native-core';

import { sepolia } from './sepolia';

export { sepolia } from './sepolia';

export const testUsdtAsset = new BaseAsset({
  id: `eip155:${sepolia.chainId}/${sepolia.testUsdtContract}`,
  network: sepolia.network,
  symbol: 'USD₮',
  name: 'USD₮ de prueba (Sepolia)',
  decimals: sepolia.testUsdtDecimals,
  isNative: false,
  address: sepolia.testUsdtContract,
});

export interface SepoliaEndpoints {
  providerUrl?: string;
  bundlerUrl?: string;
  paymasterUrl?: string;
}

export function createSepoliaWdkConfig(endpoints: SepoliaEndpoints = {}): WdkConfigs {
  const bundlerUrl = endpoints.bundlerUrl ?? 'https://api.candide.dev/public/v3/11155111';
  return {
    networks: {
      [sepolia.network]: {
        blockchain: sepolia.network,
        config: {
          chainId: sepolia.chainId,
          provider: endpoints.providerUrl ?? 'https://ethereum-sepolia-rpc.publicnode.com',
          bundlerUrl,
          paymasterUrl: endpoints.paymasterUrl ?? bundlerUrl,
          paymasterAddress: sepolia.paymasterAddress,
          paymasterToken: { address: sepolia.testUsdtContract },
          safeModulesVersion: '0.3.0',
          transactionMaxFee: sepolia.maxFeeBaseUnits,
          transferMaxFee: sepolia.maxFeeBaseUnits,
        },
      },
    },
  };
}
