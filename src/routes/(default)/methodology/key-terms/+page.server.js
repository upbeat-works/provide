import { loadFromStrapi, loadMethodologyScenarios } from '$utils/apis.js';
import { generatePageTitle } from '$utils/meta.js';
import { groupBy, kebabCase } from 'lodash-es';
import { parse } from 'marked';
import { LABEL_KEY_CONCEPTS, KEY_SCENARIOPRESET_UID } from '$config';

const selectableTimeframes = [
  { uid: 2100, label: '2100' },
  { uid: 2300, label: '2300' },
];

async function loadScenarios(fetch) {
  const [technicalScenarios, contentRows] = await Promise.all([loadMethodologyScenarios(fetch), loadFromStrapi('scenarios', fetch, 'fields[0]=UID&fields[1]=Description').catch(() => [])]);
  const descriptions = new Map();
  for (const row of contentRows ?? []) {
    const uid = row?.attributes?.UID;
    if (typeof uid !== 'string') continue;
    descriptions.set(uid.toLowerCase(), row.attributes.Description);
  }
  return technicalScenarios.map((scenario) => {
    const description = descriptions.get(String(scenario.uid).toLowerCase());
    if (!description) return scenario;
    return { ...scenario, description };
  });
}

function filterUniqueObjects(value, index, array) {
  return array.indexOf(value) === index;
}

function processScenarioPresets(list) {
  return list.map((preset) => {
    const { Description, scenarios, Timeframe, Title } = preset.attributes;

    const scenarioList = scenarios?.data ?? [];
    if (scenarioList.length === 0) {
      console.warn(`No scenarios for preset ${Title}.`);
    }

    return {
      [KEY_SCENARIOPRESET_UID]: kebabCase(Title),
      description: Description ?? '',
      scenarios: scenarioList.map(({ attributes }) => attributes.UID).filter(filterUniqueObjects),
      timeframe: parseInt(Timeframe.slice(1)), // Note: this needs to be the same variable type as the selectable timeframe uids.
      title: Title,
    };
  });
}

const loadExplainer = async ({ fetch, methodologyScenarios }) => {
  const [scenarios, scenarioPresetsRaw] = await Promise.all([methodologyScenarios, loadFromStrapi('scenario-presets', fetch)]);
  const scenarioPresets = processScenarioPresets(scenarioPresetsRaw);

  return {
    entries: [],
    categories: [],
    scenarios,
    selectableTimeframes,
    defaultTimeframe: 2100,
    scenarioPresets,
  };
};

const loadGlossary = async ({ fetch }) => {
  const data = await loadFromStrapi('glossaries', fetch, undefined, 'sort[0]=id');
  const entries = data.map((d) => {
    const { Title, Category, Link, UID, Description, Abbreviation } = d.attributes;
    return {
      title: Title,
      category: Category,
      footnote: Link,
      slug: UID || kebabCase(Title),
      content: parse(Description ?? ''),
      abbreviation: Abbreviation,
    };
  });

  const content = Object.entries(groupBy(entries, 'category')).map(([label, sections]) => {
    return {
      title: label,
      slug: kebabCase(label),
      sections,
    };
  });

  return {
    entries: [],
    categories: [],
    content,
    raw: entries,
  };
};

export const load = async ({ fetch, setHeaders }) => {
  setHeaders({ 'X-Accel-Buffering': 'no' });
  const methodologyScenarios = loadScenarios(fetch);
  const glossary = loadGlossary({ fetch });
  const explainer = loadExplainer({ fetch, methodologyScenarios });
  glossary.catch(() => {});
  explainer.catch(() => {});
  const title = generatePageTitle(LABEL_KEY_CONCEPTS);

  return {
    entries: [],
    categories: [],
    title,
    glossary,
    explainer,
  };
};
