import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, TrendingUp, Shield, Zap, Users, BarChart3, CheckCircle2, ArrowRight, Mail, Phone, MapPin, Menu, X, Target, Lock, DollarSign, PieChart, Award, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { OnboardingChatbot } from '@/components/OnboardingChatbot';
import { cn } from '@/lib/utils';

const SOFTFACTURE_BANNER_SLIDE_MS = 500;

export function Landing() {
  const { i18n, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupEntered, setPopupEntered] = useState(false);
  const [popupExiting, setPopupExiting] = useState(false);
  const popupExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const today = new Date().toDateString();
    const storageKey = 'softfacture_popup_count';
    const storageDateKey = 'softfacture_popup_date';

    const storedDate = localStorage.getItem(storageDateKey);
    const storedCount = parseInt(localStorage.getItem(storageKey) || '0', 10);

    if (storedDate !== today) {
      localStorage.setItem(storageKey, '0');
      localStorage.setItem(storageDateKey, today);
    }

    const currentCount = storedDate === today ? storedCount : 0;

    if (currentCount < 2) {
      const timer = setTimeout(() => {
        setShowPopup(true);
        localStorage.setItem(storageKey, String(currentCount + 1));
        localStorage.setItem(storageDateKey, today);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!showPopup) return;

    setPopupEntered(false);
    setPopupExiting(false);
    const enterDelayMs = 30;
    const slideMs = SOFTFACTURE_BANNER_SLIDE_MS;
    const enterTimer = setTimeout(() => setPopupEntered(true), enterDelayMs);

    // 5 s affichées une fois la barre ouverte, puis fermeture
    const visibleMs = 5000;
    popupExitTimerRef.current = setTimeout(
      () => setPopupExiting(true),
      enterDelayMs + slideMs + visibleMs,
    );
    popupUnmountTimerRef.current = setTimeout(() => {
      setShowPopup(false);
      setPopupExiting(false);
      setPopupEntered(false);
    }, enterDelayMs + slideMs + visibleMs + slideMs);

    return () => {
      clearTimeout(enterTimer);
      if (popupExitTimerRef.current) clearTimeout(popupExitTimerRef.current);
      if (popupUnmountTimerRef.current) clearTimeout(popupUnmountTimerRef.current);
    };
  }, [showPopup]);

  const dismissSoftfactureBanner = () => {
    if (popupExitTimerRef.current) clearTimeout(popupExitTimerRef.current);
    if (popupUnmountTimerRef.current) clearTimeout(popupUnmountTimerRef.current);
    setPopupExiting(true);
    popupUnmountTimerRef.current = setTimeout(() => {
      setShowPopup(false);
      setPopupExiting(false);
      setPopupEntered(false);
    }, SOFTFACTURE_BANNER_SLIDE_MS);
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="ktOptima" className="h-8 w-auto" />
              <span className="text-xl font-bold text-foreground">CRM</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 flex-1 justify-center">
              <a href="#features" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                {t('landing.navFeatures')}
              </a>
              <a href="#why" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                {t('landing.navWhy')}
              </a>
              <Link to="/pricing" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                {t('landing.navPricing')}
              </Link>
              <a href="#contact" className="text-lg text-muted-foreground hover:text-foreground transition-colors">
                {t('landing.navContact')}
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const languages = ['fr', 'en', 'ar'];
                  const currentIndex = languages.indexOf(i18n.language);
                  const nextIndex = (currentIndex + 1) % languages.length;
                  i18n.changeLanguage(languages[nextIndex]);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Change language"
              >
                <Globe size={18} />
                <span className={`font-semibold ${
                  i18n.language === 'ar' ? 'text-green-600' :
                  i18n.language === 'fr' ? 'text-blue-600' :
                  'text-red-600'
                }`}>{i18n.language.toUpperCase()}</span>
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="hidden md:flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost" size="lg" className="bg-[#d1fae4] hover:bg-[#c1ebe0]">
                    {t('auth.signIn')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" className="bg-leaf hover:bg-leaf/90">
                    {t('auth.signUp')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navFeatures')}
              </a>
              <a href="#why" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navWhy')}
              </a>
              <Link to="/pricing" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navPricing')}
              </Link>
              <a href="#contact" className="block text-lg text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.navContact')}
              </a>
              <div className="pt-4 space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="lg" className="w-full bg-[#d1fae4] hover:bg-[#c1ebe0]">
                    {t('auth.signIn')}
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="lg" className="w-full bg-leaf hover:bg-leaf/90">
                    {t('auth.signUp')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sage/20 via-background to-emerald-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-lg font-medium mb-6">
              <TrendingUp size={24} />
              {t('landing.badge')}
            </div>
            <h1 className="text-6xl md:text-8xl font-serif font-bold text-foreground mb-6">
              {t('landing.heroTitle1')}{' '}
              <span className="text-leaf">{t('landing.heroTitle2')}</span>
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-leaf hover:bg-leaf/90 text-lg px-8">
                  {t('landing.cta')}
                  <ArrowRight size={20} className="ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  {t('landing.demo')}
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3 text-base">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                {t('landing.noCommitment')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                {t('landing.localSupport')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                {t('landing.secure')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section 2 */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            <div className="rounded-3xl border bg-gradient-to-br from-sage/10 to-emerald-50/20 p-8 md:p-10 min-h-[420px] h-full flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
                  <BarChart3 size={16} />
                  {t('landing.heroSection2Badge', { defaultValue: 'Pilotage visuel' })}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                  {t('landing.heroSection2Title', { defaultValue: 'Suivez vos indicateurs en un coup d’œil' })}
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  {t('landing.heroSection2Subtitle', {
                    defaultValue:
                      'Une vue claire du CA, du pipeline et de la conversion pour décider vite et garder le contrôle.',
                  })}
                </p>
              </div>
              <div className="space-y-3 text-sm md:text-base text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  {t('landing.heroSection2Point1', { defaultValue: 'KPIs mis à jour en temps réel' })}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  {t('landing.heroSection2Point2', { defaultValue: 'Graphiques mensuels simples à lire' })}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  {t('landing.heroSection2Point3', { defaultValue: 'Répartition CA réalisée, pipeline, prospection' })}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-4 md:p-6 min-h-[420px] h-full flex flex-col">
              <div className="relative flex-1 rounded-2xl overflow-hidden border bg-white">
                <img
                  src="/image.png"
                  alt="Aperçu du dashboard CRM"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {t('landing.featuresTitle')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <BarChart3 size={24} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureDashboard')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureDashboardDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <Users size={24} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureClients')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureClientsDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <Zap size={24} className="text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureAI')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureAIDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Shield size={24} className="text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureSecurity')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureSecurityDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center mb-4">
                <TrendingUp size={24} className="text-rose-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureAnalytics')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureAnalyticsDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
                <Users size={24} className="text-teal-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureCollaboration')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureCollaborationDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                <Target size={24} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureObjectives')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureObjectivesDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                <Lock size={24} className="text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featurePermissions')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featurePermissionsDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                <DollarSign size={24} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureExpenses')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureExpensesDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center mb-4">
                <PieChart size={24} className="text-cyan-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureCoverage')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureCoverageDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-4">
                <Award size={24} className="text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureBonuses')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureBonusesDesc')}
              </p>
            </div>
            <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                <Target size={24} className="text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('landing.featureBonusCustomization')}</h3>
              <p className="text-base text-muted-foreground">
                {t('landing.featureBonusCustomizationDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use Section */}
      <section id="why" className="py-20 bg-gradient-to-br from-sage/10 to-emerald-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
                {t('landing.whyTitle')}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {t('landing.whySubtitle')}
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyLocal')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyLocalDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyEasy')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyEasyDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whySupport')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whySupportDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('landing.whyPrice')}</h4>
                    <p className="text-base text-muted-foreground">
                      {t('landing.whyPriceDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-leaf to-emerald-600 rounded-3xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">{t('landing.ctaTitle')}</h3>
                <p className="text-emerald-100 mb-6">
                  {t('landing.ctaSubtitle')}
                </p>
                <Link to="/register">
                  <Button size="lg" className="bg-white text-leaf hover:bg-white/90 w-full">
                    {t('landing.ctaButton')}
                    <ArrowRight size={20} className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="ktOptima" className="h-8 w-auto" />
              </div>
              <p className="text-gray-400 mb-4 max-w-md text-base">
                {t('landing.footerDesc')}
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
                  <Mail size={20} />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
                  <Phone size={20} />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-lg">{t('landing.footerLinks')}</h4>
              <ul className="space-y-2 text-gray-400 text-base">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    {t('landing.navFeatures')}
                  </a>
                </li>
                <li>
                  <a href="#why" className="hover:text-white transition-colors">
                    {t('landing.navWhy')}
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    {t('auth.signIn')}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    {t('auth.signUp')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-lg">{t('landing.footerContact')}</h4>
              <ul className="space-y-2 text-gray-400 text-base">
                <li className="flex items-center gap-2">
                  <Mail size={16} />
                  contact@ktoptima.com
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={16} />
                  +216 55 053 505
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={16} />
                  Tunis, Tunisie
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-base">
            <p>{t('landing.footerRights')}</p>
          </div>
        </div>
      </footer>

      {/* Softfacture — bandeau latéral gauche */}
      {showPopup && (
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-[100] w-[min(19rem,88vw)] flex flex-col shadow-2xl',
            'bg-gradient-to-b from-leaf-mid via-leaf to-[#0f3d22]',
            'ring-2 ring-sage/40 border-r border-leaf-light/35',
            'transition-transform duration-500 ease-out',
            popupExiting || !popupEntered ? '-translate-x-full' : 'translate-x-0',
          )}
          role="complementary"
          aria-label="Softfacture"
        >
          <div className="relative flex flex-1 flex-col justify-center px-5 py-8 text-white">
            <button
              type="button"
              onClick={dismissSoftfactureBanner}
              className="absolute top-3 right-3 rounded-md p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            <a
              href="https://softfacture.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-4 pr-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                <TrendingUp size={24} className="text-white" aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight drop-shadow-sm">Softfacture</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/95">
                  Gérez votre facturation facilement avec notre solution Softfacture.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-light group-hover:text-white transition-colors drop-shadow-sm">
                Découvrir
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          </div>
        </div>
      )}

      <OnboardingChatbot />
    </div>
  );
}
