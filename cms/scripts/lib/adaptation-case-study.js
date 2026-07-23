'use strict';
/**
 * Pure mapping of the legacy `adaptation` Strapi single type (downloaded from the
 * original instance into adaptation-source.json) into a `case-study-dynamic` data
 * payload. The old site exposed adaptation as a root page; the new site models it
 * as one more case study, so its five title/text blocks become five `section`
 * components in the MainContent dynamic zone.
 *
 * No I/O — unit tested in adaptation-case-study.test.js. The runner
 * (create-adaptation-case-study.js) adds the locale, publishedAt and the Project
 * relation before handing the payload to entityService.
 */

// The original page linked to itself and to sibling case studies using the old
// route + domain. Rewrite those onto the new site's structure:
//   - old absolute domain          -> relative path (same-site pages)
//   - /adaptation/<city>           -> /case-studies/<city>   (sibling case studies)
//   - /adaptation#<anchor>         -> #<anchor>              (same-page anchors)
//   - the publications anchor       -> the new section's kebab-cased heading id
// Genuinely external links (EEA, ResearchGate), local assets (/documents, the
// Cloudinary images) and everything else are left untouched.
const OLD_DOMAIN = 'https://climate-risk-dashboard.climateanalytics.org';

function rewriteLinks(text) {
  if (!text) return '';
  return text
    .split(OLD_DOMAIN)
    .join('')
    .split('/adaptation#')
    .join('#')
    .split('/adaptation/')
    .join('/case-studies/')
    .split('](/adaptation)')
    .join('](/case-studies)')
    // The old #provide-publications-on-adaptation anchor targeted the publications
    // block; its heading is now "Relevant PROVIDE publications" (kebab id below).
    .split('#provide-publications-on-adaptation')
    .join('#relevant-provide-publications');
}

// Render the linked Publications relation as a simple markdown bullet list, in
// source order. The case-study-dynamic model has no publications relation, so the
// list lives in the section body as richtext.
function buildPublicationsMarkdown(publications) {
  if (!publications || !publications.length) return '';
  return publications.map((p) => `- [${(p.Name ?? '').trim()}](${p.Url})`).join('\n');
}

const DEFAULT_SLUG = 'adaptation';
const DEFAULT_TITLE = 'Climate risk dashboard for adaptation support';
// The source IntroTitle equals DEFAULT_TITLE; retitling the first section avoids a
// duplicate H1/H2 and matches the intended section label already in src/config.js
// (LABEL_ADAPTATION_PLANNING).
const INTRO_SECTION_TITLE = 'Using the climate risk dashboard for adaptation planning';

// Accepts either the full API JSON ({ data: { attributes } }) or the bare
// attributes object.
function buildAdaptationCaseStudy(source, opts = {}) {
  const a = source && source.data ? source.data.attributes : source;
  const { slug = DEFAULT_SLUG, title = DEFAULT_TITLE } = opts;

  const section = (Title, Text) => ({ __component: 'section.section', Title, Text });

  return {
    CityUid: slug,
    Title: title,
    Abstract: a.Description,
    PublicationDate: (a.updatedAt ?? '').slice(0, 10) || null,
    MainContent: [
      section(INTRO_SECTION_TITLE, rewriteLinks(a.IntroText)),
      section(a.SelfAssessmentTitle, rewriteLinks(a.SelfAssessmentText)),
      section(a.IntegrationTitle, rewriteLinks(a.IntegrationText)),
      section(a.PublicationsTitle, buildPublicationsMarkdown(a.Publications)),
      section(a.OutroTitle, rewriteLinks(a.OutroText)),
    ],
  };
}

module.exports = {
  rewriteLinks,
  buildPublicationsMarkdown,
  buildAdaptationCaseStudy,
  DEFAULT_SLUG,
  DEFAULT_TITLE,
  INTRO_SECTION_TITLE,
};
