export type OnboardingStep =
  | 'open_linkedin'
  | 'profile_detected'
  | 'qualification'
  | 'generate'
  | 'insert'
  | 'complete';

export interface OnboardingState {
  complete: boolean;
  step: OnboardingStep;
}

const STORAGE_KEY = 'copilotOnboarding';

const DEFAULT: OnboardingState = { complete: false, step: 'open_linkedin' };

export function getOnboardingState(): Promise<OnboardingState> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const stored = data[STORAGE_KEY] as OnboardingState | undefined;
      resolve(stored?.complete ? { complete: true, step: 'complete' } : { ...DEFAULT, ...stored });
    });
  });
}

export function setOnboardingState(patch: Partial<OnboardingState>): Promise<OnboardingState> {
  return getOnboardingState().then((current) => {
    const next = { ...current, ...patch };
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: next }, () => resolve(next));
    });
  });
}

export function completeOnboarding(): Promise<void> {
  return setOnboardingState({ complete: true, step: 'complete' }).then(() => undefined);
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'open_linkedin',
  'profile_detected',
  'qualification',
  'generate',
  'insert',
  'complete',
];

export function stepIndex(step: OnboardingStep): number {
  if (step === 'complete') return ONBOARDING_STEPS.length;
  return ONBOARDING_STEPS.indexOf(step);
}
