export function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    GAGNE: { cls: 'bg-green-50 text-green-700', label: '✅ Gagné' },
    QUALIFIE: { cls: 'bg-blue-50 text-blue-700', label: '🔵 Qualifié' },
    PROPOSITION: { cls: 'bg-orange-50 text-orange-700', label: '🟠 Proposition' },
    NEGOCIATION: { cls: 'bg-purple-50 text-purple-700', label: '🟣 Négociation' },
    PROSPECT: { cls: 'bg-yellow-50 text-yellow-700', label: '🟡 Prospect' },
    PERDU: { cls: 'bg-red-50 text-red-700', label: '❌ Perdu' },
  };
  const { cls, label } = map[statut] || map.PROSPECT;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
  );
}
