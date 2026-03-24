export type Target = {
  label: string;
  prefixes: string;
  targetFilter: string;
  filters: {
    [filterName: string]: {
      query: string;
      type: 'uri[]' | 'string';
    };
  };
  titlePath: string;
};
