export type Target = {
  annotationFilter: string;
  filters: {
    [filterName: string]: {
      query: string;
      type: 'uri[]' | 'string';
    };
  };
  label: string;
  prefixes: string;
  targetFilter: string;
  titlePath: string;
};
