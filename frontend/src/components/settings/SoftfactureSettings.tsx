import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function SoftfactureSettings() {
  const { data } = useQuery<{ configured: boolean; baseUrl: string | null; website: string }>({
    queryKey: ['softfacture-status'],
    queryFn: () => api.get('/softfacture/status').then((r) => r.data),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Softfacture</CardTitle>
        <CardDescription>
          Service de facturation externe —{' '}
          <a
            href="https://www.softfacture.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0B5FFF] underline-offset-2 hover:underline"
          >
            www.softfacture.com
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Softfacture propose un <strong>plan gratuit</strong>, puis des offres payantes selon votre volume.
          L’abonnement Softfacture se gère chez Softfacture — Ciblix se contente de se connecter à votre compte.
        </p>
        <p className="text-sm text-muted-foreground">
          {data?.configured
            ? 'API Softfacture configurée sur le serveur — devis et factures disponibles depuis Ciblix.'
            : 'Pour activer : créez un compte Softfacture, puis renseignez SOFTFACTURE_API_URL et SOFTFACTURE_API_KEY sur le serveur.'}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="https://www.softfacture.com" target="_blank" rel="noopener noreferrer">
            Voir les plans Softfacture
            <ExternalLink size={14} className="ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
