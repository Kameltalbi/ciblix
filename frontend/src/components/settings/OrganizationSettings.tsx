import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { resolveOrganizationLogoUrl } from '@/lib/organizationLogo';
import { useOrganizationLogoSrc } from '@/hooks/useOrganizationLogoSrc';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Organization } from '@/types';
import { CopilotOrgSettings } from '@/components/settings/CopilotOrgSettings';

export function OrganizationSettings() {
  const qc = useQueryClient();
  const { data: organizationData } = useQuery<Organization | Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });

  const org = Array.isArray(organizationData) ? organizationData[0] : organizationData;

  const [name, setName] = useState(org?.name || '');
  const [email, setEmail] = useState(org?.email || '');
  const [phone, setPhone] = useState(org?.phone || '');
  const [address, setAddress] = useState(org?.address || '');
  const [tva, setTva] = useState(org?.tva || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(resolveOrganizationLogoUrl(org?.logoUrl));
  const serverLogoSrc = useOrganizationLogoSrc(!logoFile ? org?.logoUrl : null);

  useEffect(() => {
    if (!org) return;
    setName(org.name || '');
    setEmail(org.email || '');
    setPhone(org.phone || '');
    setAddress(org.address || '');
    setTva(org.tva || '');
    setLogoPreview(resolveOrganizationLogoUrl(org.logoUrl));
    setLogoFile(null);
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!org?.id) {
        throw new Error("Organisation introuvable");
      }
      await api.put(`/organizations/${org.id}`, data);
      let savedLogoUrl: string | null = null;
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const logoResponse = await api.post(`/organizations/${org.id}/logo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        savedLogoUrl = logoResponse.data?.logoUrl || null;
      }
      return { savedLogoUrl };
    },
    onSuccess: (result) => {
      if (result?.savedLogoUrl) {
        setLogoPreview(resolveOrganizationLogoUrl(result.savedLogoUrl));
      }
      qc.invalidateQueries({ queryKey: ['organizations'] });
      setLogoFile(null);
      alert('Organisation mise à jour avec succès');
    },
    onError: (error: any) => {
      alert(`Erreur lors de l'enregistrement: ${error?.response?.data?.error || error?.message || 'Erreur inconnue'}`);
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
    if (!org?.id) {
      alert("Organisation introuvable");
      return;
    }
    if (!name.trim()) {
      alert("Le nom de l'organisation est obligatoire");
      return;
    }
    updateMutation.mutate({ name, email, phone, address, tva });
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Informations de l'organisation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom de l'organisation *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: ktOptima"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email de contact</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@ktoptima.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+216 55 053 505"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Adresse</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Tunis, Tunisie"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tva">Matricule fiscal</Label>
          <Input
            id="tva"
            value={tva}
            onChange={(e) => setTva(e.target.value)}
            placeholder="1234567/A/M/000"
          />
        </div>

        <div className="border-t pt-4">
          <Label htmlFor="logo">Logo</Label>
          <div className="flex items-center gap-4 mt-2">
            {(logoFile ? logoPreview : serverLogoSrc || logoPreview) && (
              <img
                src={logoFile ? logoPreview : serverLogoSrc || logoPreview}
                alt="Logo"
                className="h-16 w-auto"
              />
            )}
            <input
              id="logo"
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={updateMutation.isPending || !org?.id}>
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </CardContent>
    </Card>
    <CopilotOrgSettings />
    </div>
  );
}
