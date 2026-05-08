import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent } from '@/components/ui/card';

/** Remplace par une image locale : dépose `register-hero.jpg` dans `public/` et mets cette constante à `'/register-hero.jpg'`. */
const REGISTER_HERO_BG =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80';

export function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dir = i18n.dir();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, password, name, organizationName, phone });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      const ps = data.paymentStatus ?? 'PENDING';
      localStorage.setItem('paymentStatus', ps);
      useAuth.setState({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        paymentStatus: ps,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden" dir={dir}>
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${REGISTER_HERO_BG})` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/75 via-slate-900/55 to-emerald-950/50"
        aria-hidden
      />

      <Link
        to="/login"
        className="absolute top-5 z-20 inline-flex rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white backdrop-blur-md ring-1 ring-white/25 transition-colors hover:bg-white/25 ltr:right-5 rtl:left-5"
      >
        {t('auth.signIn')}
      </Link>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col lg:flex-row lg:items-stretch lg:justify-between lg:gap-12 lg:px-10 xl:max-w-[1320px]">
        {/* Colonne marque (desktop) */}
        <div className="hidden flex-col justify-center gap-6 px-6 pb-8 pt-16 text-white lg:flex lg:flex-1 lg:px-0 lg:pb-24 lg:pt-24 xl:pb-32">
          <div className="space-y-3">
            <img src="/logo.png" alt="ktOptima" className="h-14 w-auto brightness-0 invert lg:h-[4.25rem]" />
            <p className="max-w-md text-xl font-semibold tracking-tight text-white/95 xl:text-2xl">
              ktOptima
            </p>
            <p className="max-w-md text-sm font-normal leading-relaxed text-white/80 xl:text-base">
              {t('auth.registerHeroTagline')}
            </p>
          </div>
        </div>

        {/* Carte inscription */}
        <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:max-w-lg lg:flex-none lg:px-2 lg:py-24 xl:max-w-xl">
          <Card className="w-full rounded-2xl border-0 shadow-2xl shadow-slate-900/25 ring-1 ring-black/5">
            <CardContent className="p-6 pt-8 sm:p-8 sm:pt-10">
              <div className="mb-8 flex justify-center lg:hidden">
                <img src="/logo.png" alt="" className="h-11 w-auto" />
              </div>
              <h1 className="mb-8 text-center text-xl font-semibold tracking-tight text-slate-900 sm:text-left sm:text-2xl rtl:sm:text-right">
                {t('auth.registerCardTitle')}
              </h1>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="organizationName">{t('settings.organization')} *</Label>
                  <Input
                    id="organizationName"
                    type="text"
                    placeholder="Ma société"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    className="h-11 rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t('common.name')} *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t('clients.clientPhone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('common.email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.tn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('common.password')} (min. 6) *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-lg border-slate-200 bg-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg text-base font-medium"
                  disabled={loading}
                >
                  {loading ? t('common.loading') : t('auth.signUp')}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5 text-sm">
                  <Link to="/" className="text-slate-500 hover:text-slate-800">
                    ← {t('auth.backToHome')}
                  </Link>
                  <span className="text-slate-500">
                    {t('auth.hasAccount')}{' '}
                    <Link to="/login" className="font-medium text-emerald-700 hover:underline">
                      {t('auth.signIn')}
                    </Link>
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
