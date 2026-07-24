import { Navigate } from 'react-router-dom';

/** Legacy : le choix d’1 agent Découverte n’existe plus — solution complète sur tous les paliers. */
export function ChooseDiscoveryAgent() {
  return <Navigate to="/settings" replace />;
}
