import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Phone, Mail, Calendar, FileText, Trash2, Pencil, DollarSign, Target, TrendingUp, Building2, Package, Clock, MoreVertical, Edit, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDT, MOIS } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatutBadge } from './Dashboard';
import type { Affaire, Activite, ActiviteType } from '@/types';

const ACTIVITY_ICONS: Record<ActiviteType, any> = {
  NOTE: FileText,
  APPEL: Phone,
  EMAIL_ENVOYE: Mail,
  EMAIL_RECU: Mail,
  RDV: Calendar,
  CHANGEMENT_STATUT: FileText,
  DEVIS_CREE: FileText,
  FACTURE_CREEE: FileText,
  AUTRE: FileText,
};

const ACTIVITY_LABELS: Record<ActiviteType, string> = {
  NOTE: 'Note',
  APPEL: 'Appel',
  EMAIL_ENVOYE: 'Email envoyé',
  EMAIL_RECU: 'Email reçu',
  RDV: 'Rendez-vous',
  CHANGEMENT_STATUT: 'Changement de statut',
  DEVIS_CREE: 'Devis créé',
  FACTURE_CREEE: 'Facture créée',
  AUTRE: 'Autre',
};

type ActivityFormData = {
  type: ActiviteType;
  title: string;
  content: string;
  /** datetime-local lorsque type = RDV — crée aussi une entrée sur le calendrier */
  scheduledStart: string;
};

const EMPTY_ACTIVITY: ActivityFormData = {
  type: 'NOTE',
  title: '',
  content: '',
  scheduledStart: '',
};

