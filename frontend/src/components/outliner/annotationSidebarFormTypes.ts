export interface Title {
  name: string;
  bdrc_id: string;
}

export interface Author {
  id: string;
  name: string;
  bdrc_id: string;
}

export interface FormDataType {
  title: Title;
  author: Author;
}
