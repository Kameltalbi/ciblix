import type { OnboardingStep } from '../shared/onboarding.js';
import { ONBOARDING_STEPS, stepIndex } from '../shared/onboarding.js';

const STEP_COPY: Record<OnboardingStep, { title: string; body: string }> = {
  open_linkedin: {
    title: 'Testons votre premier prospect',
    body: 'Ouvrez un profil LinkedIn (linkedin.com/in/…). Le copilote détectera automatiquement le profil.',
  },
  profile_detected: {
    title: 'Profil détecté',
    body: 'Analyse en cours — score, produit et angle commercial arrivent.',
  },
  qualification: {
    title: 'Votre copilote a analysé le prospect',
    body: 'Consultez le score, le produit recommandé et le meilleur angle. Puis générez votre premier message.',
  },
  generate: {
    title: 'Générez votre premier message',
    body: 'Le copilote rédige un message adapté au profil. Vous pourrez l’affiner ensuite.',
  },
  insert: {
    title: 'Insérez dans LinkedIn',
    body: 'Le texte sera placé dans la zone de message. Vous cliquez sur Envoyer quand vous êtes prêt.',
  },
  complete: {
    title: 'Le message est prêt',
    body: 'Il ne vous reste plus qu’à cliquer sur Envoyer sur LinkedIn. Bonne prospection !',
  },
};

export function OnboardingGuide({
  step,
  profileDetected,
}: {
  step: OnboardingStep;
  profileDetected?: boolean;
}) {
  if (step === 'complete') return null;

  const copy = STEP_COPY[step];
  const progress = stepIndex(step);
  const total = ONBOARDING_STEPS.length;

  return (
    <div className="onboarding-enter mx-4 mt-3 rounded-xl border border-[#016AEB]/20 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm dark:from-blue-950/40 dark:to-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#016AEB]">
          Première utilisation · {progress + 1}/{total}
        </p>
        <div className="flex gap-1">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 w-4 rounded-full transition-colors ${
                i <= progress ? 'bg-[#016AEB]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {step === 'profile_detected' && profileDetected && (
        <div className="check-pop mb-3 flex items-center gap-2 text-sm font-medium text-emerald-600">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
          Profil détecté
        </div>
      )}

      <p className="text-sm font-semibold text-slate-900 dark:text-white">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{copy.body}</p>

      {step === 'open_linkedin' && (
        <a
          href="https://www.linkedin.com/feed/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-medium text-[#016AEB] hover:underline"
        >
          Ouvrir LinkedIn →
        </a>
      )}
    </div>
  );
}

export function OnboardingSuccess() {
  return (
    <div className="onboarding-enter mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="check-pop flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Le message est prêt</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Il ne vous reste plus qu'à cliquer sur <strong>Envoyer</strong> sur LinkedIn.
          </p>
        </div>
      </div>
    </div>
  );
}