export function AffaireDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState<ActivityFormData>(EMPTY_ACTIVITY);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState({ subject: '', body: '' });

  useEffect(() => {
    if (searchParams.get('addActivity') !== '1') return;
    setActivityOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('addActivity');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const { data: affaire, isLoading } = useQuery<Affaire>({
    queryKey: ['affaire', id],
    queryFn: () => api.get(`/affaires/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: emailTemplates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get('/email-templates').then((r) => r.data),
  });

  const saveActivityMutation = useMutation({
    mutationFn: (data: ActivityFormData) => {
      const body: Record<string, unknown> = {
        type: data.type,
        title: data.title,
        content: data.content,
        affaireId: id,
      };
      if (data.type === 'RDV' && data.scheduledStart.trim()) {
        body.scheduledStart = data.scheduledStart;
      }
      return api.post('/activites', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaire', id] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setActivityOpen(false);
      setActivityForm(EMPTY_ACTIVITY);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/email-templates/${templateId}/send`, { affaireId: id }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaire', id] });
      setTemplateOpen(false);
      setSelectedTemplateId('');
      alert(t('affaireDetail.emailSent', { defaultValue: 'Email envoyé avec succès !' }));
    },
  });

  const handlePreviewTemplate = async () => {
    if (!selectedTemplateId || !id) return;
    const data = await api.post(`/email-templates/${selectedTemplateId}/preview`, { affaireId: id }).then((r) => r.data);
    setPreviewData(data);
    setPreviewOpen(true);
  };

  const handleSendTemplate = () => {
    if (!selectedTemplateId) return;
    if (confirm(t('affaireDetail.confirmSendEmail', { defaultValue: 'Envoyer cet email ?' }))) {
      sendEmailMutation.mutate(selectedTemplateId);
    }
  };

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: string) => api.delete(`/activites/${activityId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affaire', id] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const handleCallClient = () => {
    if (affaire?.client?.phone) {
      window.location.href = `tel:${affaire.client.phone}`;
    }
  };

  const handleEmailClient = () => {
    if (affaire?.client?.email) {
      window.location.href = `mailto:${affaire.client.email}`;
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!affaire) {
    return <div className="text-center py-20 text-muted-foreground">{t('affaireDetail.notFound', { defaultValue: 'Affaire introuvable' })}</div>;
  }

  const handleActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveActivityMutation.mutate(activityForm);
  };

  return (
    <div className="space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/affaires')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="font-serif text-2xl md:text-3xl">{affaire.title}</h1>
            <p className="text-sm text-muted-foreground">{affaire.client?.name || 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {affaire.client?.phone && (
            <Button variant="outline" size="sm" onClick={handleCallClient}>
              <Phone size={16} className="mr-2" /> {t('affaireDetail.call', { defaultValue: 'Appeler' })}
            </Button>
          )}
          {affaire.client?.email && (
            <Button variant="outline" size="sm" onClick={handleEmailClient}>
              <Mail size={16} className="mr-2" /> {t('common.email')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
            <Send size={16} className="mr-2" /> {t('emailTemplates.template')}
          </Button>
          <Button size="sm" onClick={() => setActivityOpen(true)}>
            <Plus size={16} className="mr-2" /> {t('affaireDetail.addActivity', { defaultValue: 'Ajouter activité' })}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-2 border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Montant HT</p>
                <p className="text-lg font-bold text-emerald-600">{fmtDT(Number(affaire.montantHT))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Statut</p>
                <StatutBadge statut={affaire.statut} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Probabilité</p>
                <p className="text-lg font-bold">{affaire.probabilite}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${
          (affaire.score || 0) >= 70 ? 'border-green-200 bg-green-50/30' :
          (affaire.score || 0) >= 40 ? 'border-yellow-200 bg-yellow-50/30' :
          'border-red-200 bg-red-50/30'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className={`w-5 h-5 ${
                (affaire.score || 0) >= 70 ? 'text-green-600' :
                (affaire.score || 0) >= 40 ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className={`text-lg font-bold ${
                  (affaire.score || 0) >= 70 ? 'text-green-600' :
                  (affaire.score || 0) >= 40 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{affaire.score || 0}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Échéance</p>
                <p className="text-sm font-semibold">{MOIS[affaire.moisPrevu]} {affaire.anneePrevue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 size={18} /> Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{affaire.client?.name || 'N/A'}</p>
              </div>
              {affaire.client?.contactName && (
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{affaire.client.contactName}</p>
                </div>
              )}
              {affaire.client?.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">{affaire.client.email}</p>
                </div>
              )}
              {affaire.client?.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium text-sm">{affaire.client.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Info */}
          {affaire.product && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package size={18} /> Produit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{affaire.product.name}</p>
                </div>
                {affaire.product.category?.name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Catégorie</p>
                    <p className="font-medium">{affaire.product.category.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Prix unitaire</p>
                  <p className="font-medium">{fmtDT(Number(affaire.product.price))}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign size={18} /> Détails financiers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Montant HT</p>
                <p className="font-medium">{fmtDT(Number(affaire.montantHT))}</p>
              </div>
              {affaire.viaPartenaire && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Via partenaire</p>
                    <p className="font-medium">Oui</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taux commission</p>
                    <p className="font-medium">{affaire.tauxCommission}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Commission estimée</p>
                    <p className="font-medium text-purple-600">
                      {fmtDT(Number(affaire.montantHT) * (affaire.tauxCommission / 100))}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activities */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('affaireDetail.activitiesHistory', { defaultValue: 'Historique des activités' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {affaire.activites?.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">{t('affaireDetail.noActivity', { defaultValue: 'Aucune activité enregistrée' })}</p>
                    <Button size="sm" onClick={() => setActivityOpen(true)}>
                      <Plus size={14} className="mr-2" /> {t('affaireDetail.addFirstActivity', { defaultValue: 'Ajouter la première activité' })}
                    </Button>
                  </div>
                ) : (
                  affaire.activites?.map((a: Activite, index: number) => {
                    const Icon = ACTIVITY_ICONS[a.type];
                    const isLast = index === (affaire.activites?.length || 0) - 1;
                    return (
                      <div key={a.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            a.type === 'APPEL' ? 'bg-blue-100 text-blue-600' :
                            a.type === 'EMAIL_ENVOYE' || a.type === 'EMAIL_RECU' ? 'bg-purple-100 text-purple-600' :
                            a.type === 'RDV' ? 'bg-amber-100 text-amber-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon size={20} />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-border mt-3" />}
                        </div>
                        <div className={`flex-1 ${isLast ? '' : 'pb-6'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  a.type === 'APPEL' ? 'bg-blue-100 text-blue-700' :
                                  a.type === 'EMAIL_ENVOYE' || a.type === 'EMAIL_RECU' ? 'bg-purple-100 text-purple-700' :
                                  a.type === 'RDV' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {ACTIVITY_LABELS[a.type]}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(a.createdAt).toLocaleString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="font-semibold text-base">{a.title}</p>
                              {a.content && (
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.content}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => confirm(t('affaireDetail.confirmDeleteActivity', { defaultValue: 'Supprimer cette activité ?' })) && deleteActivityMutation.mutate(a.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('activites.new', { defaultValue: 'Nouvelle activité' })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleActivitySubmit}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={activityForm.type} onValueChange={(v) =>
                  setActivityForm({
                    ...activityForm,
                    type: v as ActiviteType,
                    ...(v !== 'RDV' ? { scheduledStart: '' } : {}),
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTE">📝 Note</SelectItem>
                    <SelectItem value="APPEL">📞 Appel</SelectItem>
                    <SelectItem value="EMAIL_ENVOYE">📧 Email envoyé</SelectItem>
                    <SelectItem value="EMAIL_RECU">📬 Email reçu</SelectItem>
                    <SelectItem value="RDV">📅 Rendez-vous</SelectItem>
                    <SelectItem value="AUTRE">📌 Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  placeholder="ex: Appel avec le client"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={activityForm.content}
                  onChange={(e) => setActivityForm({ ...activityForm, content: e.target.value })}
                  placeholder="Détails de l'activité..."
                  rows={3}
                />
              </div>
              {activityForm.type === 'RDV' && (
                <div className="space-y-1.5">
                  <Label>Date et heure du rendez-vous</Label>
                  <Input
                    type="datetime-local"
                    value={activityForm.scheduledStart}
                    onChange={(e) => setActivityForm({ ...activityForm, scheduledStart: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si renseigné, une entrée est créée automatiquement sur la page Calendrier.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setActivityOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saveActivityMutation.isPending}>
                {saveActivityMutation.isPending ? t('organizations.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Template Selector Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('affaireDetail.sendTemplateEmail', { defaultValue: 'Envoyer email via template' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('affaireDetail.selectTemplate', { defaultValue: 'Sélectionner un template' })}</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder={t('affaireDetail.chooseTemplate', { defaultValue: 'Choisir un template...' })} /></SelectTrigger>
                <SelectContent>
                  {emailTemplates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" variant="outline" onClick={handlePreviewTemplate} disabled={!selectedTemplateId}>
              {t('emailTemplates.preview')}
            </Button>
            <Button type="button" onClick={handleSendTemplate} disabled={!selectedTemplateId || sendEmailMutation.isPending}>
              {sendEmailMutation.isPending ? t('affaireDetail.sending', { defaultValue: 'Envoi...' }) : t('affaireDetail.send', { defaultValue: 'Envoyer' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('emailTemplates.previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Sujet</p>
              <p className="font-medium">{previewData.subject}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Corps</p>
              <div className="p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap">{previewData.body}</div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>{t('emailTemplates.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
