import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export type SuggestionItem = {
  id: string;
  type: string;
  message: string;
  targetAgent?: string | null;
  status: string;
  contactId: string;
};

export function SuggestionBanner({
  contactId,
  suggestions,
}: {
  contactId: string;
  suggestions: SuggestionItem[];
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pending = suggestions.filter((s) => s.status === 'PENDING');

  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/suggestions/${id}/accept`).then((r) => r.data as { redirectTo: string }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['contact', contactId] });
      if (data.redirectTo) navigate(data.redirectTo);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.post(`/suggestions/${id}/dismiss`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contact', contactId] }),
  });

  if (pending.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {pending.map((suggestion) => (
        <div
          key={suggestion.id}
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-amber-950 flex gap-2">
            <Lightbulb size={16} className="shrink-0 mt-0.5 text-amber-700" />
            <span>{suggestion.message}</span>
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => acceptMutation.mutate(suggestion.id)}
              disabled={acceptMutation.isPending || dismissMutation.isPending}
            >
              Accepter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismissMutation.mutate(suggestion.id)}
              disabled={acceptMutation.isPending || dismissMutation.isPending}
            >
              Ignorer
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
