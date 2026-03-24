import { Target } from '../types';
import { querySudo } from '@lblod/mu-auth-sudo';
import { query } from 'mu';

export async function getTargets(
  target: Target,
  filters: { [filterName: string]: string },
  page: number,
  pageSize: number,
) {
  const offset = page * pageSize;
  // TODO add filters
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT ?target (SAMPLE(?uuid) AS ?uuid) (SAMPLE(?title) AS ?title) (COUNT(DISTINCT(?annotation)) AS ?annotationCount)
    WHERE {
      ${getTargetSelector(target)}
    }
    GROUP BY ?target
    ORDER BY DESC(?annotationCount) ?target
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  return result.results.bindings.map((binding) => ({
    uri: binding.target.value,
    id: binding.uuid.value,
    title: binding.title?.value || '',
    annotationCount: parseInt(binding.annotationCount.value),
  }));
}

export async function getTargetCount(
  target: Target,
  filters: { [filterName: string]: string },
) {
  // TODO add filters
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT (COUNT(DISTINCT ?target) AS ?count)
    WHERE {
      ${getTargetSelector(target)}
    }    
  `);

  return parseInt(result.results.bindings[0].count.value);
}

function getTargetSelector(target: Target) {
  return `
      ${target.targetFilter}

      ?target mu:uuid ?uuid .

      ${target.titlePath}

      ?annotation oa:hasTarget ?targetResource .
      ?targetResource oa:source ?target .
  `;
}
