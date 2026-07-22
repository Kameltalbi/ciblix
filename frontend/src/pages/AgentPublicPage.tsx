import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';

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

export function AgentPublicPage({
  name,
  subtitle,
  heroDescription,
  icon: Icon,
  gradient,
  iconBg,
  features,
  useCases,
  howItWorks,
  stats,
}: AgentPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <section className={cn('relative overflow-hidden py-20 md:py-28', gradient)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 text-center text-white sm:px-6 lg:px-8">
          <div className={cn('mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg', iconBg)}>
            <Icon size={40} strokeWidth={1.75} />
          </div>
          <h1 className="mb-2 font-serif text-5xl font-bold tracking-tight md:text-6xl">{name}</h1>
          <p className="mb-4 text-xl font-medium text-white/80">{subtitle}</p>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-white/70">{heroDescription}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/register">
              <Button size="lg" className="bg-white px-8 text-lg text-[#016AEB] shadow-xl hover:bg-white/90">
                Essayer gratuitement <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/tarifs">
              <Button
                size="lg"
                className="border-2 border-white bg-transparent px-8 text-lg text-white hover:bg-white hover:text-[#016AEB]"
              >
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="border-b bg-white py-12">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-[#016AEB]">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {features.length > 0 && (
        <section className="bg-[#f7faff] py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Fonctionnalités clés
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[#BED6F6]/40 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4fc] text-[#016AEB]">
                    <feature.icon size={22} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {howItWorks.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Comment ça marche
            </h2>
            <div className="space-y-6">
              {howItWorks.map((step) => (
                <div key={step.step} className="flex gap-4 rounded-2xl border border-[#BED6F6]/40 bg-[#f7faff] p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0071DD] text-sm font-bold text-white">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {useCases.length > 0 && (
        <section className="bg-[#f7faff] py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 text-center font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Cas d’usage
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              {useCases.map((uc) => (
                <div key={uc.title} className="rounded-2xl border border-[#BED6F6]/40 bg-white p-6">
                  <div className="mb-3 flex items-center gap-2 text-[#016AEB]">
                    <CheckCircle2 size={18} />
                    <h3 className="font-semibold text-foreground">{uc.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{uc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0071DD] via-[#016AEB] to-[#0a2540]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center text-white sm:px-6">
          <h2 className="mb-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
            Prêt à activer {name} ?
          </h2>
          <p className="mb-8 text-lg text-white/70">
            Commencez gratuitement et découvrez comment {name} peut transformer votre activité commerciale.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/register">
              <Button size="lg" className="bg-white px-8 text-lg text-[#016AEB] hover:bg-white/90">
                Créer mon compte gratuit <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/tarifs">
              <Button
                size="lg"
                className="border-2 border-white bg-transparent px-8 text-lg text-white hover:bg-white hover:text-[#016AEB]"
              >
                Comparer les plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
