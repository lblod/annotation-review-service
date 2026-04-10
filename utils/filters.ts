import { Filters, Target } from '../types';
import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

export function buildFilterString(target: Target, filters: Filters) {
  let filterString = '';

  Object.keys(filters || {}).forEach((key) => {
    const filterConfig = target.filters[key];
    if (!filterConfig) {
      return;
    }
    filterString += `
      FILTER EXISTS {
        ${filterConfig.query}
    `;
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
    }
    `;
  });
  return filterString;
}

export function buildFilterAlreadyReviewed(
  sessionId: string,
  filters: Filters,
) {
  if (!filters.ignoreAlreadyReviewed) {
    return '';
  }

  return `
    FILTER NOT EXISTS {
      ?ownReview <http://www.w3.org/ns/oa#hasTarget> ?annotation .
      ?ownReview <http://purl.org/dc/terms/creator> ${sparqlEscapeUri(sessionId)}
    }
  `;
}
