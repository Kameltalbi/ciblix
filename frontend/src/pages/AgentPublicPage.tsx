import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, Globe, Menu, X, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface UseCase {
  title: string;
  description: string;
}

interface AgentPageProps {
  name: string;
  subtitle: string;
  heroDescription: string;
  icon: LucideIcon;
  gradient: string;
  iconBg: string;
  features: Feature[];
  useCases: UseCase[];
  howItWorks: { step: string; title: string; description: string }[];
  stats: { value: string; label: string }[];
}

function PublicHeader() {
  const { i18n, t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#BED6F6]/40 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <img src="/logo-ciblix.png" alt="CIBLIX" className="h-10 w-auto sm:h-12" />
          </Link>
          <nav className="hidden md:flex items-center gap-5">
            <Link to="/" className="text-sm text-muted-foreground hover:text-[#0071DD]">Accueil</Link>
            <Link to="/#agents" className="text-sm text-muted-foreground hover:text-[#0071DD]">Agents IA</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-[#0071DD]">{t('landing.navPricing')}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const langs = ['fr', 'en', 'ar'];
                const idx = langs.indexOf(i18n.language);
                i18n.changeLanguage(langs[(idx + 1) % langs.length]);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Globe size={14} className="text-[#016AEB]" />
              {i18n.language.toUpperCase()}
            </button>
            <button className="md:hidden p-2 text-[#1E72B9]" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-[#BED6F6] text-[#0071DD]">
                  {t('auth.signIn')}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t('auth.signUp')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t bg-white px-4 py-4 space-y-3">
          <Link to="/" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Accueil</Link>
          <Link to="/#agents" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Agents IA</Link>
          <Link to="/pricing" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Tarifs</Link>
          <div className="pt-3 space-y-2">
            <Link to="/login" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full">{t('auth.signIn')}</Button></Link>
            <Link to="/register" onClick={() => setMobileOpen(false)}><Button className="w-full">{t('auth.signUp')}</Button></Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function AgentPublicPage({
  name, subtitle, heroDescription, icon: Icon, gradient, iconBg,
  features, useCases, howItWorks, stats,
}: AgentPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className={cn('relative overflow-hidden py-20 md:py-28', gradient)}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className={cn('mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg', iconBg)}>
            <Icon size={40} strokeWidth={1.75} />
          </div>
          <h1 className="mb-2 text-5xl font-serif font-bold tracking-tight md:text-6xl">{name}</h1>
          <p className="mb-4 text-xl font-medium text-white/80">{subtitle}</p>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-white/70">{heroDescription}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-[#016AEB] hover:bg-white/90 px-8 text-lg shadow-xl">
                Essayer gratuitement <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 text-lg">
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats.length > 0 && (
        <section className="border-b bg-white py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-bold text-[#0071DD] md:text-4xl">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="bg-[#f7faff] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="mb-3 text-3xl font-serif font-bold text-[#0071DD] md:text-4xl">
              Ce que {name} fait pour vous
            </h2>
            <p className="text-lg text-muted-foreground">Des fonctionnalités conçues pour votre productivité</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-[#BED6F6]/30 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] ring-1 ring-[#BED6F6]/50">
                  <f.icon size={24} className="text-[#016AEB]" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="mb-3 text-3xl font-serif font-bold text-[#0071DD] md:text-4xl">Comment ça marche ?</h2>
            <p className="text-lg text-muted-foreground">En quelques étapes simples</p>
          </div>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 hidden w-0.5 bg-gradient-to-b from-[#0071DD] to-[#BED6F6] md:block" />
            <div className="space-y-10">
              {howItWorks.map((step, i) => (
                <div key={i} className="flex gap-6">
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0071DD] text-lg font-bold text-white shadow-lg">
                    {step.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="mb-1 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="bg-gradient-to-b from-[#f4f8fd] to-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="mb-3 text-3xl font-serif font-bold text-[#0071DD] md:text-4xl">Cas d'usage</h2>
            <p className="text-lg text-muted-foreground">Des résultats concrets pour votre activité</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {useCases.map((uc) => (
              <div key={uc.title} className="rounded-2xl border border-[#BED6F6]/30 bg-white p-6">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-[#016AEB]" />
                  <h3 className="font-semibold text-foreground">{uc.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#016AEB] to-[#0a2540] py-20 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Sparkles size={36} className="mx-auto mb-4 text-[#BED6F6]" />
          <h2 className="mb-4 text-3xl font-serif font-bold md:text-4xl">
            Prêt à activer {name} ?
          </h2>
          <p className="mb-8 text-lg text-white/70">
            Commencez gratuitement et découvrez comment {name} peut transformer votre activité commerciale.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-[#016AEB] hover:bg-white/90 px-8 text-lg">
                Créer mon compte gratuit <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 text-lg">
                Comparer les plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="border-t bg-white py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <img src="/logo-ciblix.png" alt="CIBLIX" className="h-8 w-auto" />
          </Link>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-[#0071DD]">Accueil</Link>
            <Link to="/#agents" className="hover:text-[#0071DD]">Agents IA</Link>
            <Link to="/pricing" className="hover:text-[#0071DD]">Tarifs</Link>
            <Link to="/login" className="hover:text-[#0071DD]">Connexion</Link>
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} CIBLIX</p>
        </div>
      </footer>
    </div>
  );
}
