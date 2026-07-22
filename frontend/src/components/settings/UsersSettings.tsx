import { Users } from '@/pages/Users';

/**
 * Onglet Paramètres → Utilisateurs & permissions.
 * Réservé au propriétaire (administrateur) de l’organisation.
 */
export function UsersSettings() {
  return <Users embedded />;
}
