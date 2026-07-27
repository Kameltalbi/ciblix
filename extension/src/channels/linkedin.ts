import type { ProspectProfile } from '../shared/types.js';

export interface ChannelPageContext {
  url: string;
  hostname: string;
  pathname: string;
}

export interface IChannel {
  readonly slug: 'LINKEDIN';
  readonly name: string;
  detect(ctx: ChannelPageContext): boolean;
  extractProfile(): ProspectProfile | null;
  insertMessage(content: string): boolean;
}

function text(el: Element | null | undefined): string | undefined {
  const t = el?.textContent?.trim();
  return t || undefined;
}

function queryText(selector: string): string | undefined {
  return text(document.querySelector(selector));
}

function extractSection(id: string): string[] {
  const section = document.getElementById(id)?.closest('section') || document.querySelector(`#${id}`);
  if (!section) return [];
  const items = section.parentElement?.querySelectorAll('li') || section.querySelectorAll('li');
  return Array.from(items)
    .slice(0, 6)
    .map((li) => li.textContent?.trim().slice(0, 400) || '')
    .filter(Boolean);
}

/** Extraction LinkedIn enrichie — toute la page pour l'intelligence contextuelle. */
export const linkedInChannel: IChannel = {
  slug: 'LINKEDIN',
  name: 'LinkedIn',

  detect(ctx) {
    return ctx.hostname.includes('linkedin.com');
  },

  extractProfile(): ProspectProfile | null {
    const fullName =
      queryText('h1.text-heading-xlarge') ||
      queryText('h1.inline.t-24') ||
      queryText('[data-anonymize="person-name"]');

    const headline =
      queryText('.text-body-medium.break-words') ||
      queryText('[data-anonymize="headline"]');

    const location = queryText('.text-body-small.inline.t-black--light.break-words');

    const about =
      document.querySelector('#about ~ .display-flex .inline-show-more-text, #about')?.textContent?.trim()?.slice(0, 2000) ||
      document.querySelector('section[data-section="summary"]')?.textContent?.trim()?.slice(0, 2000);

    const experienceEls = document.querySelectorAll(
      '#experience ~ .pvs-list__outer-container li, section[data-section="experience"] li, #experience li'
    );
    const experience = Array.from(experienceEls)
      .slice(0, 6)
      .map((li) => {
        const title = text(li.querySelector('.t-bold span[aria-hidden="true"], .mr1.hoverable-link-text span'));
        const company = text(li.querySelector('.t-14.t-normal span[aria-hidden="true"]'));
        const duration = text(li.querySelector('.pvs-entity__caption-wrapper, .t-14.t-normal.t-black--light'));
        return { title, company, duration, text: li.textContent?.trim().slice(0, 400) };
      })
      .filter((e) => e.title || e.company || e.text);

    const educationEls = document.querySelectorAll('#education li, section[data-section="education"] li');
    const education = Array.from(educationEls)
      .slice(0, 4)
      .map((li) => ({
        school: text(li.querySelector('.t-bold span[aria-hidden="true"]')),
        degree: text(li.querySelector('.t-14.t-normal span[aria-hidden="true"]')),
        text: li.textContent?.trim().slice(0, 300),
      }))
      .filter((e) => e.school || e.text);

    const skillEls = document.querySelectorAll('#skills li span[aria-hidden="true"], section[data-section="skills"] span[aria-hidden="true"]');
    const skills = Array.from(skillEls)
      .slice(0, 15)
      .map((el) => el.textContent?.trim())
      .filter((s): s is string => Boolean(s));

    const activityEls = document.querySelectorAll(
      '.feed-shared-update-v2, [data-urn*="activity"], .profile-creator-shared-feed-update__container'
    );
    const recentActivity = Array.from(activityEls)
      .slice(0, 5)
      .map((el) => el.textContent?.trim().slice(0, 500))
      .filter((s): s is string => Boolean(s));

    const publicationItems = extractSection('publications');

    let company: string | undefined;
    const expCompany = experience[0]?.company;
    company = expCompany || text(document.querySelector('[data-anonymize="company-name"]'));

    const companyDesc = text(document.querySelector('.org-top-card-summary__tagline, .org-about-module__margin-bottom'));

    const connectionText = document.body.innerText.match(/(\d[\d\s,.]*)\s+relations?/i);
    const connectionCount = connectionText
      ? parseInt(connectionText[1].replace(/\D/g, ''), 10)
      : undefined;

    const sizeMatch = document.body.innerText.match(/(\d[\d\s,.]*)\s+employés|(\d+)-(\d+)\s+employees/i);
    const companySize = sizeMatch ? sizeMatch[0] : undefined;

    if (!fullName && !headline) return null;

    const nameParts = fullName?.split(/\s+/) ?? [];
    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ') || undefined,
      fullName,
      company,
      jobTitle: headline,
      country: location,
      profileUrl: window.location.href.split('?')[0],
      headline,
      description: about,
      connectionCount: Number.isFinite(connectionCount) ? connectionCount : undefined,
      companySize,
      companyDescription: companyDesc,
      experience,
      education,
      skills,
      recentActivity,
      publications: publicationItems,
    };
  },

  insertMessage(content: string): boolean {
    const selectors = [
      '.msg-form__contenteditable',
      'div[role="textbox"][contenteditable="true"]',
      '.compose-form__message-field',
    ];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      el.focus();
      el.innerText = content;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: content }));
      return true;
    }
    return false;
  },
};
