export type Target = {
  annotationFilter: string;
  annotationPath: string;
  filters: {
    [filterName: string]: {
      query: string;
      variable: string;
      type: 'uri' | 'string';
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
  value: string;
  agent: string;
  agentName: string;
};
