import { Filters, Target } from '../types';
import { timedQuery } from '../utils/timed-query';
import config from '../config/config';
import { buildAnnotationWhere } from './annotations';

function reviewSummaryPrefixes(target: Target) {
  return `
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX bif: <http://www.openlinksw.com/schemas/bif#>
  `;
}

const hasReview = `
  FILTER EXISTS {
    ?review a ext:ReviewAnnotation ;
      oa:motivatedBy oa:assessing ;
      oa:hasTarget ?annotation .
  }
`;

export async function getReviewSummary(
  target: Target,
  filters = {} as Filters,
) {
  const result = await timedQuery(`
    ${reviewSummaryPrefixes(target)}

    SELECT ?objectId ?reviewResult (COUNT(DISTINCT ?review) AS ?count)
    WHERE {
      ${buildAnnotationWhere(target, [], filters)}
      ?object mu:uuid ?objectId .
      ?review a ext:ReviewAnnotation ;
        oa:motivatedBy oa:assessing ;
        oa:hasTarget ?annotation ;
        oa:hasBody ?reviewResult .
    }
    GROUP BY ?objectId ?reviewResult
  `);
  return result.results.bindings.map((binding) => ({
    conceptId: binding.objectId.value,
    result: binding.reviewResult.value.replace(config.reviewBodyPrefix, ''),
    count: parseInt(binding.count.value),
  }));
}

async function countAnnotations(
  target: Target,
  filters: Filters,
  extraWhere = '',
) {
  const result = await timedQuery(`
    ${reviewSummaryPrefixes(target)}

    SELECT (COUNT(DISTINCT ?annotation) AS ?count)
    WHERE {
      ${buildAnnotationWhere(target, [], filters)}
      ${extraWhere}
    }
  `);
  return parseInt(result.results.bindings[0].count.value);
}

export async function getReviewTotals(target: Target, filters = {} as Filters) {
  const [annotations, reviewedAnnotations] = await Promise.all([
    countAnnotations(target, filters),
    countAnnotations(target, filters, hasReview),
  ]);
  return { annotations, reviewedAnnotations };
}

async function countDecisionsPerConcept(
  target: Target,
  filters: Filters,
  extraWhere = '',
) {
  const result = await timedQuery(`
    ${reviewSummaryPrefixes(target)}

    SELECT ?objectId (COUNT(DISTINCT ?target) AS ?count)
    WHERE {
      ${buildAnnotationWhere(target, [], filters)}
      ?object mu:uuid ?objectId .
      ${extraWhere}
    }
    GROUP BY ?objectId
  `);
  const counts: { [conceptId: string]: number } = {};
  result.results.bindings.forEach((binding) => {
    counts[binding.objectId.value] = parseInt(binding.count.value);
  });
  return counts;
}

export async function getConceptDecisionCounts(
  target: Target,
  filters = {} as Filters,
) {
  const [labeled, reviewed] = await Promise.all([
    countDecisionsPerConcept(target, filters),
    countDecisionsPerConcept(target, filters, hasReview),
  ]);
  return Object.keys(labeled).map((conceptId) => ({
    conceptId,
    labeledDecisions: labeled[conceptId],
    reviewedDecisions: reviewed[conceptId] ?? 0,
  }));
}
