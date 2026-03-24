import { Target } from '../types';
import { query, sparqlEscapeString } from 'mu';

export async function getAnnotationCountForTarget(
  target: Target,
  targetId: string,
) {
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT (COUNT(DISTINCT ?annotation) AS ?count)
    WHERE {
      VALUES ?uuid {
        ${sparqlEscapeString(targetId)}
      }
      ?target mu:uuid ?uuid .
      ?annotation oa:hasTarget ?resource .
      ?resource oa:source ?target .
      
      ?action prov:generated ?annotation .
      ?action prov:wasAssociatedWith ?agent .
      ${target.annotationFilter}
    }    
  `);
  return parseInt(result.results.bindings[0].count.value);
}

export async function getAnnotationsForTarget(
  target: Target,
  targetId: string,
  page: number,
  pageSize: number,
) {
  const [targetData, annotations] = await Promise.all([
    getTargetData(target, targetId),
    getAnnotationsData(target, targetId, page, pageSize),
  ]);
  return {
    target: targetData,
    annotations,
  };
}

async function getAnnotationsData(
  target: Target,
  targetId: string,
  page: number,
  pageSize: number,
) {
  const offset = page * pageSize;
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT DISTINCT ?annotation ?uuid ?predicate ?object ?agent ?agentName
    WHERE {
      VALUES ?uuid {
        ${sparqlEscapeString(targetId)}
      }
      ?target mu:uuid ?uuid .
      ?annotation oa:hasTarget ?resource .
      ?resource oa:source ?target .
      ?annotation oa:hasBody ?body .
      ?body rdf:predicate ?predicate .
      ?body rdf:object ?object .
      ?action prov:generated ?annotation .
      ?action prov:wasAssociatedWith ?agent .
      OPTIONAL {
        ?agent skos:prefLabel ?agentName .
      }

      ${target.annotationFilter}
    }    
    ORDER BY ?predicate ?annotation
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);
  return result.results.bindings.map((binding) => ({
    uri: binding.annotation.value,
    id: binding.uuid.value,
    type: binding.predicate.value,
    value: binding.object.value,
    agent: binding.agent.value,
    agentName: binding.agentName?.value,
  }));
}

export async function getTargetData(target: Target, targetId: string) {
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    
    SELECT ?target ?title ?uuid
    WHERE {
      VALUES ?uuid {
        ${sparqlEscapeString(targetId)}
      }
      ?target mu:uuid ?uuid .
      ${target.targetFilter}
      ${target.titlePath}
    }
    LIMIT 1
  `);

  return {
    uri: result.results.bindings[0]?.target?.value,
    title: result.results.bindings[0]?.title?.value,
    id: result.results.bindings[0]?.uuid?.value,
  };
}
