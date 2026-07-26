import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ScribeResultPreview = {
  resume?: string;
  prochaine_action?: string | null;
  date_relance?: string | null;
  statut_deal?: string | null;
  objections_detectees?: string[];
  needsHumanChoice?: boolean;
  options?: [string, string] | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (texte: string) => void;
  pending?: boolean;
  error?: string | null;
  /** Affiché après succès — résumé de ce que le Scribe a écrit. */
  result?: ScribeResultPreview | null;
  onDone?: () => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Modal démo « Dicter » — texte ou micro navigateur (Web Speech API).
 * Aucun champ CRM : le commercial parle, le Scribe écrit.
 */
export function DicterNoteModal({
  open,
  onClose,
  onSubmit,
  pending,
  error,
  result,
  onDone,
}: Props) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setListening(false);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListen = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSpeechUnsupported(true);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let transcript = '';
      for (let i = 0; i < ev.results.length; i++) {
        transcript += ev.results[i]?.[0]?.transcript || '';
      }
      if (transcript.trim()) setText(transcript.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setSpeechUnsupported(true);
    }
  };

  if (!open) return null;

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1E72B9]">Scribe</p>
          <h2 className="mt-1 text-base font-medium">C’est noté. Rien à saisir.</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            {result.resume ? (
              <div>
                <dt className="text-neutral-500">Résumé</dt>
                <dd className="mt-0.5 text-neutral-900">{result.resume}</dd>
              </div>
            ) : null}
            {result.prochaine_action ? (
              <div>
                <dt className="text-neutral-500">Prochaine action</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">{result.prochaine_action}</dd>
              </div>
            ) : null}
            {result.date_relance ? (
              <div>
                <dt className="text-neutral-500">Relance</dt>
                <dd className="mt-0.5 font-medium text-neutral-900">
                  {formatRelance(result.date_relance)}
                </dd>
              </div>
            ) : null}
            {result.objections_detectees?.length ? (
              <div>
                <dt className="text-neutral-500">Objection</dt>
                <dd className="mt-0.5 text-neutral-900">{result.objections_detectees.join(', ')}</dd>
              </div>
            ) : null}
            {result.needsHumanChoice && result.options ? (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-950">
                À clarifier : {result.options[0]} ou {result.options[1]}
              </div>
            ) : null}
          </dl>
          <Button type="button" className="mt-5 h-11 w-full bg-[#016AEB]" onClick={onDone || onClose}>
            Voir la fiche
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-medium">Dicter une note</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Quinze secondes suffisent. Le Scribe écrit le suivi — aucun champ à remplir.
        </p>

        <button
          type="button"
          onClick={toggleListen}
          className={cn(
            'mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors',
            listening
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100'
          )}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} className="text-[#016AEB]" />}
          {listening ? 'Arrêter le micro' : 'Parler (micro)'}
        </button>
        {speechUnsupported ? (
          <p className="mt-2 text-xs text-amber-700">
            Micro non supporté dans ce navigateur — collez ou tapez la note ci-dessous.
          </p>
        ) : null}

        <textarea
          className="mt-3 min-h-[120px] w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px] outline-none focus:border-[#016AEB]"
          placeholder="J’ai eu Trabelsi, intéressé mais budget bloqué jusqu’en septembre…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 bg-[#016AEB] hover:bg-[#0159c4]"
            disabled={text.trim().length < 8 || pending}
            onClick={() => {
              recognitionRef.current?.stop();
              setListening(false);
              onSubmit(text.trim());
            }}
          >
            {pending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Scribe…
              </>
            ) : (
              'Envoyer au Scribe'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatRelance(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
