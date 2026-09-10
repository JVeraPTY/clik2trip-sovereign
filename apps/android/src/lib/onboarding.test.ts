import { describe, expect, it } from 'vitest';

import {
  canDismissOnboarding,
  nextOnboardingStep,
  onboardingProgress,
  type OnboardingStep,
  type OnboardingStepStatus,
} from './onboarding';

function steps(...statuses: OnboardingStepStatus[]): OnboardingStep[] {
  return (['vision', 'catalog', 'wallet'] as const).map((id, index) => ({
    id,
    label: id,
    technical: `${id}-artefacto`,
    status: statuses[index] ?? 'PENDING',
  }));
}

describe('onboarding progress', () => {
  it('counts finished steps for the N/3 indicator', () => {
    expect(onboardingProgress(steps('DONE', 'RUNNING', 'PENDING'))).toMatchObject({
      completed: 1,
      total: 3,
      done: false,
    });
    expect(onboardingProgress(steps('DONE', 'DONE', 'DONE'))).toMatchObject({
      completed: 3,
      done: true,
    });
  });

  it('names the running step, and otherwise the first unfinished one', () => {
    expect(onboardingProgress(steps('DONE', 'RUNNING', 'PENDING')).current?.id).toBe('catalog');
    expect(onboardingProgress(steps('DONE', 'PENDING', 'PENDING')).current?.id).toBe('catalog');
    expect(onboardingProgress(steps('DONE', 'DONE', 'DONE')).current).toBeNull();
  });

  it('carries the technical name of the step it names', () => {
    expect(onboardingProgress(steps('DONE', 'RUNNING', 'PENDING')).current?.technical).toBe(
      'catalog-artefacto',
    );
  });

  it('surfaces a failure without hiding how far it got', () => {
    const progress = onboardingProgress(steps('DONE', 'FAILED', 'PENDING'));

    expect(progress.failed).toBe(true);
    expect(progress.completed).toBe(1);
    expect(progress.done).toBe(false);
  });
});

describe('onboarding sequencing', () => {
  it('runs one step at a time, in order', () => {
    expect(nextOnboardingStep(steps('PENDING', 'PENDING', 'PENDING'))).toBe('vision');
    expect(nextOnboardingStep(steps('DONE', 'PENDING', 'PENDING'))).toBe('catalog');
    expect(nextOnboardingStep(steps('DONE', 'DONE', 'PENDING'))).toBe('wallet');
  });

  it('waits while a step is running', () => {
    expect(nextOnboardingStep(steps('RUNNING', 'PENDING', 'PENDING'))).toBeNull();
  });

  it('stops after a failure instead of retrying by itself', () => {
    expect(nextOnboardingStep(steps('FAILED', 'PENDING', 'PENDING'))).toBeNull();
  });

  it('has nothing left to start once every step is done', () => {
    expect(nextOnboardingStep(steps('DONE', 'DONE', 'DONE'))).toBeNull();
  });
});

describe('dismissing the onboarding', () => {
  it('is allowed only after a clean finish', () => {
    expect(canDismissOnboarding(steps('DONE', 'DONE', 'DONE'))).toBe(true);
  });

  it('is refused while a step is still pending or running', () => {
    expect(canDismissOnboarding(steps('DONE', 'RUNNING', 'PENDING'))).toBe(false);
    expect(canDismissOnboarding(steps('DONE', 'DONE', 'PENDING'))).toBe(false);
  });

  it('is refused while any step has failed, so the retry stays reachable', () => {
    expect(canDismissOnboarding(steps('DONE', 'FAILED', 'PENDING'))).toBe(false);
    expect(canDismissOnboarding(steps('FAILED', 'DONE', 'DONE'))).toBe(false);
  });
});
