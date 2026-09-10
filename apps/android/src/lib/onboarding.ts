export type OnboardingStepId = 'vision' | 'catalog' | 'wallet';

export type OnboardingStepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  status: OnboardingStepStatus;
  /**
   * The exact artefact being prepared — model name, quantization, network. It
   * is shown while the step runs so an evaluator can see what is loading, not
   * just that something is.
   */
  technical: string;
  /** Download progress, when the step reports one. */
  percent?: number;
}

export interface OnboardingProgress {
  /** Steps finished, for the `2/3` counter. */
  completed: number;
  total: number;
  /** The step worth naming right now: the running one, else the first unfinished. */
  current: OnboardingStep | null;
  done: boolean;
  failed: boolean;
}

export const onboardingLabels: Record<OnboardingStepId, string> = {
  vision: 'Cargando el modelo de visión',
  catalog: 'Preparando el catálogo local',
  wallet: 'Inicializando la wallet de prueba',
};

export function onboardingProgress(steps: readonly OnboardingStep[]): OnboardingProgress {
  const completed = steps.filter((step) => step.status === 'DONE').length;
  const failed = steps.some((step) => step.status === 'FAILED');
  const running = steps.find((step) => step.status === 'RUNNING');
  const firstUnfinished = steps.find((step) => step.status !== 'DONE');
  return {
    completed,
    total: steps.length,
    current: running ?? firstUnfinished ?? null,
    done: steps.length > 0 && completed === steps.length,
    failed,
  };
}

/**
 * Whether the traveler may put the onboarding away. Only a clean finish counts:
 * while any step has failed the footer is the only route back to a retry, so it
 * must stay on screen. Kept as its own function so the rule is stated once and
 * cannot drift apart from the button that enforces it.
 */
export function canDismissOnboarding(steps: readonly OnboardingStep[]): boolean {
  const progress = onboardingProgress(steps);
  return progress.done && !progress.failed;
}

/**
 * The step the sequence should start next, or null when it should wait. A
 * failed step stops the run rather than retrying on its own: repeating a failed
 * 412 MB download without asking is worse than stopping and saying so.
 */
export function nextOnboardingStep(
  steps: readonly OnboardingStep[],
): OnboardingStepId | null {
  if (steps.some((step) => step.status === 'RUNNING' || step.status === 'FAILED')) {
    return null;
  }
  return steps.find((step) => step.status === 'PENDING')?.id ?? null;
}
