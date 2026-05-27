import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Megaphone,
  Loader2,
  Copy,
  Check,
  Sparkles,
  FileText,
  Linkedin,
  Mail,
  Package,
  Globe,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

type ContentType = 'seo' | 'linkedin' | 'newsletter' | 'product_sheet' | 'service_page';

const CONTENT_TYPES: { id: ContentType; label: string; icon: typeof FileText; desc: string }[] = [
  { id: 'seo', label: 'Article SEO', icon: Search, desc: 'Contenu optimisé pour le référencement' },
  { id: 'linkedin', label: 'Post LinkedIn', icon: Linkedin, desc: 'Publication B2B prête à publier' },
  { id: 'newsletter', label: 'Newsletter', icon: Mail, desc: 'Email client ou prospects' },
  { id: 'product_sheet', label: 'Fiche produit', icon: Package, desc: 'Présentation produit structurée' },
  { id: 'service_page', label: 'Page service', icon: Globe, desc: 'Contenu page web service' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copié' : 'Copier'}
    </Button>
  );
}

function ContentPreview({ contentType, content }: { contentType: ContentType; content: Record<string, unknown> }) {
  if (content.raw) {
    return <pre className="whitespace-pre-wrap text-sm">{String(content.raw)}</pre>;
  }

  if (contentType === 'seo') {
    return (
      <div className="space-y-4 text-sm">
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Titre</p><p className="text-lg font-bold">{String(content.title || '')}</p></div>
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Meta description</p><p>{String(content.metaDescription || '')}</p></div>
        <div><p className="text-xs font-semibold uppercase text-muted-foreground">Slug</p><p className="font-mono text-xs">{String(content.slug || '')}</p></div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">{String(content.body || '')}</div>
        {content.cta != null && String(content.cta) !== '' && (
          <p className="rounded-lg bg-rose-50 p-3 font-medium text-rose-800">{String(content.cta)}</p>
        )}
      </div>
    );
  }

  if (contentType === 'linkedin') {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-lg">{String(content.hook || '')}</p>
        <p className="whitespace-pre-wrap">{String(content.body || '')}</p>
        {Array.isArray(content.hashtags) && (
          <p className="text-blue-600">{(content.hashtags as string[]).join(' ')}</p>
        )}
        {content.cta != null && String(content.cta) !== '' && (
          <p className="font-medium">{String(content.cta)}</p>
        )}
      </div>
    );
  }

  if (contentType === 'newsletter') {
    return (
      <div className="space-y-4 text-sm">
        <div><p className="text-xs uppercase text-muted-foreground">Objet</p><p className="font-bold">{String(content.subject || '')}</p></div>
        <p className="text-muted-foreground">{String(content.preheader || '')}</p>
        <p>{String(content.intro || '')}</p>
        {Array.isArray(content.sections) && (content.sections as { title: string; content: string }[]).map((s, i) => (
          <div key={i} className="rounded-lg border p-3">
            <p className="font-semibold">{s.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.content}</p>
          </div>
        ))}
        {content.cta != null && String(content.cta) !== '' && (
          <p className="font-medium text-rose-700">{String(content.cta)}</p>
        )}
        {content.footer != null && String(content.footer) !== '' && (
          <p className="text-muted-foreground">{String(content.footer)}</p>
        )}
      </div>
    );
  }

  if (contentType === 'product_sheet') {
    return (
      <div className="space-y-3 text-sm">
        <h3 className="text-xl font-bold">{String(content.productName || '')}</h3>
        <p className="text-rose-700 font-medium">{String(content.tagline || '')}</p>
        <p>{String(content.summary || '')}</p>
        {Array.isArray(content.benefits) && (
          <ul className="list-disc pl-5">{(content.benefits as string[]).map((b, i) => <li key={i}>{b}</li>)}</ul>
        )}
        {Array.isArray(content.features) && (
          <ul className="list-disc pl-5">{(content.features as string[]).map((f, i) => <li key={i}>{f}</li>)}</ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-xl font-bold">{String(content.headline || '')}</h3>
      <p className="text-muted-foreground">{String(content.subheadline || '')}</p>
      <p>{String(content.valueProposition || '')}</p>
      {Array.isArray(content.sections) && (content.sections as { title: string; content: string }[]).map((s, i) => (
        <div key={i}>
          <p className="font-semibold">{s.title}</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{s.content}</p>
        </div>
      ))}
      {content.cta != null && String(content.cta) !== '' && (
        <p className="font-medium text-rose-700">{String(content.cta)}</p>
      )}
    </div>
  );
}

export function CommBot() {
  const [contentType, setContentType] = useState<ContentType>('linkedin');
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'expert'>('professional');
  const [productId, setProductId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  const { data: context } = useQuery({
    queryKey: ['comm-bot-context'],
    queryFn: () => api.get('/comm-bot/context').then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post('/comm-bot/generate', {
        contentType,
        topic,
        targetAudience,
        keywords,
        tone,
        productId: productId || undefined,
        serviceName: serviceName || undefined,
        extraNotes,
        language: 'fr',
      }).then((r) => r.data),
  });

  const result = generateMutation.data;
  const plainText = result?.content ? JSON.stringify(result.content, null, 2) : '';

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white">
          <Megaphone size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CommBot</h1>
          <p className="text-sm text-muted-foreground">
            Marketing & contenu B2B — SEO, LinkedIn, newsletters, fiches produits et pages services
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700 ring-1 ring-rose-200">
            Exclusif plan Professionnel
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CONTENT_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setContentType(t.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all hover:shadow-md',
                contentType === t.id ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200' : 'border-gray-200 bg-white',
              )}
            >
              <Icon size={20} className={contentType === t.id ? 'text-rose-600' : 'text-gray-400'} />
              <p className="mt-2 font-semibold text-sm">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles size={18} className="text-rose-600" />
              Paramètres de génération
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sujet / angle *</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Lancement de notre offre de conseil en bilan carbone pour les PME industrielles"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Audience cible</Label>
              <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Directeurs industriels, PME tunisiennes..." />
            </div>
            {(contentType === 'seo' || contentType === 'service_page') && (
              <div className="space-y-1.5">
                <Label>Mots-clés SEO</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="bilan carbone, PME, Tunisie..." />
              </div>
            )}
            {contentType === 'product_sheet' && context?.products?.length > 0 && (
              <div className="space-y-1.5">
                <Label>Produit CRM (optionnel)</Label>
                <Select value={productId || 'none'} onValueChange={(v) => setProductId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun — saisie libre</SelectItem>
                    {context.products.map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {contentType === 'service_page' && (
              <div className="space-y-1.5">
                <Label>Nom du service</Label>
                <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Audit énergétique, formation..." />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Ton</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professionnel B2B</SelectItem>
                  <SelectItem value="friendly">Accessible & chaleureux</SelectItem>
                  <SelectItem value="expert">Expert & crédible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes complémentaires</Label>
              <Textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={2} placeholder="Contraintes, messages clés, à éviter..." />
            </div>
            <Button
              className="w-full gap-2 bg-rose-600 hover:bg-rose-700"
              disabled={topic.length < 3 || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Générer le contenu
            </Button>
          </CardContent>
        </Card>

        <Card className="min-h-[24rem]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Aperçu</CardTitle>
            {plainText && <CopyButton text={plainText} />}
          </CardHeader>
          <CardContent>
            {generateMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={32} className="mb-3 animate-spin text-rose-500" />
                <p className="text-sm">CommBot rédige votre contenu...</p>
              </div>
            )}
            {!generateMutation.isPending && !result && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Choisissez un format, décrivez votre sujet et lancez la génération.
              </p>
            )}
            {result?.content && !generateMutation.isPending && (
              <ContentPreview contentType={contentType} content={result.content as Record<string, unknown>} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
