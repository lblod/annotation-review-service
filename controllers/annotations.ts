import { Annotation, HumanReadableAnnotation, Target } from '../types';
import { query, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import config from '../config/config';
import { getAnnotationCounts } from './review';

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
      ${buildAnnotationWhere(target, [targetId])}
    }    
  `);
  return parseInt(result.results.bindings[0].count.value);
}

export async function getAnnotationsForTarget(
  sessionId: string,
  target: Target,
  targetId: string,
  page: number,
  pageSize: number,
) {
  const [targetData, annotations] = await Promise.all([
    getTargetData(target, targetId),
    getAnnotationsData(target, targetId, page, pageSize),
  ]);
  const [humanReadableAnnotations, annotationCounts] = await Promise.all([
    addObjectText(annotations),
    getAnnotationCounts(
      sessionId,
      annotations.map((annotation) => annotation.id),
    ),
  ]);

  return {
    target: targetData,
    annotations: humanReadableAnnotations.map((annotation) => {
      const counts = annotationCounts[annotation.id];
      return {
        ...annotation,
        counts,
      };
    }),
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
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?annotation ?annotationId ?targetId ?predicate ?object ?agent ?agentName ?type 
    WHERE {
      ${buildAnnotationWhere(target, [targetId])}
    }    
    ORDER BY ?predicate ?annotation
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);
  return result.results.bindings.map(
    (binding) =>
      ({
        uri: binding.annotation.value,
        id: binding.annotationId.value,
        targetId: binding.targetId.value,
        link: binding.predicate.value,
        type: binding.type.value,
        value: binding.object.value,
        agent: binding.agent.value,
        agentName: binding.agentName?.value,
      }) as Annotation,
  );
}

async function addObjectText(
  annotations: Annotation[],
): Promise<HumanReadableAnnotation[]> {
  const { valueTypes } = config;

  const valueInfo = annotations
    .map((annotation) => {
      const valueType = valueTypes[annotation.type];
      if (!valueType) {
        return null;
      }
      return {
        value: annotation.value,
        type: annotation.type,
      };
    })
    .filter((stmt) => stmt !== null);

  if (valueInfo.length === 0) {
    return annotations.map((annotation) => {
      return { ...annotation, valueText: annotation.value };
    });
  }

  const unionStatements = Object.keys(valueTypes)
    .filter((type) => valueInfo.some((info) => info.type === type))
    .map((type) => {
      const textPath = valueTypes[type].textPath;
      return `
        {
          ?object a ${sparqlEscapeUri(type)} .
          ${textPath}
        }
      `;
    });

  const result = await query(`
    SELECT ?object ?objectText
    WHERE {
      VALUES ?object {
        ${valueInfo.map((t) => sparqlEscapeUri(t.value)).join('\n')}
      }
      ${unionStatements.join('\nUNION\n')}      
    }
  `);

  const textByObject: { [object: string]: string } = {};
  result.results.bindings.forEach((binding) => {
    textByObject[binding.object.value] = binding.objectText.value;
  });

  return annotations.map((annotation) => ({
    ...annotation,
    valueText: textByObject[annotation.value] || annotation.value,
  }));
}

export function buildAnnotationWhere(target: Target, targetIds: string[]) {
  const values = targetIds
    .map((id) => {
      return sparqlEscapeString(id);
    })
    .join('\n');
  return `VALUES ?targetId {
      ${values}
    }
    ?target mu:uuid ?targetId .

    ${target.annotationPath}

    ?annotation oa:hasBody ?body .
    ?annotation mu:uuid ?annotationId .
    
    ?body rdf:predicate ?predicate .
    ?body rdf:object ?object .
    ?action prov:generated ?annotation .
    ?action prov:wasAssociatedWith ?agent .
    OPTIONAL {
      ?agent skos:prefLabel ?agentName .
    }
    OPTIONAL {
      ?object a ?typeClass .
    }
    BIND(IF(BOUND(?typeClass), ?typeClass, datatype(?object)) AS ?type)

    ${target.annotationFilter}`;
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
