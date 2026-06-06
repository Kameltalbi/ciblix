export function markdownToBasicHtml(md: string): string {
  return md
    .split(/\n\n+/)
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (t.startsWith('### ')) return `<h3>${escapeHtml(t.slice(4))}</h3>`;
      if (t.startsWith('## ')) return `<h2>${escapeHtml(t.slice(3))}</h2>`;
      if (t.startsWith('# ')) return `<h1>${escapeHtml(t.slice(2))}</h1>`;
      if (t.startsWith('- ')) {
        const items = t.split('\n').map((l) => `<li>${escapeHtml(l.replace(/^- /, ''))}</li>`);
        return `<ul>${items.join('')}</ul>`;
      }
      return `<p>${escapeHtml(t).replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
