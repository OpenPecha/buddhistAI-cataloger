export interface AltName {
  [lang: string]: string;
  id?: string;
}

export interface PersonName {
  [lang: string]: string;
}

export interface Person {
  id: string;
  name: PersonName;
  alt_names: AltName[] | null;
  bdrc: string;
  wiki: string | null;
}

export type CreatePersonData = Omit<Person, 'id'>;
export type UpdatePersonData = Partial<Omit<Person, 'id'>> & { id: string };