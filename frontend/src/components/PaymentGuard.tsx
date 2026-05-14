import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function PaymentGuard({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const paymentStatus = useAuth((s) => s.paymentStatus);

  if (user?.role === 'SUPERADMIN') {
    return <>{children}</>;
  }

  if (paymentStatus !== 'APPROVED' && paymentStatus !== null) {
    return <Navigate to="/payment-pending" replace />;
  }

  return <>{children}</>;
}
