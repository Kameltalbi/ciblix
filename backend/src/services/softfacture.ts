// Client pour l'API Softfacture
// Adapter les endpoints selon ton API réelle

interface CreerDocumentParams {
  clientNom:        string;
  clientEmail?:     string | null;
  clientMatricule?: string | null;
  designation:      string;
  montantHT:        number;
  tvaPct:           number;
  type:             string;
  devisId?:         string;
}

interface SoftfactureDocResult {
  id:      string;
  numero:  string;
  pdfUrl:  string;
  montantTTC: number;
}

class SoftfactureClient {
  private baseUrl: string;
  private apiKey:  string;

  constructor() {
    this.baseUrl = process.env.SOFTFACTURE_API_URL || '';
    this.apiKey  = process.env.SOFTFACTURE_API_KEY || '';
  }

  private headers() {
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Softfacture API non configurée (SOFTFACTURE_API_URL, SOFTFACTURE_API_KEY)');
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Softfacture ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async creerDevis(params: CreerDocumentParams): Promise<SoftfactureDocResult> {
    return this.request<SoftfactureDocResult>('/api/devis', {
      method: 'POST',
      body: JSON.stringify({
        client: {
          nom:       params.clientNom,
          email:     params.clientEmail,
          matricule: params.clientMatricule,
        },
        lignes: [{
          designation: params.designation,
          quantite:    1,
          prixHT:      params.montantHT,
          tvaPct:      params.tvaPct,
        }],
        type: params.type || 'Prestation de service',
      }),
    });
  }

  async creerFacture(params: CreerDocumentParams): Promise<SoftfactureDocResult> {
    return this.request<SoftfactureDocResult>('/api/factures', {
      method: 'POST',
      body: JSON.stringify({
        client: {
          nom:       params.clientNom,
          email:     params.clientEmail,
          matricule: params.clientMatricule,
        },
        lignes: [{
          designation: params.designation,
          quantite:    1,
          prixHT:      params.montantHT,
          tvaPct:      params.tvaPct,
        }],
        type:           params.type || 'Prestation de service',
        devisReferenceId: params.devisId,
      }),
    });
  }

  async getPdf(type: 'devis' | 'facture', id: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/api/${type}/${id}/pdf`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Softfacture PDF ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  status() {
    return {
      configured: this.isConfigured(),
      baseUrl: this.baseUrl || null,
      website: 'https://www.softfacture.com',
    };
  }
}

export const softfactureClient = new SoftfactureClient();
