# Embedding interactive charts in case studies

## Overview

Case studies show a live, interactive chart with the **Live Chart** block: paste a chart's embed link and the chart loads inside the page. Editors build a case study from five Strapi content blocks; three of them show charts.

This guide is for case-study editors working in the PROVIDE CMS (Strapi 5).

| Block | What the reader sees | Interactive? |
| --- | --- | --- |
| Live Chart | An explorer or EU Scoreboard chart with live data | Yes: hover, legends and the chart's own menus |
| Future Impacts | Chart images over time and a map image, with indicator and year dropdowns | Partly: dropdowns switch between uploaded images |
| Avoiding Impacts | A probability table built from live data for the case study's city | Yes: indicator and study-location dropdowns |
| Image Slider | Before/after image pairs | Slider only |
| Section | A heading and rich text | No |

Every chart block can also carry a "View in explorer" button. It opens the full interactive chart in the explorer with the same selection.

## Before you start

You need an editor account on the CMS and these values for each chart:

- **Embed link (Live Chart only).** Set up the chart in the explorer or EU Scoreboard, open its chart menu and click **Copy embed link**.
- **Indicator ID and instance (Future Impacts and Avoiding Impacts).** Both must match an indicator in the catalog exactly. Copy them from the explorer page URL (`indicator=` and `instance=`).
- **Chart images (Future Impacts only).** One PNG per indicator for the change-over-time chart, and one map PNG per indicator and year. Use the explorer's "Download graph" button to export them.
- **Explorer link (optional).** A path starting with `/impacts/explore` or `/impacts/avoid`, copied from the explorer address bar. Drop the domain, so `https://…/impacts/explore?indicator=…` becomes `/impacts/explore?indicator=…`.
- **The case study's slug.** It must match a city in the geography list. Avoiding Impacts loads its data for that city.

## Add a chart to a case study

1. In the CMS, open **Content Manager → Case Study Dynamic** and pick the case study. Check the locale switcher is on the language you are editing (en-EU).
2. In **MainContent**, click **Add a component** and choose **LiveChart**, **FutureImpacts** or **AvoidingImpacts**. Drag it to where it should appear; blocks show in list order.
3. Fill in the fields from the next section. For LiveChart, paste the copied link into **EmbedUrl**.
4. Paste an explorer path into **ExplorerUrl** to show the "View in explorer" button.
5. Click **Save**. This saves a draft; the live site is unchanged.
6. Click **Publish**. Then open the case study at `/case-studies/<slug>` and check the chart loads and every dropdown works.

A block that the site cannot match to the catalog is hidden without an error. If a chart is missing after publishing, see [Troubleshooting](#troubleshooting).

## Block fields

### Live Chart

Loads a live chart from an embed link. The frame resizes to fit the chart.

| Field | Required | What to enter |
| --- | --- | --- |
| EmbedUrl | Yes | The link from **Copy embed link**. A link from any PROVIDE site works; the chart always loads from the site showing the case study |
| Title | Optional | Heading above the chart |
| Description | Optional | Caption under the chart; Markdown is allowed |
| ExplorerUrl | Optional | `/impacts/explore?…` path for the button |

A link that is not a PROVIDE embed link hides the block.

### Future Impacts

Shows one change-over-time image and one map image. Add several snapshots to get dropdowns: one per indicator, and one per year for maps.

| Field | Required | What to enter |
| --- | --- | --- |
| ImpactTimeSnapshot → Indicator, Instance | Yes | Indicator ID and data source for the time chart |
| ImpactTimeSnapshot → Image | Yes, in practice | The exported time-chart PNG |
| ImpactGeoSnapshot → Indicator, Instance | Yes | Same indicator as a time snapshot |
| ImpactGeoSnapshot → Year | Optional | The map year, such as 2050; one snapshot per year |
| ImpactGeoSnapshot → Image | Yes, in practice | The exported map PNG |
| ImpactTimeDescription, ImpactGeoDescription | Optional | Caption under each image |
| ExplorerUrl | Optional | `/impacts/explore?…` path for the button |

The block needs at least one time snapshot and one map snapshot that match the catalog. Otherwise the site hides it.

### Avoiding Impacts

Builds a table from live data: for each scenario and likelihood, the year an impact level is reached.

| Field | Required | What to enter |
| --- | --- | --- |
| Title, Description | Optional | Heading and caption |
| Indicators → Uid, Instance | Yes | One row per indicator; more than one adds a dropdown |
| StudyLocations → Uid | Optional | Study-location IDs; more than one adds a dropdown |
| ExplorerUrl | Optional | `/impacts/avoid?…` path for the button |

Scenarios and likelihoods come from site configuration, not the CMS.

## Embed links

Every embed link points at a stand-alone chart page, `/embed/<chart>`. The Live Chart block accepts these four:

| Embed path | Chart | Main query parameters |
| --- | --- | --- |
| `/embed/impact-time` | Impact over time | `indicator`, `instance`, `geography`, `scenarios`, `timeframe` |
| `/embed/impact-geo` | Impact map | the above plus `year` |
| `/embed/unavoidable-risk` | Unavoidable risk by warming level | the above plus `threshold` |
| `/embed/eu-scoreboard-chart` | EU Scoreboard chart | `chart` (JSON definition), `scenario`, `region`, `year` |

Add `static=true` to hide the controls. The scoreboard embed is documented in the [EU scoreboard chart reference](eu-scoreboard-chart-config.md#embed-a-chart).

Prefer **Copy embed link** over writing links by hand. It fills in labels and units; a hand-written link without `unit` shows "undefined" on the axis.

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Live Chart block missing | EmbedUrl is not a PROVIDE `/embed/` link for one of the four charts | Copy the link again with **Copy embed link** |
| Live chart says "The chart URL is incomplete" | The link lost required settings, such as indicator, geography or scenarios | Copy the link again from the chart menu |
| Future Impacts block missing | No time snapshot or no map snapshot matches the catalog | Check each Indicator and Instance against the explorer URL, character for character |
| "View in explorer" button missing | ExplorerUrl has a domain, a different path, or an unknown indicator | Use a path starting `/impacts/explore` or `/impacts/avoid` |
| Avoiding Impacts shows only text | No data for this indicator in the case study's city | Check the case study slug matches the city; try another indicator |
| Page shows "temporarily unavailable" | The indicator catalog failed to load | Wait and reload; tell the dev team if it persists |
| Edits not on the live site | Saved as draft only | Click Publish |
| A scoreboard chart's case-study link stopped working | It uses an old numeric ID | Set `caseStudyId` to the case study's `documentId` from the CMS |

## Release

The Live Chart block adds a CMS schema change. Release the CMS and website together; the website reads the new block from the CMS.
