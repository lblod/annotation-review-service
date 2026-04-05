import { Filters, Target } from '../types';
import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

export function buildFilterString(target: Target, filters: Filters) {
  let filterString = '';

  Object.keys(filters || {}).forEach((key) => {
    const filterConfig = target.filters[key];
    if (!filterConfig) {
      return;
    }
    filterString += filterConfig.query;
    const filterValues = filters[key]
      .split(',')
      .map((filterValue) => {
        switch (filterConfig.type) {
          case 'uri':
            return sparqlEscapeUri(filterValue);
          default:
            return sparqlEscapeString(filterValue);
        }
      })
      .join('\n');
    filterString += `
      VALUES ?${filterConfig.variable} {
        ${filterValues} 
      }
    `;
  });
  return filterString;
}
