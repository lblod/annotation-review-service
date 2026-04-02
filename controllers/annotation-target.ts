import { Target } from '../types';
import { query, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { buildAnnotationWhere } from './annotations';

export async function getTargets(
  target: Target,
  filters: { [filterName: string]: string },
  page: number,
  pageSize: number,
) {
  const offset = page * pageSize;

  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT ?target (SAMPLE(?uuid) AS ?uuid) (SAMPLE(?title) AS ?title) (COUNT(DISTINCT(?annotation)) AS ?annotationCount)
    WHERE {
      ${getTargetSelector(target, filters)}
    }
    GROUP BY ?target
    ORDER BY DESC(?annotationCount) ?target
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  const targetIds = [];
  const targets = result.results.bindings.map((binding) => {
    const id = binding.uuid.value;
    targetIds.push(id);
    return {
      uri: binding.target.value,
      id,
      title: binding.title?.value || '',
      annotationCount: parseInt(binding.annotationCount.value),
    };
  });

  const counts = await getTargetAnnotationCount(target, targetIds);
  return targets.map((t) => {
    return {
      ...t,
      annotationCount: counts[t.id],
    };
  });
}

async function getTargetAnnotationCount(target: Target, targetIds: string[]) {
  const results = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT ?targetId (COUNT(DISTINCT ?annotation) as ?count) 
    
    WHERE {
      ${buildAnnotationWhere(target, targetIds)}
    } GROUP BY ?targetId
  `);

  const targetCountMap = {};

  results.results.bindings.forEach((binding) => {
    targetCountMap[binding.targetId.value] = parseInt(binding.count.value);
  });
  return targetCountMap;
}

export async function getTargetCount(
  target: Target,
  filters: { [filterName: string]: string },
) {
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT (COUNT(DISTINCT ?target) AS ?count)
    WHERE {
      ${getTargetSelector(target, filters)}
    }    
  `);

  return parseInt(result.results.bindings[0].count.value);
}

export function getTargetSelector(
  target: Target,
  filters: { [filterName: string]: string },
) {
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

  return `
      ${target.targetFilter}

      ?target mu:uuid ?uuid .

      ${target.titlePath}

      ?annotation oa:hasTarget ?targetResource .
      ?targetResource oa:source ?target .

      ${filterString}
  `;
}
