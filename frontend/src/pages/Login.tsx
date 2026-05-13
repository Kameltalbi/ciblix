import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getGoogleAuthHref, isGoogleAuthUiEnabled } from '@/lib/googleAuthUrl';

const OAUTH_FALLBACK_MESSAGES: Record<string, string> = {
  google_not_configured:
    'La connexion Google n’est pas configurée sur ce serveur (variables Google manquantes).',
  google_denied: 'Connexion Google annulée.',
  access_denied: 'Connexion Google annulée.',
  invalid_profile: 'Profil Google incomplet.',
  email_not_verified: 'Ton compte Google doit avoir une adresse e-mail vérifiée.',
  google_already_linked_other: 'Ce compte Google est déjà associé à un autre utilisateur.',
  google_missing_tokens: 'Échec de la connexion Google (jetons absents).',
  google_profile_failed: 'Impossible de charger ton profil après Google.',
  account_locked: 'Compte temporairement verrouillé.',
  google_failed: 'Échec de la connexion Google.',
  invalid_callback: 'Réponse Google invalide.',
  misconfiguration: 'Configuration serveur incorrecte.',
};

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('admin@bilan-crm.tn');
  const [password, setPassword] = useState('changeme123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get('error');
    if (!q) return;
    const localized = t(`auth.oauthErrors.${q}`, { defaultValue: OAUTH_FALLBACK_MESSAGES[q] || q });
    setError(localized);
    navigate('/login', { replace: true });
  }, [searchParams, navigate, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Wait for user data to be loaded
      setTimeout(() => {
        const currentUser = useAuth.getState().user;
        if (currentUser?.role === 'SUPERADMIN') {
          navigate('/admin');
        } else {
          navigate('/ai-assistant');
        }
      }, 100);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string }; status?: number };
        message?: string;
        code?: string;
      };
      if (!ax.response) {
        const net =
          ax.code === 'ERR_NETWORK' ||
          ax.message === 'Network Error' ||
          /network/i.test(ax.message || '');
        setError(
          net
            ? 'Impossible de joindre le serveur API (réseau, DNS ou configuration). Vérifiez que le backend tourne et que /api est bien exposé (Nginx / HTTPS).'
            : ax.message || 'Erreur de connexion'
        );
      } else {
        setError(ax.response.data?.error || `Erreur serveur (${ax.response.status ?? '?'})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex justify-center pb-2 pt-6">
          <img src="/logo-ciblix.png" alt="CIBLIX" className="h-16 w-auto" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('common.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-leaf hover:underline">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.signIn')}
            </Button>
            {isGoogleAuthUiEnabled() && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loading}
                onClick={() => {
                  window.location.href = getGoogleAuthHref();
                }}
                aria-label={t('auth.signInWithGoogle')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
                  <path
                    fill="#FFC107"
                    d="M43.611 20.083H42V20H24v8h11.303C33.958 34.087 29.579 37 24 37c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.32 0 6.362 1.254 8.659 3.293l6.058-6.058C34.068 9.834 29.296 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.139-2.648-.389-3.917z"
                  />
                  <path
                    fill="#FF3D00"
                    d="m6.306 14.691 6.571 4.815C14.659 17.108 18.962 14 24 14c3.319 0 6.362 1.254 8.659 3.293l6.058-6.058C34.068 9.834 29.296 8 24 8 17.887 8 12.582 11.068 9.306 14.691z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.078 0 9.743-1.918 13.279-5.069l-6.146-5.207C29.547 34.957 26.957 37 24 37c-5.551 0-10.237-3.596-11.957-8.579l-6.518 5.018C11.069 41.086 17.086 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611 20.083H42V20H24v8h11.303a12.957 12.957 0 0 1-4.41 7.036l6.146 5.207C41.069 41.086 43 39.086 43 39.086 44 36.957 44 34 44 24c0-1.341-.139-2.647-.389-3.917z"
                  />
                </svg>
                {t('auth.signInWithGoogle')}
              </Button>
            )}
            <div className="flex justify-between text-sm text-center">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                ← {t('common.back')}
              </Link>
              <Link to="/register" className="text-leaf hover:underline">
                {t('auth.noAccount')} {t('auth.signUp')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
