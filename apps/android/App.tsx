import 'react-native-get-random-values';

import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { StatusBar } from 'expo-status-bar';

import wdkBundle from './.wdk-bundle/wdk-worklet.bundle.js';
import { CompatibilityGate } from './src/components/CompatibilityGate';
import { wdkConfig } from './src/config/wdk';

export default function App() {
  return (
    <WdkAppProvider wdkConfigs={wdkConfig} bundle={{ bundle: wdkBundle }}>
      <StatusBar style="dark" />
      <CompatibilityGate />
    </WdkAppProvider>
  );
}
