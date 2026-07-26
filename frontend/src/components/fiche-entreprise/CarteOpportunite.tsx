import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type CarteOpportuniteProps = {
  companyName: string;
  /** secteur · ville · taille */
  identityLine: string;
  /** Une phrase factuelle — jamais un score */
  pourquoi: string;
  onPertinent: () => void;
  onPasPourMoi: () => void;
  onOpen?: () => void;
  pending?: boolean;
  className?: string;
};

/**
 * Carte d’opportunité — 4 éléments max, 2 actions, aucun défilement.
 * Interdit : score, décideur, logo.
 */
export function CarteOpportunite({
  companyName,
  identityLine,
  pourquoi,
  onPertinent,
  onPasPourMoi,
  onOpen,
  pending,
  className,
}: CarteOpportuniteProps) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-neutral-200/90 bg-white px-4 py-4 shadow-sm',
        className
      )}
    >
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <h3 className="text-base font-medium leading-snug text-neutral-900">{companyName}</h3>
        {identityLine ? (
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{identityLine}</p>
        ) : null}
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-800">{pourquoi}</p>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 text-sm"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onPasPourMoi();
          }}
        >
          Pas pour moi
        </Button>
        <Button
          type="button"
          className="h-11 bg-[#016AEB] text-sm hover:bg-[#0159c4]"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onPertinent();
          }}
        >
          Pertinent
        </Button>
      </div>
    </article>
  );
}
