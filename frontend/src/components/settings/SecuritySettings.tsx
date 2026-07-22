import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function SecuritySettings() {
  const { t } = useTranslation();
  const logout = useAuth((s) => s.logout);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const changePassword = useMutation({
    mutationFn: async () =>
      api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      }),
    onSuccess: async () => {
      setSuccess(t('auth.passwordChangedSuccess'));
      setError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
      }, 1200);
    },
    onError: (err: any) => {
      setSuccess('');
      setError(err.response?.data?.error || t('auth.passwordChangeError'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    changePassword.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Lock className="text-slate-700" size={20} />
          </div>
          <div>
            <CardTitle>{t('settings.securityTitle')}</CardTitle>
            <CardDescription>{t('settings.securitySubtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label>{t('auth.currentPassword')}</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? 'Masquer' : 'Afficher'}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('auth.newPassword')}</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Masquer' : 'Afficher'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('auth.confirmPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {success && <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{success}</p>}
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? t('common.loading') : t('auth.changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
