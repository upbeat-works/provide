export function toAnalysisCards(entries = [], cmsUrl) {
  return (entries ?? [])
    .filter((card) => card?.Path && card?.Description)
    .sort((left, right) => left.SortOrder - right.SortOrder)
    .map((card) => {
      const media = card.Image;
      return {
        path: card.Path,
        image: media?.url ? new URL(media.url, cmsUrl).href : null,
        imageAlt: card.ImageAlt || media?.alternativeText || '',
        description: card.Description,
        project: card.Project,
        geography: card.Geography,
        dataSource: card.DataSource,
      };
    });
}
