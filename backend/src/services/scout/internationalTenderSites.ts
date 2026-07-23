/**
 * Portails d'appels d'offres internationaux à surveiller (ONU, banques de développement…).
 */

export type WatchSitePreset = {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
  domain: string;
  /** Fragment de requête Google/CSE */
  queryHint: string;
  org: string;
};

export const INTERNATIONAL_TENDER_SITES: WatchSitePreset[] = [
  {
    id: 'ungm',
    label: 'UNGM — United Nations Global Marketplace',
    shortLabel: 'UNGM',
    url: 'https://www.ungm.org/Public/Notice',
    domain: 'ungm.org',
    queryHint: 'site:ungm.org tender OR procurement OR "invitation to bid"',
    org: 'ONU',
  },
  {
    id: 'undp',
    label: 'UNDP — Procurement / notices',
    shortLabel: 'UNDP',
    url: 'https://www.undp.org/procurement',
    domain: 'undp.org',
    queryHint: 'site:undp.org procurement OR tender OR RFP OR ITB',
    org: 'ONU',
  },
  {
    id: 'unido',
    label: 'UNIDO — Procurement opportunities',
    shortLabel: 'UNIDO',
    url: 'https://www.unido.org/get-involved/procurement/procurement-opportunities',
    domain: 'unido.org',
    queryHint: 'site:unido.org procurement OR tender OR "expression of interest"',
    org: 'ONU',
  },
  {
    id: 'unops',
    label: 'UNOPS — Procurement',
    shortLabel: 'UNOPS',
    url: 'https://www.unops.org/business-opportunities',
    domain: 'unops.org',
    queryHint: 'site:unops.org "business opportunities" OR procurement OR tender',
    org: 'ONU',
  },
  {
    id: 'unicef',
    label: 'UNICEF Supply',
    shortLabel: 'UNICEF',
    url: 'https://www.unicef.org/supply/opportunities',
    domain: 'unicef.org',
    queryHint: 'site:unicef.org supply OR tender OR RFP OR procurement',
    org: 'ONU',
  },
  {
    id: 'worldbank',
    label: 'World Bank — Corporate procurement',
    shortLabel: 'World Bank',
    url: 'https://www.worldbank.org/en/about/corporate-procurement',
    domain: 'worldbank.org',
    queryHint: 'site:worldbank.org procurement OR tender OR RFP',
    org: 'Banque',
  },
  {
    id: 'afdb',
    label: 'African Development Bank',
    shortLabel: 'AfDB',
    url: 'https://www.afdb.org/en/about-us/corporate-procurement',
    domain: 'afdb.org',
    queryHint: 'site:afdb.org procurement OR tender OR "expression of interest"',
    org: 'Banque',
  },
  {
    id: 'ted',
    label: 'TED — Tenders Electronic Daily (UE)',
    shortLabel: 'TED Europa',
    url: 'https://ted.europa.eu',
    domain: 'ted.europa.eu',
    queryHint: 'site:ted.europa.eu',
    org: 'UE',
  },
  {
    id: 'dgmarket',
    label: 'dgMarket — International tenders',
    shortLabel: 'dgMarket',
    url: 'https://www.dgmarket.com',
    domain: 'dgmarket.com',
    queryHint: 'site:dgmarket.com',
    org: 'Agrégateur',
  },
];

export function resolveWatchSites(idsOrUrls: string[]): WatchSitePreset[] {
  const out: WatchSitePreset[] = [];
  const seen = new Set<string>();
  for (const raw of idsOrUrls) {
    const v = String(raw || '').trim();
    if (!v) continue;
    const preset = INTERNATIONAL_TENDER_SITES.find(
      (s) => s.id === v || s.domain === v || v.includes(s.domain),
    );
    if (preset) {
      if (!seen.has(preset.id)) {
        seen.add(preset.id);
        out.push(preset);
      }
      continue;
    }
    // URL custom
    try {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`);
      const domain = u.hostname.replace(/^www\./, '');
      if (seen.has(domain)) continue;
      seen.add(domain);
      out.push({
        id: domain,
        label: domain,
        shortLabel: domain,
        url: u.toString(),
        domain,
        queryHint: `site:${domain}`,
        org: 'Custom',
      });
    } catch {
      /* ignore invalid */
    }
  }
  return out;
}

export function isWatchedHost(host: string, watchSites: WatchSitePreset[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  return watchSites.some((s) => h === s.domain || h.endsWith(`.${s.domain}`));
}
