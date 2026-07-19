import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileSignature,
  FileText,
  DollarSign,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Prestation {
  titre: string;
  description: string;
  livrables: string[];
  delai: string;
}

interface Proposal {
  reference: string;
  date: string;
  validite: string;
  objet: string;
  introduction: string;
  contexte: string;
  prestations: Prestation[];
  montantHT: number;
  tva: number;
  montantTTC: number;
  conditions: string[] | null;
  conclusion: string;
  signatureBlock: string;
  raw?: string;
}

function fmtDT(n: number): string {
  return new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
}

function ProposalPreview({ proposal, org, client }: { proposal: Proposal; org: any; client: any }) {
  const [copied, setCopied] = useState(false);

  if (proposal.raw) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6 whitespace-pre-wrap text-sm">{proposal.raw}</CardContent>
      </Card>
    );
  }

  const handleCopy = () => {
    const text = buildPlainText(proposal, org, client);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Proposition générée</h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copié !' : 'Copier le texte'}
        </Button>
      </div>

      <Card className="overflow-hidden border-blue-200 shadow-sm">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{org?.name || 'CIBLIX'}</h2>
              {org?.address && <p className="mt-1 text-sm text-blue-200">{org.address}</p>}
              {org?.email && <p className="text-sm text-blue-200">{org.email}</p>}
              {org?.phone && <p className="text-sm text-blue-200">{org.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-blue-200">Réf: {proposal.reference}</p>
              <p className="text-sm text-blue-200">{proposal.date}</p>
              <p className="text-sm text-blue-200">Validité: {proposal.validite}</p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 p-6">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Destinataire</p>
            <p className="font-semibold text-foreground">{client?.name}</p>
            {client?.contactName && <p className="text-sm text-muted-foreground">À l'attention de {client.contactName}</p>}
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">Objet: {proposal.objet}</h3>
          </div>

          <div>
            <p className="text-sm leading-relaxed text-muted-foreground">{proposal.introduction}</p>
          </div>

          {proposal.contexte && (
            <div>
              <h4 className="mb-2 font-semibold text-foreground">Contexte</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{proposal.contexte}</p>
            </div>
          )}

          {proposal.prestations?.length > 0 && (
            <div>
              <h4 className="mb-3 font-semibold text-foreground">Prestations proposées</h4>
              <div className="space-y-4">
                {proposal.prestations.map((p, i) => (
                  <div key={i} className="rounded-lg border bg-white p-4">
                    <h5 className="font-medium text-foreground">{i + 1}. {p.titre}</h5>
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                    {p.livrables?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">Livrables:</p>
                        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                          {p.livrables.map((l, j) => <li key={j}>{l}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.delai && <p className="mt-2 text-xs text-muted-foreground">Délai: {p.delai}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
            <h4 className="mb-3 font-semibold text-foreground">Conditions financières</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant HT</span>
                <span className="font-medium">{fmtDT(proposal.montantHT)} DT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA (19%)</span>
                <span className="font-medium">{fmtDT(proposal.tva)} DT</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Montant TTC</span>
                  <span className="text-lg font-bold text-blue-700">{fmtDT(proposal.montantTTC)} DT</span>
                </div>
              </div>
            </div>
          </div>

          {proposal.conditions && proposal.conditions.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold text-foreground">Conditions générales</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {proposal.conditions.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {proposal.conclusion && (
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">{proposal.conclusion}</p>
            </div>
          )}

          {proposal.signatureBlock && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-foreground">{proposal.signatureBlock}</p>
              <p className="text-xs text-muted-foreground">{org?.name}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildPlainText(proposal: Proposal, org: any, client: any): string {
  const lines: string[] = [];
  lines.push(`${org?.name || ''}`);
  if (org?.address) lines.push(org.address);
  if (org?.email) lines.push(org.email);
  if (org?.phone) lines.push(org.phone);
  lines.push('');
  lines.push(`Réf: ${proposal.reference}`);
  lines.push(`Date: ${proposal.date}`);
  lines.push(`Validité: ${proposal.validite}`);
  lines.push('');
  lines.push(`Destinataire: ${client?.name || ''}`);
  if (client?.contactName) lines.push(`À l'attention de ${client.contactName}`);
  lines.push('');
  lines.push(`OBJET: ${proposal.objet}`);
  lines.push('');
  lines.push(proposal.introduction);
  lines.push('');
  if (proposal.contexte) { lines.push('CONTEXTE'); lines.push(proposal.contexte); lines.push(''); }
  if (proposal.prestations?.length) {
    lines.push('PRESTATIONS');
    proposal.prestations.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.titre}`);
      lines.push(p.description);
      if (p.livrables?.length) lines.push(`Livrables: ${p.livrables.join(', ')}`);
      if (p.delai) lines.push(`Délai: ${p.delai}`);
      lines.push('');
    });
  }
  lines.push('CONDITIONS FINANCIÈRES');
  lines.push(`Montant HT: ${fmtDT(proposal.montantHT)} DT`);
  lines.push(`TVA (19%): ${fmtDT(proposal.tva)} DT`);
  lines.push(`Montant TTC: ${fmtDT(proposal.montantTTC)} DT`);
  lines.push('');
  if (proposal.conditions?.length) { lines.push('CONDITIONS GÉNÉRALES'); proposal.conditions.forEach(c => lines.push(`- ${c}`)); lines.push(''); }
  if (proposal.conclusion) lines.push(proposal.conclusion);
  if (proposal.signatureBlock) { lines.push(''); lines.push(proposal.signatureBlock); }
  return lines.join('\n');
}

export function OffreBot() {
  const { t } = useTranslation();
  const [tone, setTone] = useState<'formal' | 'friendly' | 'concise'>('formal');
  const [includeConditions, setIncludeConditions] = useState(true);
  const [customNotes, setCustomNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [contactName, setContactName] = useState('');
  const [need, setNeed] = useState('');
  const [context, setContext] = useState('');
  const [budgetHT, setBudgetHT] = useState('');
  const [productService, setProductService] = useState('');

  const generateMutation = useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      api.post('/offre-bot/generate', params).then((r) => r.data),
  });

  const canGenerate = clientName.trim().length > 0 && need.trim().length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    const budget = budgetHT.trim() ? Number(budgetHT) : undefined;
    generateMutation.mutate({
      brief: {
        clientName: clientName.trim(),
        contactName: contactName.trim(),
        need: need.trim(),
        context: context.trim(),
        budgetHT: Number.isFinite(budget) ? budget : undefined,
        productService: productService.trim(),
      },
      tone,
      includeConditions,
      customNotes,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <FileSignature size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">OffreBot</h1>
          <p className="text-sm text-muted-foreground">
            {t('agents.offreBotSubtitle', 'Génère des propositions commerciales à partir d’un brief client')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Brief client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Client / entreprise *</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Société ABC"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contact</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex: Ahmed Ben Ali"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Besoin *</label>
                <textarea
                  value={need}
                  onChange={(e) => setNeed(e.target.value)}
                  placeholder="Ex: Audit SEO + plan éditorial 3 mois"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Contexte</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Secteur, urgence, contraintes…"
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Produit / service</label>
                <input
                  value={productService}
                  onChange={(e) => setProductService(e.target.value)}
                  placeholder="Ex: Pack BrandPulse Business"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Budget HT (DT)</label>
                <input
                  type="number"
                  min={0}
                  value={budgetHT}
                  onChange={(e) => setBudgetHT(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ton</label>
                <div className="flex gap-1.5">
                  {([['formal', 'Formel'], ['friendly', 'Amical'], ['concise', 'Concis']] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTone(v)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        tone === v ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-muted-foreground hover:bg-gray-50',
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeConditions}
                  onChange={(e) => setIncludeConditions(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Inclure les conditions générales
              </label>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes supplémentaires</label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ex: Mentionner la remise de 10%…"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || generateMutation.isPending}
                className="w-full gap-2"
              >
                {generateMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Génération en cours...</>
                ) : (
                  <><Sparkles size={16} /> Générer l'offre</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {generateMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={16} /> Erreur lors de la génération. Vérifiez que l'API OpenAI est configurée.
            </div>
          )}

          {generateMutation.data?.proposal && (
            <ProposalPreview
              proposal={generateMutation.data.proposal}
              org={generateMutation.data.organization}
              client={generateMutation.data.client}
            />
          )}

          {!generateMutation.data && !generateMutation.isPending && (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-center">
              <FileSignature size={40} className="mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Renseignez un brief client et cliquez « Générer l'offre »</p>
              <p className="mt-1 text-xs text-muted-foreground/60">L'IA rédigera une proposition commerciale complète</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
