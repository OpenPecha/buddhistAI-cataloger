export interface AltName {
  [lang: string]: string;
  id?: string;
}

export interface PersonName {
  [lang: string]: string;
}

export interface Person {
  id: string;
  name: {
    [lang: string]: string | null;
  };
  alt_names: {
    [lang: string]: string | null;
    id?: string;
  }[] | null;
  bdrc: string;
  wiki: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type CreatePersonData = Omit<Person, 'id'>;
export type UpdatePersonData = Partial<Omit<Person, 'id'>> & { id: string };