import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setResetUrl('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message || t('auth.resetLinkSent'));
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.resetRequestError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sage to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.forgotPassword')}</CardTitle>
          <CardDescription>{t('auth.forgotPasswordHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {message && <p className="text-sm text-sky-700 bg-sky-50 px-3 py-2 rounded-md">{message}</p>}
            {resetUrl && (
              <div className="text-xs bg-muted p-2 rounded-md break-all">
                <p className="font-medium mb-1">{t('auth.resetLinkGenerated')}</p>
                <a href={resetUrl} className="text-leaf underline">{resetUrl}</a>
              </div>
            )}
            {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.sendResetLink')}
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

