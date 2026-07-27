import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConnectProspectObjective,
  ConnectTone,
  ProspectMemory,
  ProspectQualification,
  ProspectProfile,
} from '../shared/types.js';
import { OBJECTIVES, TONES } from '../shared/types.js';
import { apiCall } from '../shared/api.js';
import { AuthGate, logout } from './AuthGate.js';
import { OnboardingGuide, OnboardingSuccess } from './OnboardingGuide.js';
import {
  completeOnboarding,
  getOnboardingState,
  setOnboardingState,
  type OnboardingStep,
} from '../shared/onboarding.js';
import '../styles/index.css';

const EXTENSION_VERSION = '0.2.0';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function MemoryCard({ memory }: { memory: ProspectMemory }) {
  if (!memory.lastContactAt && !memory.events.length) return null;
  const sentiment =
    memory.lastResponseSentiment === 'positive'
      ? 'Positive'
      : memory.lastResponseSentiment === 'negative'
        ? 'Négative'
        : memory.lastResponseSentiment
          ? 'Neutre'
          : '—';

  return (
    <div className="mx-4 mb-3 rounded-xl border border-blue-200/60 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Mémoire prospect</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-400">Dernier contact</span>
          <p className="font-medium">
            {memory.lastContactAt
              ? new Date(memory.lastContactAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-slate-400">Réponse</span>
          <p className="font-medium">{sentiment}</p>
        </div>
        {memory.lastMeetingAt && (
          <div>
            <span className="text-slate-400">RDV</span>
            <p className="font-medium">
              {new Date(memory.lastMeetingAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )}
        {memory.lastProductName && (
          <div>
            <span className="text-slate-400">Produit</span>
            <p className="font-medium">{memory.lastProductName}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CopilotContent() {
  const [profile, setProfile] = useState<ProspectProfile | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [qualification, setQualification] = useState<ProspectQualification | null>(null);
  const [memory, setMemory] = useState<ProspectMemory | null>(null);
  const [message, setMessage] = useState('');
  const [messageId, setMessageId] = useState<string | null>(null);
  const [objective, setObjective] = useState<ConnectProspectObjective>('GET_MEETING');
  const [tone, setTone] = useState<ConnectTone>('professionnel');
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [onboarding, setOnboarding] = useState<{ complete: boolean; step: OnboardingStep } | null>(null);
  const [showOnboardingSuccess, setShowOnboardingSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const profileDetectedOnce = useRef(false);

  const advanceOnboarding = useCallback(async (step: OnboardingStep) => {
    const next = await setOnboardingState({ step });
    setOnboarding(next);
  }, []);

  const loadProfile = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PROFILE' }, (res) => {
        if (res?.profile) {
          setProfile(res.profile);
          chrome.storage.local.set({ lastProfile: res.profile });
          if (!profileDetectedOnce.current) {
            profileDetectedOnce.current = true;
            void getOnboardingState().then((state) => {
              if (!state.complete) void advanceOnboarding('profile_detected');
            });
          }
        }
      });
    });
  }, [advanceOnboarding]);

  const runQualify = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall<{
        qualification: ProspectQualification;
        prospect: { id: string };
        memory: ProspectMemory;
      }>('/analyze', 'POST', { channelSlug: 'LINKEDIN', profile, objective });
      setQualification(res.qualification);
      setProspectId(res.prospect?.id ?? null);
      setMemory(res.memory ?? null);
      if (!onboarding?.complete) {
        await advanceOnboarding('qualification');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur qualification');
    } finally {
      setLoading(false);
    }
  }, [profile, objective, onboarding?.complete, advanceOnboarding]);

  useEffect(() => {
    getOnboardingState().then(setOnboarding);
    loadProfile();
    apiCall<{ tone: ConnectTone }>('/settings', 'GET')
      .then((s) => setTone(s.tone || 'professionnel'))
      .catch(() => {});

    const ua = navigator.userAgent;
    const browser = ua.includes('Edg/') ? 'edge' : ua.includes('Firefox/') ? 'firefox' : 'chrome';
    apiCall('/session', 'POST', {
      browser,
      extensionVersion: EXTENSION_VERSION,
      metadata: { source: 'sidepanel' },
    }).catch(() => {});

    const interval = setInterval(loadProfile, 4000);
    return () => clearInterval(interval);
  }, [loadProfile]);

  useEffect(() => {
    if (profile && !qualification && !loading) void runQualify();
  }, [profile, qualification, loading, runQualify]);

  const runGenerate = async () => {
    if (!profile || !qualification) return;
    setLoading(true);
    setInserted(false);
    try {
      const res = await apiCall<{ content: string; message: { id: string } }>('/generate', 'POST', {
        channelSlug: 'LINKEDIN',
        strategy: 'FIRST_MESSAGE',
        objective,
        profile,
        analysis: qualification,
        prospectId,
      });
      setMessage(res.content);
      setMessageId(res.message.id);
      if (!onboarding?.complete) {
        await advanceOnboarding('insert');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur génération');
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setRefining(true);
    try {
      if (!message) {
        await runGenerate();
      }
      const res = await apiCall<{ content: string }>('/refine', 'POST', {
        message: message || ' ',
        instruction,
        profile,
        qualification,
        objective,
      });
      setMessage(res.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setRefining(false);
    }
  };

  const insertMessage = async () => {
    if (!message) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'INSERT_MESSAGE', content: message });
    if (res?.success) {
      setInserted(true);
      if (!onboarding?.complete) {
        setShowOnboardingSuccess(true);
        await completeOnboarding();
        setOnboarding({ complete: true, step: 'complete' });
      }
      if (messageId) {
        await apiCall('/history', 'POST', { messageId, action: 'inserted', prospectId, channelSlug: 'LINKEDIN' });
      }
    }
  };

  const markEvent = async (eventType: 'MESSAGE_SENT' | 'REPLY_RECEIVED' | 'MEETING_BOOKED') => {
    if (!prospectId) return;
    await apiCall('/conversations/events', 'POST', { prospectId, channelSlug: 'LINKEDIN', eventType });
  };

  const budgetLabel = { low: 'Faible', medium: 'Moyen', high: 'Élevé', unknown: '—' }[qualification?.probableBudget || 'unknown'] ?? '—';
  const esgLabel = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', unknown: '—' }[qualification?.esgMaturity || 'unknown'] ?? '—';

  return (
    <div className="panel-width flex min-h-screen flex-col bg-[#fafafa] dark:bg-[#0a0a0b]">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold">Copilote Commercial</p>
          <p className="text-[10px] text-slate-400">par Ciblix</p>
        </div>
        <button type="button" onClick={() => logout()} className="text-[10px] text-slate-400 hover:text-slate-600">
          Déconnexion
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-36">
        {onboarding && !onboarding.complete && (
          <OnboardingGuide
            step={onboarding.step}
            profileDetected={Boolean(profile)}
          />
        )}

        {showOnboardingSuccess && <OnboardingSuccess />}

        {error && error !== 'CONNECT_REQUIRED' && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {memory && <MemoryCard memory={memory} />}

        <div className="fade-in px-4 py-4">
          <h2 className="text-lg font-semibold leading-tight">{profile?.fullName || (onboarding?.complete !== false ? 'Profil…' : 'En attente d’un profil LinkedIn')}</h2>
          <p className="text-sm text-slate-500">{profile?.jobTitle || 'Ouvrez linkedin.com/in/…'}</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile?.company}</p>
        </div>

        {qualification && (
          <div className="fade-in">
            <section className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold tabular-nums text-[#016AEB]">
                  {qualification.score}
                  <span className="text-base font-normal text-slate-400">/100</span>
                </span>
                <span className="text-sm font-medium text-emerald-600">{qualification.scoreLabel}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric label="Décideur" value={qualification.isDecisionMaker ? 'Oui' : 'Non'} />
                <Metric label="Budget probable" value={budgetLabel} />
                <Metric label="Maturité ESG" value={esgLabel} />
                <Metric label="Prob. réponse" value={`${qualification.responseProbability} %`} />
                <Metric label="Prob. RDV" value={`${qualification.meetingProbability} %`} />
              </div>
            </section>

            <section className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Intelligence contextuelle</h3>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{qualification.contextualInsight}</p>
              {qualification.timingSignal && (
                <p className="mt-2 text-xs text-emerald-600">⏱ {qualification.timingSignal}</p>
              )}
            </section>

            <section className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Meilleur angle</h3>
              <ul className="space-y-1">
                {qualification.bestAngles.map((a, i) => (
                  <li key={i} className="text-sm text-slate-600 before:mr-1 before:text-emerald-500 before:content-['→']">{a}</li>
                ))}
              </ul>
              <h3 className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">À éviter</h3>
              <ul className="space-y-1">
                {qualification.avoidTopics.map((a, i) => (
                  <li key={i} className="text-sm text-amber-700 before:mr-1 before:content-['✕']">{a}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Sujet recommandé : <strong>{qualification.recommendedSubject}</strong>
              </p>
            </section>

            <section className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Produit recommandé</h3>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {qualification.recommendedProductName}
              </div>
              <p className="mt-2 text-xs text-slate-500">{qualification.productReason}</p>
            </section>
          </div>
        )}

        <section className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Objectif</label>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as ConnectProspectObjective)}
            className="mt-1 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ton</label>
          <div className="mt-1 flex gap-1">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTone(t.value);
                  apiCall('/settings', 'PATCH', { tone: t.value }).catch(() => {});
                }}
                className={`flex-1 rounded-lg py-1.5 text-[10px] font-medium ${
                  tone === t.value ? 'bg-[#016AEB] text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {message && (
          <section className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message</h3>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-xl border-0 bg-white p-3 text-sm leading-relaxed shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={insertMessage}
                className="col-span-3 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-slate-900"
              >
                {!onboarding?.complete ? 'Insérer dans LinkedIn' : 'Insérer'}
              </button>
              <button type="button" onClick={runGenerate} className="rounded-lg border py-2 text-xs">Régénérer</button>
              <button type="button" onClick={() => navigator.clipboard.writeText(message)} className="rounded-lg border py-2 text-xs">Copier</button>
              <button type="button" onClick={() => markEvent('MESSAGE_SENT')} className="rounded-lg border py-2 text-xs">Envoyé ✓</button>
            </div>
            {inserted && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">
                Cliquez sur <strong>Envoyer</strong> sur LinkedIn.
              </p>
            )}
          </section>
        )}

        {loading && !qualification && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#016AEB] border-t-transparent" />
            <span className="ml-2 text-sm text-slate-500">Qualification en cours…</span>
          </div>
        )}

        {!message && qualification && !loading && (
          <div className="fade-in px-4 pb-4">
            <button
              type="button"
              onClick={async () => {
                if (!onboarding?.complete) await advanceOnboarding('generate');
                await runGenerate();
              }}
              className="w-full rounded-xl bg-gradient-to-r from-[#016AEB] to-[#38bdf8] py-3 text-sm font-medium text-white shadow-md transition hover:opacity-95"
            >
              {!onboarding?.complete ? 'Générer mon premier message' : 'Générer le message'}
            </button>
          </div>
        )}
      </div>

      {/* Mode conversationnel — affiner le message */}
      <div className="fixed bottom-0 left-0 w-[420px] max-w-[100vw] border-t border-slate-200 bg-white/95 p-3 backdrop-blur transition dark:border-slate-800 dark:bg-slate-950/95">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Parler au copilote</p>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())}
            placeholder={message ? 'Plus court, en anglais, insister sur les économies…' : 'Générez d’abord un message'}
            className="min-w-0 flex-1 rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 transition dark:bg-slate-900 dark:ring-slate-700"
            disabled={refining || !qualification || !message}
          />
          <button
            type="button"
            onClick={sendChat}
            disabled={refining || !chatInput.trim()}
            className="shrink-0 rounded-xl bg-[#016AEB] px-4 py-2.5 text-sm text-white disabled:opacity-40"
          >
            {refining ? '…' : '→'}
          </button>
        </div>
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export function SidePanelApp() {
  return (
    <AuthGate>
      <CopilotContent />
    </AuthGate>
  );
}
