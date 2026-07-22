import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ScoringCriterion = { key: string; label: string; weight: number };

type CopilotOrgConfig = {
  sector: string;
  businessLexicon: string;
  scoringGrid: ScoringCriterion[];
  usesDefaults: boolean;
};

export function CopilotOrgSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<CopilotOrgConfig>({
    queryKey: ['copilot-org-config'],
    queryFn: () => api.get('/copilot/org-config').then((r) => r.data),
  });

  const [sector, setSector] = useState('');
  const [businessLexicon, setBusinessLexicon] = useState('');

  useEffect(() => {
    if (!data) return;
    setSector(data.sector || '');
    setBusinessLexicon(data.businessLexicon || '');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api
        .put('/copilot/org-config', {
          sector: sector.trim() || null,
          businessLexicon: businessLexicon.trim() || null,
          scoringGrid: data?.scoringGrid,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['copilot-org-config'] });
      alert('Configuration Copilot enregistrée');
    },
    onError: (error: { response?: { data?: { error?: string } }; message?: string }) => {
      alert(error?.response?.data?.error || error?.message || 'Erreur');
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement de la configuration Copilot…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Copilot IA — contexte métier</CardTitle>
        <p className="text-xs text-muted-foreground">
          Personnalise le lexique et le secteur utilisés pour l&apos;analyse des conversations.
          {data?.usesDefaults ? ' Grille de scoring par défaut active.' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="copilot-sector">Secteur d&apos;activité</Label>
          <Input
            id="copilot-sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Ex. BTP, SaaS B2B, distribution…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="copilot-lexicon">Lexique métier</Label>
          <textarea
            id="copilot-lexicon"
            value={businessLexicon}
            onChange={(e) => setBusinessLexicon(e.target.value)}
            placeholder="Termes clés, produits, processus commerciaux de votre entreprise…"
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer Copilot'}
        </Button>
      </CardContent>
    </Card>
  );
}
