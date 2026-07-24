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

    if (filterConfig.type === 'search') {
      // eslint-disable-next-line
      const safeValue = filters[key].split("'").join('').split('"').join('');
      filterString =
        filterString.split(`$${filterConfig.variable}`).join(safeValue) + '\n}';
      return;
    }

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

export function mapToAnnotationFilters(target: Target, filters: Filters): Filters {
  const result: Filters = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    const annotationEntry = Object.entries(target.filters).find(
      ([filterKey, filterConfig]) =>
        filterConfig.isAnnotationFilter &&
        filterKey.slice(1).toLowerCase() === key.toLowerCase(),
    );
    if (annotationEntry) {
      result[annotationEntry[0]] = value;
    }
  });
  return result;
}
