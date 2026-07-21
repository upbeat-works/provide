# Updating the site's content with Strapi

This is a guide for editing the text and case studies on the site. No coding needed.

## What Strapi is

Strapi is the admin tool where the site's written content lives — page text, case studies, the glossary, and so on. It's separate from the interactive climate charts and maps, which pull their numbers from a different system.

## Logging in

Go to **https://provide-cms.fly.dev/admin** and sign in.

The CMS "sleeps" when nobody's used it for a while, so the very first page load after a quiet period can take 10–20 seconds. That's normal — just wait for it.

If you don't have a login yet, ask a developer on the project to create one for you.

## Finding what you want to edit

Once you're in, click **Content Manager** in the left-hand menu. You'll see a list of content types. Here's what each one is, in plain terms:

| What you'll see in Strapi | What it changes on the site |
|---|---|
| **About** | The `/about` page |
| **Contact** | The `/contact` page |
| **Case Study** | Every case study — shown on the homepage, the case studies list, and each case study's own page |
| **Issue** | The `/issues` page |
| **Methodology - Impact** | The "Impact" tab on the Methodology page |
| **Methodology - Models** | The "Models" tab on the Methodology page |
| **Methodology - Data processing** | The "Data processing" tab on the Methodology page |
| **Glossary** | The list of defined terms on the Methodology → Key Terms page |
| **Scenario Preset** | The scenario cards on the Methodology → Key Terms page |
| **Scenario** | The descriptive text shown for each climate scenario (not the numbers — just the explanatory text) |
| **Indicator** | The descriptive text shown for each indicator (again, text only, not the numbers) |
| **Topic**, **Geography**, **Project** | Labels/tags attached to case studies |
| **Scenario (Simplified)** | The short scenario tags shown on case studies |

A few things you'll see in that list **don't actually appear anywhere on the site** — editing them won't do anything visible. Skip these: **FAQ**, **Disclaimer**, **Technical Documentation**, **Methodology** (the plain one, not one of the "Methodology - ..." items above), and **Methodology - Key terms**. If you're trying to edit something and it doesn't seem to correspond to any of these, ask a developer before spending time on it.

## Making an edit

1. Click the content type in the sidebar (e.g. **About**).
2. For a single page (About, Contact, Issue, the Methodology tabs), you'll go straight to the editor. For a list (Case Study, Glossary, etc.), click into the specific entry you want to change first.
3. Edit the fields you need. Most are plain text or rich-text boxes — click in and type.
4. **Save.** This saves your draft but does **not** put it live yet.
5. **Publish.** This is the button that actually marks your change as ready to go out. Look for a **Publish** button (usually top-right); an unpublished/edited entry is usually flagged in the list view too (e.g. "Modified" or "Draft").

Both Save and Publish are per-entry — if you edit ten case studies, you need to publish each one.

## Content type by content type

Field types you'll see: **Plain text** (one line), **Long text** (multiple lines, no formatting), **Rich text** (a formatting toolbar — bold, links, headings, lists), **Picture** (upload via the Media Library), **Link to another item** (pick an existing entry from a dropdown, doesn't create new text), and **List** (a repeatable block you can add/remove/reorder copies of — click "+ Add an entry" to add one).

### About

One page, one field:

- **Section** (List of Title + Text) — each entry is one block on the About page: a **Title** (plain text) and a **Text** (rich text). Add an entry for a new section, reorder them to reorder the page, delete one to remove a section.

### Contact

One page, three rich-text fields, each its own block of the Contact page: **Contact**, **Imprint**, **Enquiries**.

### Issue

One page, one field — **Issues**, a List of Title (plain text) + Description (rich text). Same add/reorder/delete pattern as About's sections.

### Methodology - Impact / Models / Data processing

These three each drive one tab on the Methodology page and share the same shape: a list of **Sections**.

- **Models** and **Data processing** use plain sections — **Title** (plain text) + **Text** (rich text) each.
- **Impact** sections have two extra fields, **Impact** and **Category** (both plain text) — the page groups and sub-headers sections by these two values, so entries that should appear together need matching Impact/Category text (exact spelling — this isn't a dropdown, it's free text, so a typo creates a stray group instead of joining the intended one).

