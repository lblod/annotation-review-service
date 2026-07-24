import { FilterConfig, Filters } from '../types';
import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

export function buildFilterString(
  filterConfigs: { [key: string]: FilterConfig },
  filters: Filters,
) {
  let filterString = '';

  Object.keys(filters || {}).forEach((key) => {
    const filterConfig = filterConfigs[key];
    if (!filterConfig) {
      return;
    }

    if (filterConfig.query) {
      filterString += `
        FILTER EXISTS {
          ${filterConfig.query}
      `;
    }

    if (filterConfig.type === 'search') {
      // eslint-disable-next-line
      const safeValue = filters[key].split("'").join('').split('"').join('');
      filterString =
        filterString.split(`$${filterConfig.variable}`).join(safeValue) + '\n}';
      return;
    }

    const filterValueArray = filters[key].split(',').map((filterValue) => {
      switch (filterConfig.type) {
        case 'uri':
          return sparqlEscapeUri(filterValue);
        default:
          return sparqlEscapeString(filterValue);
      }
    });

    if (filterConfig.query) {
      const filterValues = filterValueArray.join('\n');
      filterString += `
      VALUES ?${filterConfig.variable} {
        ${filterValues} 
      }
    }
    `;
    } else {
      filterString += `filter(?${filterConfig.variable} IN (${filterValueArray.join(',\n')}))`;
    }
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
