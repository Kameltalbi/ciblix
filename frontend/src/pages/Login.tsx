import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('admin@bilan-crm.tn');
  const [password, setPassword] = useState('changeme123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          navigate('/dashboard');
        }
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto">
            <img src="/logo.png" alt="ktOptima" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle>ktOptima</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
          </div>
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
