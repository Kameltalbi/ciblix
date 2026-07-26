import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingFooter, LandingHeader } from '@/components/landing/LandingSections';
import { cn } from '@/lib/utils';

export function PublicPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-screen bg-white', className)}>
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}

export function PublicHero({
  eyebrow,
  title,
  subtitle,
  cta,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  cta?: { label: string; to: string };
}) {
  return (
    <section className="relative overflow-hidden border-b border-[#BED6F6]/30 bg-gradient-to-b from-[#f7faff] to-white">
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-[#016AEB]/10 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-24">
        {eyebrow ? (
          <p className="mb-3 text-sm font-semibold tracking-wide text-[#1E72B9]">{eyebrow}</p>
        ) : null}
        <h1 className="mb-5 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {title}
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">{subtitle}</p>
        {cta ? (
          <div className="mt-8">
            <Button asChild size="lg" className="gap-2 bg-[#016AEB] hover:bg-[#0159c4]">
              <Link to={cta.to}>
                {cta.label} <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PublicSection({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-16', className)}>
      {children}
    </section>
  );
}
