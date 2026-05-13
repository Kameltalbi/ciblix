import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      // Force fresh login with new credentials.
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
        <CardTitle>{t('settings.securityTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label>{t('auth.currentPassword')}</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('auth.newPassword')}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('auth.confirmPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}
          {success && <p className="text-sm text-sky-700 bg-sky-50 px-3 py-2 rounded-md">{success}</p>}
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? t('common.loading') : t('auth.changePassword')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

