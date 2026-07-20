import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, Radio, Bot, Radar, FileSignature, ShieldCheck, Megaphone, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { getGoogleAuthHref, isGoogleAuthUiEnabled } from '@/lib/googleAuthUrl';

export function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get('plan') || '').toUpperCase();
  const trialDays = searchParams.get('trial');
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
      const payload: Record<string, string> = { email, password, name, organizationName, phone };
      if (['BASIC', 'BUSINESS', 'ENTERPRISE'].includes(selectedPlan)) {
        payload.plan = selectedPlan;
      }
      const { data } = await api.post('/auth/register', payload);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      useAuth.setState({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        paymentStatus: data.paymentStatus ?? null,
      });
      if (data.user.role === 'SUPERADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const agents = [
    { icon: Radio, nameKey: 'agents.huntAi.name', descKey: 'agents.huntAi.desc' },
    { icon: Bot, nameKey: 'agents.copilotIa.name', descKey: 'agents.copilotIa.desc' },
    { icon: Radar, nameKey: 'agents.scoutAi.name', descKey: 'agents.scoutAi.desc' },
    { icon: FileSignature, nameKey: 'agents.offreBot.name', descKey: 'agents.offreBot.desc' },
    { icon: ShieldCheck, nameKey: 'agents.factCheckAi.name', descKey: 'agents.factCheckAi.desc' },
    { icon: Megaphone, nameKey: 'agents.brandPulse.name', descKey: 'agents.brandPulse.desc' },
  ];

  return (
    <div className="relative min-h-screen" dir={dir}>
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#0a2540]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(0,113,221,0.2),transparent_50%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(190,214,246,0.08),transparent_50%)]" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1280px] flex-col lg:flex-row lg:items-center lg:gap-16 px-4 sm:px-6 lg:px-10 py-8 lg:py-0">

        {/* Left — Brand & agents */}
        <div className="hidden flex-1 flex-col justify-center gap-10 lg:flex">
          <div>
            <Link to="/">
              <img src="/logo-ciblix.png" alt="CIBLIX" className="h-14 w-auto brightness-0 invert mb-6" />
            </Link>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-white xl:text-5xl">
              Boostez votre activité{' '}
              <span className="bg-gradient-to-r from-[#BED6F6] to-white bg-clip-text text-transparent">
                avec l'IA
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/60">
              Créez votre compte en 30 secondes et accédez à 6 agents IA spécialisés pour votre prospection, veille, marketing et gestion commerciale.
            </p>
          </div>

          {/* Agent pills */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#BED6F6]/70">
              <Sparkles size={14} /> 6 agents IA inclus
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {agents.map((agent) => (
                <div key={agent.nameKey} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <agent.icon size={18} className="text-[#BED6F6]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t(agent.nameKey)}</p>
                    <p className="text-xs text-white/45">{t(agent.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#BED6F6]" /> Sans engagement</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#BED6F6]" /> Support local</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-[#BED6F6]" /> 100% sécurisé</span>
          </div>
        </div>

        {/* Right — Form card */}
        <div className="flex flex-1 flex-col justify-center lg:max-w-[480px] lg:flex-none">
          {/* Mobile logo */}
          <div className="mb-6 flex justify-center lg:hidden">
            <Link to="/">
              <img src="/logo-ciblix.png" alt="CIBLIX" className="h-12 w-auto brightness-0 invert" />
            </Link>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl ring-1 ring-white/5 sm:p-8">
            <h2 className="mb-1 text-xl font-semibold text-white sm:text-2xl">
              {t('auth.registerCardTitle')}
            </h2>
            <p className="mb-6 text-sm text-white/50">
              {['BASIC', 'BUSINESS', 'ENTERPRISE'].includes(selectedPlan)
                ? `Essai gratuit${trialDays ? ` ${trialDays} jours` : ''} — plan ${selectedPlan === 'ENTERPRISE' ? 'Professionnel' : selectedPlan.charAt(0) + selectedPlan.slice(1).toLowerCase()}`
                : '14 jours d\'essai gratuit — choisissez votre plan sur la page tarifs'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="organizationName" className="text-white/70">{t('settings.organization')} *</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Ma société"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:ring-[#0071DD]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-white/70">{t('common.name')} *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:ring-[#0071DD]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-white/70">{t('clients.clientPhone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+216 55 053 505"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:ring-[#0071DD]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/70">{t('common.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nom@entreprise.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:ring-[#0071DD]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-white/70">{t('common.password')} (min. 6) *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/25 pr-10 focus-visible:ring-[#0071DD]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">{error}</p>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-[#0071DD] text-base font-semibold hover:bg-[#016AEB] shadow-lg shadow-[#0071DD]/25"
                disabled={loading}
              >
                {loading ? t('common.loading') : (
                  <span className="flex items-center gap-2">
                    {t('auth.signUp')} <ArrowRight size={16} />
                  </span>
                )}
              </Button>

              {isGoogleAuthUiEnabled() && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-white/10" />
                    <span className="text-xs text-white/30">ou</span>
                    <div className="flex-1 border-t border-white/10" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl gap-2 text-sm font-medium border-white/10 bg-white/5 text-white hover:bg-white/10"
                    disabled={loading}
                    onClick={() => { window.location.href = getGoogleAuthHref(); }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.958 34.087 29.579 37 24 37c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.32 0 6.362 1.254 8.659 3.293l6.058-6.058C34.068 9.834 29.296 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.139-2.648-.389-3.917z" />
                      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.815C14.659 17.108 18.962 14 24 14c3.319 0 6.362 1.254 8.659 3.293l6.058-6.058C34.068 9.834 29.296 8 24 8 17.887 8 12.582 11.068 9.306 14.691z" />
                      <path fill="#4CAF50" d="M24 44c5.078 0 9.743-1.918 13.279-5.069l-6.146-5.207C29.547 34.957 26.957 37 24 37c-5.551 0-10.237-3.596-11.957-8.579l-6.518 5.018C11.069 41.086 17.086 44 24 44z" />
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.957 12.957 0 0 1-4.41 7.036l6.146 5.207C41.069 41.086 43 39.086 43 39.086 44 36.957 44 34 44 24c0-1.341-.139-2.647-.389-3.917z" />
                    </svg>
                    {t('auth.signInWithGoogle')}
                  </Button>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-sm">
                <Link to="/" className="text-white/40 hover:text-white/70 transition-colors">
                  ← {t('auth.backToHome')}
                </Link>
                <span className="text-white/40">
                  {t('auth.hasAccount')}{' '}
                  <Link to="/login" className="font-medium text-[#BED6F6] hover:text-white transition-colors">
                    {t('auth.signIn')}
                  </Link>
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
