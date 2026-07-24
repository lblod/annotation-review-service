export type Target = {
  annotationFilter: string;
  annotationPath: string;
  filters: {
    [filterName: string]: {
      query: string;
      variable: string;
      type: 'uri' | 'string' | 'search';
    } & {
      ignoreAlreadyReviewed?: boolean;
    };
  };
  label: string;
  prefixes: string;
  targetFilter: string;
  titlePath: string;
};

export type Annotation = {
  uri: string;
  id: string;
  link: string;
  type: string;
  impact?: string;
  value: string;
  agent: string;
  agentName: string;
};

export type AnnotationWithComments = Annotation & {
  linkComment?: string;
  typeComment?: string;
};

export type Filters = { [filterName: string]: string };

export type AnnotationCounts = {
  [annotationId: string]: {
    ownReview?: string;
    [result: string]: number | string | undefined;
  };
};

export type Correction =
  | {
      resourceUri: string;
      resourceUris?: never;
      statement?: never;
    }
  | {
      resourceUri?: never;
      resourceUris: string[];
      statement?: never;
    }
  | {
      resourceUri?: never;
      resourceUris?: never;
      statement: Statement;
    };

export type Statement = {
  subject: string;
  predicate: string;
  object: string;
  type?: string; // type as per sparqlEscape(value, type), defaults to "string"
};

export type Config = {
  targets: { [key: string]: Target };
  valueTypes: {
    [typeUri: string]: { name: string; textPath?: string; linkPath?: string };
  };
  defaultTextPath: string;
  defaultLinkPath: string;
  reviewBodyPrefix: string;
};
