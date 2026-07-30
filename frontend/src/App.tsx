import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { isPublicMarketingPath } from './lib/publicPaths';
import './i18n';
import { Layout } from './components/Layout';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { MissionGate } from './components/mission/MissionGate';

// Public / auth pages: kept eager since they must render fast on cold load and
// represent the first impression for new visitors.
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { GoogleAuthCallback } from './pages/GoogleAuthCallback';
import { Landing } from './pages/Landing';
import { ExtensionConnect } from './pages/ExtensionConnect';

// Heavy authenticated pages: lazy-loaded so they don't bloat the initial bundle.
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const Organizations = lazy(() =>
  import('./pages/Organizations').then((m) => ({ default: m.Organizations }))
);
const LandingSales = lazy(() =>
  import('./pages/LandingSales').then((m) => ({ default: m.LandingSales }))
);
const Legal = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Legal })));
const Mission = lazy(() => import('./pages/Mission').then((m) => ({ default: m.MissionWizard })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Tarifs = lazy(() => import('./pages/Tarifs').then((m) => ({ default: m.Tarifs })));
const Fonctionnalites = lazy(() =>
  import('./pages/Fonctionnalites').then((m) => ({ default: m.Fonctionnalites }))
);
const Solutions = lazy(() => import('./pages/Solutions').then((m) => ({ default: m.Solutions })));
const Ressources = lazy(() => import('./pages/Ressources').then((m) => ({ default: m.Ressources })));
const APropos = lazy(() => import('./pages/APropos').then((m) => ({ default: m.APropos })));
const ContactPublic = lazy(() =>
  import('./pages/ContactPublic').then((m) => ({ default: m.ContactPublic }))
);
const Securite = lazy(() => import('./pages/Securite').then((m) => ({ default: m.Securite })));
const Faq = lazy(() => import('./pages/Faq').then((m) => ({ default: m.Faq })));
const Documentation = lazy(() =>
  import('./pages/Documentation').then((m) => ({ default: m.Documentation }))
);
const Blog = lazy(() => import('./pages/Blog').then((m) => ({ default: m.Blog })));
const AIAssistant = lazy(() =>
  import('./pages/AIAssistant').then((m) => ({ default: m.AIAssistant }))
);
const ProspectionIA = lazy(() =>
  import('./pages/ProspectionIA').then((m) => ({ default: m.ProspectionIA }))
);
const ScoutAI = lazy(() =>
  import('./pages/ScoutAI').then((m) => ({ default: m.ScoutAI }))
);
const OffreBot = lazy(() =>
  import('./pages/OffreBot').then((m) => ({ default: m.OffreBot }))
);
const GmailAI = lazy(() =>
  import('./pages/GmailAI').then((m) => ({ default: m.GmailAI }))
);
const ConnectAI = lazy(() =>
  import('./pages/ConnectAI').then((m) => ({ default: m.ConnectAI }))
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const ChooseDiscoveryAgent = lazy(() =>
  import('./pages/ChooseDiscoveryAgent').then((m) => ({ default: m.ChooseDiscoveryAgent }))
);
const AllProspects = lazy(() =>
  import('./pages/AllProspects').then((m) => ({ default: m.AllProspects }))
);
const Contacts = lazy(() => import('./pages/Contacts').then((m) => ({ default: m.Contacts })));
const Aujourdhui = lazy(() =>
  import('./pages/Aujourdhui').then((m) => ({ default: m.Aujourdhui }))
);
const ContactDetail = lazy(() =>
  import('./pages/ContactDetail').then((m) => ({ default: m.ContactDetail }))
);

// Public agent pages (marketing / pre-login)
const HuntAIPage = lazy(() => import('./pages/public/HuntAIPage').then((m) => ({ default: m.HuntAIPage })));
const CopilotIAPage = lazy(() => import('./pages/public/CopilotIAPage').then((m) => ({ default: m.CopilotIAPage })));
const ScoutAIPage = lazy(() => import('./pages/public/ScoutAIPage').then((m) => ({ default: m.ScoutAIPage })));
const AnalysteAIPage = lazy(() => import('./pages/public/AnalysteAIPage').then((m) => ({ default: m.AnalysteAIPage })));
const SupportTickets = lazy(() =>
  import('./pages/SupportTickets').then((m) => ({ default: m.SupportTickets }))
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AnalysteAI = lazy(() => import('./pages/AnalysteAI').then((m) => ({ default: m.AnalysteAI })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
      Chargement...
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);

  if (!accessToken) return <Navigate to="/login" replace />;
  if (!user) return null;
  return user.role === 'SUPERADMIN' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const fetchMe = useAuth((s) => s.fetchMe);

  useEffect(() => {
    if (isPublicMarketingPath(window.location.pathname)) return;
    void fetchMe();
  }, [fetchMe]);

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sales" element={<LandingSales />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/extension/connect"
            element={
              <ProtectedRoute>
                <ExtensionConnect />
              </ProtectedRoute>
            }
          />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/google-callback" element={<GoogleAuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal/:type" element={<Legal />} />
          <Route path="/onboarding" element={<Navigate to="/mission" replace />} />
          <Route path="/pricing" element={<Tarifs />} />
          <Route path="/tarifs" element={<Tarifs />} />
          <Route path="/fonctionnalites" element={<Fonctionnalites />} />
          <Route path="/features" element={<Fonctionnalites />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/ressources" element={<Ressources />} />
          <Route path="/resources" element={<Ressources />} />
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/about" element={<APropos />} />
          <Route path="/contact" element={<ContactPublic />} />
          <Route path="/securite" element={<Securite />} />
          <Route path="/security" element={<Securite />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/agent/hunt-ai" element={<HuntAIPage />} />
          <Route path="/agent/copilot-ia" element={<CopilotIAPage />} />
          <Route path="/agent/scout-ai" element={<ScoutAIPage />} />
          <Route path="/agent/analyste-ai" element={<AnalysteAIPage />} />
          <Route path="/agent/offre-bot" element={<Navigate to="/agent/copilot-ia" replace />} />
          <Route path="/agent/factcheck-ai" element={<Navigate to="/" replace />} />
          <Route path="/agent/brand-pulse" element={<Navigate to="/" replace />} />
          <Route path="/agent/comm-bot" element={<Navigate to="/" replace />} />
          <Route path="/payment-pending" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageFallback />}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/contacts" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/aujourdhui" element={<Aujourdhui />} />
                        <Route path="/affaires" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/affaires/:id" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/clients" element={<Navigate to="/contacts" replace />} />
                        <Route path="/clients/:id" element={<Navigate to="/contacts" replace />} />
                        <Route path="/leads" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/calendar" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/expenses" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/activites" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/email-templates" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/objectifs" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/products" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/settings/billing/choose-agent" element={<ChooseDiscoveryAgent />} />
                        <Route path="/settings/organizations" element={<Organizations />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/mission" element={<Mission />} />
                        <Route
                          path="/prospection-ia"
                          element={
                            <MissionGate>
                              <ProspectionIA />
                            </MissionGate>
                          }
                        />
                        <Route path="/agents" element={<Navigate to="/dashboard" replace />} />
                        <Route
                          path="/agents/scout-ai"
                          element={
                            <MissionGate>
                              <ScoutAI />
                            </MissionGate>
                          }
                        />
                        <Route
                          path="/agents/analyste-ai"
                          element={
                            <MissionGate>
                              <AnalysteAI />
                            </MissionGate>
                          }
                        />
                        <Route
                          path="/agents/offre-bot"
                          element={
                            <MissionGate>
                              <OffreBot />
                            </MissionGate>
                          }
                        />
                        <Route path="/agents/factcheck-ai" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/agents/brand-pulse" element={<Navigate to="/dashboard" replace />} />
                        <Route
                          path="/agents/gmail-ai"
                          element={
                            <MissionGate>
                              <GmailAI />
                            </MissionGate>
                          }
                        />
                        <Route
                          path="/agents/connect-ai"
                          element={
                            <MissionGate>
                              <ConnectAI />
                            </MissionGate>
                          }
                        />
                        <Route path="/agents/comm-bot" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/agents/:agentId" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/contacts/:id" element={<ContactDetail />} />
                        <Route path="/connecteurs" element={<Navigate to="/settings" replace />} />
                        <Route path="/all-prospects" element={<AllProspects />} />
                        <Route
                          path="/ai-assistant"
                          element={
                            <MissionGate>
                              <AIAssistant />
                            </MissionGate>
                          }
                        />
                        <Route path="/support" element={<SupportTickets />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Suspense>
                  </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
      <PwaInstallPrompt />
    </>
  );
}
