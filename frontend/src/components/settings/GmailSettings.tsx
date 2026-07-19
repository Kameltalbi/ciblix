import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function GmailSettings() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);

  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => api.get('/gmail/status').then((r) => r.data),
  });

  useEffect(() => {
    if (params.get('gmail') === 'connected') {
      setToast('✅ Gmail connecté avec succès !');
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      setTimeout(() => setToast(null), 4000);
    }
  }, [params, qc]);

  const connectGmail = async () => {
    const { data } = await api.get('/gmail/auth');
    window.location.href = data.url;
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-leaf text-white px-4 py-2 rounded-lg text-sm">{toast}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Mail className="text-red-600" size={20} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Gmail</CardTitle>
              <CardDescription>
                Connexion pour l’agent Gmail IA (lecture + brouillons) et l’envoi manuel. Aucun envoi automatique.
              </CardDescription>
            </div>
            {gmailStatus?.connected ? (
              <div className="flex items-center gap-1.5 text-sm text-leaf font-medium">
                <CheckCircle2 size={16} />Connecté
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <XCircle size={16} />Non connecté
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gmailStatus?.connected ? (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Compte : </span>
                <span className="font-medium">{gmailStatus.email}</span>
              </div>
              <Button variant="outline" onClick={connectGmail} className="w-full sm:w-auto">Changer de compte</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connectez Gmail pour permettre à l’agent de lire les nouveaux e-mails et de préparer des brouillons
                sous le libellé « Réponse à valider ». Vous validez et envoyez vous-même dans Gmail.
              </p>
              <Button onClick={connectGmail} className="w-full sm:w-auto">Connecter Gmail</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