### Glossary

One entry per term. Fields: **Title** (the term), **Abbreviation**, **Category** (which section it's grouped under on the Key Terms page), **Description** (rich text), **Link** (an optional URL, plain text), and **UID**. Leave **UID** alone unless a developer asks you to change it — it's an internal identifier, not shown to visitors.

### Scenario Preset

One entry per preset card on the Key Terms page. Fields: **Title**, **Description** (long text), **Timeframe** (a dropdown — T2100 or T2300), and **scenarios** (link to other items — pick which **Scenario** entries this preset groups together).

### Scenario

One entry per climate scenario. Fields: **Description** (long text) and **ScenarioCharacteristics** (a List of Year + Description pairs — the little "at this year, X happens" blurbs). There's also a **UID** field — this has to exactly match the scenario's id in the climate-data system, so don't change it unless a developer asks; typing the wrong thing here silently disconnects this text from its scenario rather than showing an error.

### Indicator

One entry per indicator. Just **Description** (long text) plus the same kind of **UID** field as Scenario — same rule: don't touch it unless told to.

### Topic / Geography / Project

Simple label entries used as tags on case studies — **Title** (the label text people see) and **UID** (internal id, leave it alone). Editing the Title here changes the tag text everywhere that tag is used, across every case study it's attached to.

### Scenario (Simplified)

Similar to the above — **Label** (the short tag text shown on case studies) and **UID** (leave alone).

### Case Study

The most involved content type. Top-level fields:

- **Title**, **Abstract** (long text), **Authors** (plain text), **CoverImage** (picture), **PublicationDate**.
- **Topics**, **Project**, **Geography**, **Scenarios** — links to other items. These don't hold text directly; you're picking existing **Topic** / **Project** / **Geography** / **Scenario (Simplified)** entries to tag this case study with. If the tag you want doesn't exist yet, create it in that content type first, then come back and select it here.
- **MainContent** — a List where each entry is one of four block types, and you choose the type when you add a block. This is what actually builds the body of the case study page, top to bottom, in the order you arrange them:
  - **Section** — a plain **Title** + **Text** (rich text) block, same as elsewhere.
  - **AvoidingImpacts** — **Title**, **Description** (rich text), **ExplorerUrl** (a link into the interactive explorer tool), plus lists of **Indicators** and **StudyLocations**, each of which is just a **Uid** field that must match an id from the climate-data system exactly — get this from a developer if you're not sure of the right value, since a wrong id just fails to show data rather than erroring visibly.
  - **FutureImpacts** — **ImpactTimeDescription** and **ImpactGeoDescription** (rich text), **ExplorerUrl**, plus two picture galleries: **ImpactTimeSnapshot** (Indicator name + an image/video) and **ImpactGeoSnapshot** (Indicator name + Year + an image) — these are literally uploaded picture snapshots, not live charts.
  - **ImageSlider** — a before/after image comparison. **AttributeLabel** and **GroupingLabel** (plain text, used for labeling/grouping), **ExplorerUrl**, two toggles (**ShowThumbnails**, **AllowImageSelection**), and a list of **ImageSliderPair**s, each with **Image1** (required), **Image2** (optional), plus **AttributeValue**, **GroupValue**, and **Description** (all plain text) to label that pair.

  Within MainContent you can add as many blocks of any type as you like, in any order, and drag to reorder them — that ordering is exactly the reading order visitors see on the page.

## Images

Images are uploaded through Strapi's Media Library (the picture-frame icon in the left sidebar, or an "add image" button directly on a field). Upload the file there and attach it to the entry — no need to host it anywhere else first.

## Getting help

If a content type doesn't match anything you can find on the site, or a change you published isn't showing up, ask a developer — there may be a genuine bug rather than something you're doing wrong (one is already known: the case study "outro" text field currently can't be made to show up anywhere, regardless of what you enter).
