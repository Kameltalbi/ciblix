import { Link } from 'react-router-dom';
import { Chrome, ExternalLink, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

const CHROME_STORE_URL = (import.meta.env.VITE_CHROME_EXTENSION_URL as string | undefined)?.trim() || '';

/**
 * LinkedIn dans Ciblix :
 * - Par défaut : message préparé sur la fiche contact (copier-coller).
 * - Optionnel : extension Chrome Web Store pour pré-remplir sur LinkedIn.
 */
export function ConnectAI() {
  const { t } = useTranslation();
  const storeAvailable = Boolean(CHROME_STORE_URL);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('connectAi.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectAi.subtitle')}</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('connectAi.overview.startTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('connectAi.overview.startIntro')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{t('connectAi.extension.pageTitle')}</CardTitle>
            {!storeAvailable && (
              <Badge variant="secondary">{t('connectAi.overview.comingSoonBadge')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('connectAi.extension.channelsNote')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {storeAvailable ? (
            <>
              <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-foreground">
                <li>{t('connectAi.extension.storeStep1')}</li>
                <li>{t('connectAi.extension.storeStep2')}</li>
                <li>{t('connectAi.extension.storeStep3')}</li>
              </ol>
              <Button onClick={() => window.open(CHROME_STORE_URL, '_blank', 'noopener')}>
                <Chrome className="mr-2 h-4 w-4" />
                {t('connectAi.overview.ctaChromeStore')}
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('connectAi.overview.comingSoonBody')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
