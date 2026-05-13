import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!token) {
      setError(t('auth.invalidResetLink'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(t('auth.passwordResetSuccess'));
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.passwordResetError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.resetPasswordTitle')}</CardTitle>
          <CardDescription>{t('auth.resetPasswordHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.newPassword')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
            {success && <p className="text-sm text-sky-700 bg-sky-50 px-3 py-2 rounded-md">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.resetPasswordAction')}
            </Button>
            <div className="text-sm">
              <Link to="/login" className="text-leaf hover:underline">← {t('auth.backToLogin')}</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

