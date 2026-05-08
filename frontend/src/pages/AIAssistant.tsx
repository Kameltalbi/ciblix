import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
}

export function AIAssistant() {
  const { t, i18n } = useTranslation();
  const suggestions = [
    'Comment démarrer sur KTOptima ?',
    'Explique-moi le workflow complet de l’app',
    'Comment utiliser le pipeline Kanban ?',
    t('aiAssistant.suggestions.predictYearEnd'),
    t('aiAssistant.suggestions.recommendations'),
    t('aiAssistant.suggestions.targetAnalysis'),
    t('aiAssistant.suggestions.priorityActions'),
    t('aiAssistant.suggestions.riskAlerts'),
  ];
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('aiAssistant.welcomeMessage'),
    },
  ]);
  const [input, setInput] = useState('');

  const queryMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/ai-assistant/query', { message, language: i18n.language }).then((r) => r.data),
    onSuccess: (data) => {
      const response = formatResponse(data);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response, data: data.result },
      ]);
    },
  });

  const fmtDT = (v: number) => Math.round(v).toLocaleString('fr-FR') + ' DT';

  const formatResponse = (data: any): string => {
    const { result } = data;

    if (typeof result === 'string') {
      return result;
    }
    
    if (result.type === 'metric') {
      return `📊 ${result.title} : ${result.value}`;
    }
    
    if (result.type === 'list') {
      if (!result.data || result.data.length === 0) {
        return `📋 ${result.title}\n\nAucun élément trouvé.`;
      }
      const items = result.data.map((item: any, i: number) => {
        if (typeof item === 'string') return `${i + 1}. ${item}`;
        const parts = Object.entries(item).map(([k, v]) => `${v}`).join(' — ');
        return `${i + 1}. ${parts}`;
      }).join('\n');
      return `📋 ${result.title}\n\n${items}`;
    }
    
    if (result.type === 'text') {
      return result.value;
    }

    if (result.type === 'prediction') {
      const growth = Number(result.growth || 0);
      const hasPipeline = Number(result.pipelineCA || 0) > 0;
      const predictedCA = Number(result.predictedCA || 0);

      let diagnostic = 'Votre dynamique commerciale est stable.';
      if (growth > 8) {
        diagnostic = 'Votre dynamique commerciale est positive et orientée croissance.';
      } else if (growth < 0) {
        diagnostic = 'Votre dynamique commerciale est sous pression et nécessite un pilotage rapproché.';
      }

      let focus = 'Maintenez une cadence régulière de prospection et de qualification pour sécuriser le CA.';
      if (hasPipeline) {
        focus = 'Concentrez vos efforts sur la conversion des opportunités qualifiées tout en gardant un flux constant de prospection.';
      }

      return (
        `📈 Prévision CA fin d'année\n\n` +
        `CA prévisionnel de fin d'année : ${fmtDT(predictedCA)} HT\n\n` +
        `Prévision construite à partir des opportunités réalisées, du pipeline en cours et de la prospection, en tenant compte de la saisonnalité, de la tendance et de la croissance mensuelle.\n\n` +
        `${diagnostic}\n` +
        `${focus}\n\n` +
        `💡 Recommandations professionnelles :\n` +
        `1. Continuer à prospecter de manière structurée pour alimenter le haut de pipeline.\n` +
        `2. Qualifier en continu les prospects pour accélérer les décisions commerciales.\n` +
        `3. Suivre les opportunités clés sans perte de vue, jusqu'à la clôture.\n` +
        `4. Piloter chaque mois les priorités commerciales pour sécuriser et dépasser les objectifs.`
      );
    }

    if (result.type === 'recommendations') {
      const recs = (result.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n');
      return `💡 Recommandations personnalisées\n\n${recs}`;
    }

    if (result.type === 'target_analysis') {
      const monthlyTarget = fmtDT(result.monthlyTarget || 0);
      return `🎯 Analyse des objectifs\n\n` +
        `CA réalisé : ${fmtDT(result.currentCA)} HT\n` +
        `CA prévu fin d'année : ${fmtDT(result.predictedCA)} HT\n` +
        `Objectif mensuel moyen : ${monthlyTarget} HT\n` +
        `Mois restants : ${result.monthsRemaining}\n\n` +
        (result.recommendations ? `💡 Recommandations :\n${(result.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}` : '');
    }
    
    return JSON.stringify(result, null, 2);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    
    queryMutation.mutate(userMessage);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-2 md:px-0 min-h-0 flex-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="shrink-0">
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
          <Sparkles className="text-purple-600 shrink-0" size={28} />
          <span className="break-words">{t('nav.aiAssistant')}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('aiAssistant.subtitle')}</p>
      </div>

      <Card className="flex flex-col min-h-0 h-[calc(100dvh-10.5rem)] sm:h-[calc(100dvh-11rem)] md:h-[600px] md:max-h-[600px] shadow-sm overflow-hidden">
        <CardHeader className="border-b py-3 sm:py-4 shrink-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Bot className="text-purple-600 shrink-0" size={20} />
            <span className="truncate">{t('aiAssistant.conversation')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent
          className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 sm:gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={15} className="text-purple-600 sm:w-4 sm:h-4" />
                </div>
              )}
              <div
                className={`max-w-[min(92%,26rem)] rounded-2xl px-3 py-2.5 sm:p-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {message.content}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-gray-600 sm:w-4 sm:h-4" />
                </div>
              )}
            </div>
          ))}
          {queryMutation.isPending && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-purple-600 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-3 py-2.5 sm:p-3 max-w-[min(92%,26rem)]">
                <p className="text-sm text-muted-foreground">{t('aiAssistant.thinking')}</p>
              </div>
            </div>
          )}
        </CardContent>
        <div className="border-t p-3 sm:p-4 space-y-2 sm:space-y-3 shrink-0 bg-card">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 max-h-[30vh] sm:max-h-none overflow-y-auto sm:overflow-visible">
            {suggestions.map((suggestion: string) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestion(suggestion)}
                className="text-xs w-full sm:w-auto sm:max-w-[280px] justify-start text-left h-auto min-h-9 py-2 px-3 whitespace-normal leading-snug"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('aiAssistant.inputPlaceholder')}
              className="flex-1 min-w-0 min-h-11 text-base sm:text-sm"
              autoComplete="off"
              enterKeyHint="send"
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={handleSend}
              disabled={queryMutation.isPending || !input.trim()}
              aria-label={t('common.submit', { defaultValue: 'Envoyer' })}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
