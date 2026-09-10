import { useWdkApp, useWalletManager } from '@tetherto/wdk-react-native-core';
import { useCallback } from 'react';

export const demoWalletId = 'clik2trip-sovereign-testnet';

function isAlreadyExists(cause: unknown): boolean {
  return cause instanceof Error && cause.message.includes('already exists');
}

/**
 * The single way this app opens its testnet wallet. Both the onboarding footer
 * and the settlement step go through here, so there is never a second control
 * creating or unlocking the same wallet behind the first one's back.
 *
 * `open` throws on failure; the caller decides how to show it.
 */
export function useDemoWallet() {
  const { state } = useWdkApp();
  const { createWallet, unlock, wallets } = useWalletManager();

  const exists = wallets.some(
    (wallet) => wallet.identifier === demoWalletId && wallet.exists,
  );

  const open = useCallback(async () => {
    if (exists) {
      await unlock(demoWalletId);
      return;
    }
    try {
      await createWallet(demoWalletId);
    } catch (cause) {
      // WDK reports NO_WALLET until its wallet list finishes loading, so a
      // wallet already in secure storage can still be offered for creation.
      if (!isAlreadyExists(cause)) throw cause;
      await unlock(demoWalletId);
    }
  }, [createWallet, exists, unlock]);

  return { status: state.status, exists, open };
}
