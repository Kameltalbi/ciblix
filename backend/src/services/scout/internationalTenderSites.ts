/**
 * Portails AO internationaux + pages LinkedIn d'institutions à surveiller.
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
  kind?: 'portal' | 'linkedin';
  /** Pour LinkedIn : /company/slug */
  pathPrefix?: string;
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
    kind: 'portal',
  },
  {
    id: 'undp',
    label: 'UNDP — Procurement / notices',
    shortLabel: 'UNDP',
    url: 'https://www.undp.org/procurement',
    domain: 'undp.org',
    queryHint: 'site:undp.org procurement OR tender OR RFP OR ITB',
    org: 'ONU',
    kind: 'portal',
  },
  {
    id: 'unido',
    label: 'UNIDO — Procurement opportunities',
    shortLabel: 'UNIDO',
    url: 'https://www.unido.org/get-involved/procurement/procurement-opportunities',
    domain: 'unido.org',
    queryHint: 'site:unido.org procurement OR tender OR "expression of interest"',
    org: 'ONU',
    kind: 'portal',
  },
  {
    id: 'unops',
    label: 'UNOPS — Procurement',
    shortLabel: 'UNOPS',
    url: 'https://www.unops.org/business-opportunities',
    domain: 'unops.org',
    queryHint: 'site:unops.org "business opportunities" OR procurement OR tender',
    org: 'ONU',
    kind: 'portal',
  },
  {
    id: 'unicef',
    label: 'UNICEF Supply',
    shortLabel: 'UNICEF',
    url: 'https://www.unicef.org/supply/opportunities',
    domain: 'unicef.org',
    queryHint: 'site:unicef.org supply OR tender OR RFP OR procurement',
    org: 'ONU',
    kind: 'portal',
  },
  {
    id: 'worldbank',
    label: 'World Bank — Corporate procurement',
    shortLabel: 'World Bank',
    url: 'https://www.worldbank.org/en/about/corporate-procurement',
    domain: 'worldbank.org',
    queryHint: 'site:worldbank.org procurement OR tender OR RFP',
    org: 'Banque',
    kind: 'portal',
  },
  {
    id: 'afdb',
    label: 'African Development Bank',
    shortLabel: 'AfDB',
    url: 'https://www.afdb.org/en/about-us/corporate-procurement',
    domain: 'afdb.org',
    queryHint: 'site:afdb.org procurement OR tender OR "expression of interest"',
    org: 'Banque',
    kind: 'portal',
  },
  {
    id: 'ted',
    label: 'TED — Tenders Electronic Daily (UE)',
    shortLabel: 'TED Europa',
    url: 'https://ted.europa.eu',
    domain: 'ted.europa.eu',
    queryHint: 'site:ted.europa.eu',
    org: 'UE',
    kind: 'portal',
  },
  {
    id: 'dgmarket',
    label: 'dgMarket — International tenders',
    shortLabel: 'dgMarket',
    url: 'https://www.dgmarket.com',
    domain: 'dgmarket.com',
    queryHint: 'site:dgmarket.com',
    org: 'Agrégateur',
    kind: 'portal',
  },
  // ── Pages LinkedIn institutions (annonces AO / procurement) ──
  {
    id: 'li-undp',
    label: 'LinkedIn — UNDP',
    shortLabel: 'LI · UNDP',
    url: 'https://www.linkedin.com/company/undp',
    domain: 'linkedin.com',
    pathPrefix: '/company/undp',
    queryHint: 'site:linkedin.com/company/undp (tender OR procurement OR RFP OR "call for" OR "invitation to bid" OR "appel d\'offres")',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-unido',
    label: 'LinkedIn — UNIDO',
    shortLabel: 'LI · UNIDO',
    url: 'https://www.linkedin.com/company/unido',
    domain: 'linkedin.com',
    pathPrefix: '/company/unido',
    queryHint: 'site:linkedin.com/company/unido (tender OR procurement OR RFP OR "call for" OR "expression of interest")',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-ungm',
    label: 'LinkedIn — UNGM',
    shortLabel: 'LI · UNGM',
    url: 'https://www.linkedin.com/company/ungm',
    domain: 'linkedin.com',
    pathPrefix: '/company/ungm',
    queryHint: 'site:linkedin.com/company/ungm (tender OR procurement OR RFP OR notice)',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-unops',
    label: 'LinkedIn — UNOPS',
    shortLabel: 'LI · UNOPS',
    url: 'https://www.linkedin.com/company/unops',
    domain: 'linkedin.com',
    pathPrefix: '/company/unops',
    queryHint: 'site:linkedin.com/company/unops (tender OR procurement OR "business opportunities" OR RFP)',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-unicef',
    label: 'LinkedIn — UNICEF',
    shortLabel: 'LI · UNICEF',
    url: 'https://www.linkedin.com/company/unicef',
    domain: 'linkedin.com',
    pathPrefix: '/company/unicef',
    queryHint: 'site:linkedin.com/company/unicef (tender OR procurement OR RFP OR supply)',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-worldbank',
    label: 'LinkedIn — World Bank',
    shortLabel: 'LI · World Bank',
    url: 'https://www.linkedin.com/company/the-world-bank',
    domain: 'linkedin.com',
    pathPrefix: '/company/the-world-bank',
    queryHint: 'site:linkedin.com/company/the-world-bank (tender OR procurement OR RFP OR "request for")',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
  {
    id: 'li-afdb',
    label: 'LinkedIn — African Development Bank',
    shortLabel: 'LI · AfDB',
    url: 'https://www.linkedin.com/company/african-development-bank',
    domain: 'linkedin.com',
    pathPrefix: '/company/african-development-bank',
    queryHint: 'site:linkedin.com/company/african-development-bank (tender OR procurement OR RFP OR EOI)',
    org: 'LinkedIn',
    kind: 'linkedin',
  },
];

