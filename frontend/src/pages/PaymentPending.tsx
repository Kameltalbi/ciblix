import { useEffect } from 'react';
import { Clock, RefreshCw, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function PaymentPending() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const paymentStatus = useAuth((s) => s.paymentStatus);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      navigate('/admin', { replace: true });
      return;
    }
    if (paymentStatus === 'APPROVED' || paymentStatus === null) {
      navigate('/dashboard', { replace: true });
    }
  }, [user?.role, paymentStatus, navigate]);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage to-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <Clock className="text-yellow-600" size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl">{t('paymentPending.title', { defaultValue: 'Paiement en attente' })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {t('paymentPending.message', { defaultValue: 'Votre compte est en attente de validation du paiement. Vous serez notifié une fois que votre paiement aura été approuvé par notre équipe.' })}
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>{t('paymentPending.nextSteps', { defaultValue: 'Prochaines étapes :' })}</strong>
              <br />
              • Votre paiement est en cours de vérification
              <br />
              • Vous recevrez un email dès l'approbation
              <br />
              • Le délai de traitement est généralement de 24h
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/')} variant="outline" className="flex-1">
              <Home size={16} className="mr-2" />
              {t('paymentPending.backHome', { defaultValue: 'Retour accueil' })}
            </Button>
            <Button onClick={handleRefresh} className="flex-1">
              <RefreshCw size={16} className="mr-2" />
              {t('paymentPending.refresh', { defaultValue: 'Actualiser' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
