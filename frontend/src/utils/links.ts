export const textEditionsLink = (text_id: string) => {
  return `/texts/${text_id}/editions`;
}

export const editionLink = (text_id: string, edition_id: string) => {
  return `/texts/${text_id}/editions/${edition_id}`;
}

export const translationLink = (text_id: string, edition_id: string) => {
  return `/texts/${text_id}/editions/${edition_id}/translation`;
}

export const alignmentLink = (source_edition_id: string, target_edition_id: string) => {
  return `/align/${source_edition_id}/${target_edition_id}`;
}

/** ID from cataloger related-edition API (edition_id, legacy instance_id, or id). */
export function editionIdFromRelated(item: {
  edition_id?: string;
  instance_id?: string;
  id?: string;
}): string {
  return item.edition_id ?? item.instance_id ?? item.id ?? '';
}