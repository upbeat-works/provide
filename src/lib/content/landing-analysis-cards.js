export function toAnalysisCards(entries = []) {
  return (entries ?? [])
    .map((entry) => entry?.attributes ?? entry)
    .filter((card) => card?.Path && card?.Description)
    .sort((left, right) => left.SortOrder - right.SortOrder)
    .map((card) => ({
      path: card.Path,
      image: card.Image,
      imageAlt: card.ImageAlt,
      description: card.Description,
      project: card.Project,
      geography: card.Geography,
      dataSource: card.DataSource,
    }));
}
