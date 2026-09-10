/** @type {import('@tetherto/wdk-worklet-bundler').WdkBundleConfig} */
module.exports = {
  networks: {
    ethereum: {
      package: '@tetherto/wdk-wallet-evm-erc-4337',
    },
  },
  transport: 'hrpc',
  output: {
    bundle: './apps/android/.wdk-bundle/wdk-worklet.bundle.js',
    types: './apps/android/.wdk-bundle/wdk-worklet.bundle.d.ts',
  },
  options: {
    targets: ['android-arm64'],
    convertEsmToCjs: true,
  },
};
