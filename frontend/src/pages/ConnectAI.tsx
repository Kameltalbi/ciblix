import { Link } from 'react-router-dom';
import { ExternalLink, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

/**
 * LinkedIn dans Ciblix = message préparé sur la fiche contact.
 * Pas d’extension à installer (envoi manuel, comme WhatsApp / email).
 */
export function ConnectAI() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('connectAi.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectAi.subtitle')}</p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-foreground">
            <li>{t('connectAi.overview.flowStep1')}</li>
            <li>{t('connectAi.overview.flowStep2')}</li>
            <li>{t('connectAi.overview.flowStep3')}</li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/contacts">
                <Users className="mr-2 h-4 w-4" />
                {t('connectAi.overview.ctaContacts')}
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://www.linkedin.com/feed/', '_blank', 'noopener')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('connectAi.extension.testCta')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
