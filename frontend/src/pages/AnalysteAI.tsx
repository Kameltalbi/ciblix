import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Loader2, Building2, Users, Swords, Target, ListChecks } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AnalyzeResult = {
  companyName: string;
  website: string | null;
  summary?: string;
  activity?: string;
  decisionMakers?: string[];
  competitors?: string[];
  potential?: string;
  approachAngles?: string[];
  nextActions?: string[];
};

export function AnalysteAI() {
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [sector, setSector] = useState('');
  const [notes, setNotes] = useState('');

  const analyze = useMutation({
    mutationFn: () =>
      api
        .post('/analyste-ai/analyze', {
          companyName: companyName.trim(),
          website: website.trim() || undefined,
          sector: sector.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        .then((r) => r.data as AnalyzeResult),
  });

  const result = analyze.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-[#1E72B9]">
          <Search size={20} />
          <span className="text-xs font-semibold uppercase tracking-wider">Analyste</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analyser une entreprise</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Préparez chaque approche : activité, décideurs, concurrents et angles concrets avant de contacter.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brief cible</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nom de l’entreprise *</label>
            <input
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#016AEB]/30"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex. Acme Tunisie"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Site web</label>
              <input
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#016AEB]/30"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Secteur</label>
              <input
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#016AEB]/30"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="BTP, assurance…"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Notes / contexte</label>
            <textarea
              className="min-h-[88px] w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#016AEB]/30"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ce que vous savez déjà, objectif de l’approche…"
            />
          </div>
          <Button
            disabled={companyName.trim().length < 2 || analyze.isPending}
            onClick={() => analyze.mutate()}
            className="gap-2"
          >
            {analyze.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Lancer l’analyse
          </Button>
          {analyze.isError ? (
            <p className="text-sm text-rose-600">
              {(analyze.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Analyse impossible pour le moment.'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 size={16} className="text-[#016AEB]" />
                {result.companyName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {result.summary ? <p className="text-foreground">{result.summary}</p> : null}
              {result.activity ? (
                <p>
                  <span className="font-medium text-foreground">Activité — </span>
                  {result.activity}
                </p>
              ) : null}
              {result.potential ? (
                <p>
                  <span className="font-medium text-foreground">Potentiel — </span>
                  {result.potential}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <ListCard title="Décideurs" icon={Users} items={result.decisionMakers} />
          <ListCard title="Concurrents" icon={Swords} items={result.competitors} />
          <ListCard title="Angles d’approche" icon={Target} items={result.approachAngles} />
          <ListCard title="Prochaines actions" icon={ListChecks} items={result.nextActions} />
        </div>
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Users;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={16} className="text-[#016AEB]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#016AEB]" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