function linkedInCompanyPreset(url: URL): WatchSitePreset | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!host.includes('linkedin.com')) return null;
  const m = url.pathname.match(/\/company\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  const pathPrefix = `/company/${slug}`;
  const id = `li-custom-${slug}`;
  return {
    id,
    label: `LinkedIn — ${slug}`,
    shortLabel: `LI · ${slug}`,
    url: `https://www.linkedin.com${pathPrefix}`,
    domain: 'linkedin.com',
    pathPrefix,
    queryHint: `site:linkedin.com${pathPrefix} (tender OR procurement OR RFP OR "appel d'offres" OR "call for" OR EOI)`,
    org: 'LinkedIn',
    kind: 'linkedin',
  };
}

export function resolveWatchSites(idsOrUrls: string[]): WatchSitePreset[] {
  const out: WatchSitePreset[] = [];
  const seen = new Set<string>();
  for (const raw of idsOrUrls) {
    const v = String(raw || '').trim();
    if (!v) continue;

    const preset = INTERNATIONAL_TENDER_SITES.find(
      (s) => s.id === v || s.url === v || (s.pathPrefix && v.includes(s.pathPrefix)),
    );
    if (preset) {
      if (!seen.has(preset.id)) {
        seen.add(preset.id);
        out.push(preset);
      }
      continue;
    }

    try {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`);
      const li = linkedInCompanyPreset(u);
      if (li) {
        if (!seen.has(li.id)) {
          seen.add(li.id);
          out.push(li);
        }
        continue;
      }
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
        kind: 'portal',
      });
    } catch {
      /* ignore invalid */
    }
  }
  return out;
}

/** true si l'URL appartient à un site / page LinkedIn surveillé. */
export function isWatchedHost(host: string, watchSites: WatchSitePreset[], fullUrl = ''): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  const href = fullUrl.toLowerCase();
  return watchSites.some((s) => {
    if (s.kind === 'linkedin' && s.pathPrefix) {
      return h.includes('linkedin.com') && (href.includes(s.pathPrefix) || href.includes(s.pathPrefix.replace(/\//g, '%2F')));
    }
    return h === s.domain || h.endsWith(`.${s.domain}`);
  });
}
