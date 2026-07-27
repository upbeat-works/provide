import { parse } from 'marked';

// The landing page's "Learn about the Climate Risk Dashboard project" block is
// editorial content, so it lives in Strapi (`landing-project`) rather than in
// the markup. The block is two fixed cards — an intro and a list of what the
// dashboard combines — so the entry names them rather than holding a list.
// This maps that entry onto the props SectionProject renders.
//
// Returns `null` whenever there is nothing to show (entry absent/unpublished, or
// the CMS was unreachable and the loader degraded to null), and the section
// renders nothing rather than an empty card grid.
export function toProjectSection(entry) {
  const attributes = entry?.attributes ?? entry;
  if (!attributes) return null;

  const intro = toCard(attributes.Intro);
  const highlights = toCard(attributes.Highlights);
  if (!intro && !highlights) return null;

  // The heading is a long-text field: its line breaks are the editor's, so the
  // two-line balance survives without a hardcoded <br>.
  const titleLines = (attributes.Title ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return { titleLines, intro, highlights };
}

function toCard(card) {
  if (!card) return null;

  const text = parse(card.Text || '');
  // Only the Highlights card declares Items; the intro card has none by design.
  const items = (card.Items ?? [])
    .filter((item) => item.Title || item.Description)
    .map((item) => ({ title: item.Title, description: item.Description }));

  if (!text && !items.length) return null;

  return {
    text,
    items,
    // A link needs both halves to be usable; an editor filling in only one is
    // a half-finished edit, not a link.
    link: card.LinkLabel && card.LinkUrl ? { label: card.LinkLabel, url: card.LinkUrl } : null,
  };
}
