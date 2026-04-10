import { Annotation, AnnotationCounts, Filters, Target } from '../types';
import { query, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import config from '../config/config';
import { getAnnotationCounts } from './review';
import { buildFilterString } from '../utils/filters';

export async function getAllAnnotationCountForTarget(
  target: Target,
  filters = {},
) {
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT (COUNT(DISTINCT ?annotation) AS ?count)
    WHERE {
      ?target mu:uuid ?uuid .

      ${target.annotationPath}
      
      ?action prov:generated ?annotation .
      ?action prov:wasAssociatedWith ?agent .
      ${target.annotationFilter}

      ${buildFilterString(target, filters)}
    }    
  `);
  return parseInt(result.results.bindings[0].count.value);
}

export async function getAnnotationCountForTarget(
  target: Target,
  targetId: string,
  filters = {},
) {
  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT (COUNT(DISTINCT ?annotation) AS ?count)
    WHERE {
      ${buildAnnotationWhere(target, [targetId], filters)}
    }    
  `);
  return parseInt(result.results.bindings[0].count.value);
}

export async function getAllAnnotationsForTarget(
  sessionId: string,
  target: Target,
  filters = {} as Filters,
  page: number,
  pageSize: number,
) {
  const [targetData, annotations] = await Promise.all([
    getTargetData(target),
    getAnnotationsData(target, page, pageSize, undefined, filters),
  ]);
  const [textByObject, annotationCounts] = await Promise.all([
    getObjectTexts(annotations),
    getAnnotationCounts(
      sessionId,
      annotations.map((annotation) => annotation.id),
    ),
  ]);

  return {
    target: targetData,
    annotations: mergeExtraAnnotationInfo(annotations, {
      textByObject,
      annotationCounts,
    }),
  };
}

export async function getAnnotationsForTarget(
  sessionId: string,
  target: Target,
  targetId: string,
  filters = {},
  page: number,
  pageSize: number,
) {
  const [targetData, annotations] = await Promise.all([
    getTargetData(target, targetId),
    getAnnotationsData(target, page, pageSize, targetId, filters),
  ]);
  const [textByObject, linkByObject, annotationCounts] = await Promise.all([
    getObjectTexts(annotations),
    getObjectLinks(annotations),
    getAnnotationCounts(
      sessionId,
      annotations.map((annotation) => annotation.id),
    ),
  ]);

  return {
    target: targetData,
    annotations: mergeExtraAnnotationInfo(annotations, {
      textByObject,
      linkByObject,
      annotationCounts,
    }),
  };
}

function mergeExtraAnnotationInfo(
  annotations: Annotation[],
  {
    textByObject = {} as {
      [annotationUri: string]: { [annotationValue: string]: string };
    },
    linkByObject = {} as {
      [annotationUri: string]: string;
    },
    annotationCounts = {} as AnnotationCounts,
  },
) {
  return annotations.map((annotation) => {
    const counts = annotationCounts[annotation.id] as unknown as number;

    return {
      ...annotation,
      counts,
      valueText:
        textByObject[annotation.uri]?.[annotation.value] || annotation.value,
      valueLink: linkByObject[annotation.value],
    };
  });
}

async function getAnnotationsData(
  target: Target,
  page: number,
  pageSize: number,
  targetId?: string,
  filters = {} as Filters,
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

    SELECT DISTINCT ?annotation ?annotationId ?target ?targetId ?predicate ?object ?agent ?agentName ?type 
    WHERE {
      ${buildAnnotationWhere(target, targetId ? [targetId] : [], filters)}
    }    
    ORDER BY ?predicate ?annotation
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);
  return result.results.bindings.map(
    (binding) =>
      ({
        target: binding.target.value,
        targetId: binding.targetId.value,
        uri: binding.annotation.value,
        id: binding.annotationId.value,
        link: binding.predicate?.value,
        type: binding.type?.value,
        value: binding.object.value,
        agent: binding.agent?.value,
        agentName: binding.agentName?.value,
      }) as Annotation,
  );
}

async function getObjectTexts(annotations: Annotation[]) {
  const { valueTypes } = config;

  const valueInfo = annotations
    .map((annotation) => {
      const valueType = valueTypes[annotation.type];
      if (!valueType) {
        return null;
      }
      return {
        annotation: annotation.uri,
        value: annotation.value,
        type: annotation.type,
      };
    })
    .filter((stmt) => stmt !== null);

  if (valueInfo.length === 0) {
    return {};
  }

  const unionStatements = Object.keys(valueTypes)
    .filter((type) => valueInfo.some((info) => info.type === type))
    .map((type) => {
      const textPath = valueTypes[type].textPath || config.defaultTextPath;
      return `
        {
          ?object a ${sparqlEscapeUri(type)} .
          ${textPath}
        }
      `;
    });
  const safeValues = valueInfo
    .map((t) => {
      const safeAnnot = sparqlEscapeUri(t.annotation);
      const safeValue = sparqlEscapeUri(t.value);
      return `(${safeAnnot} ${safeValue})`;
    })
    .join('\n');

  const result = await query(`
    SELECT ?annotation ?object ?objectText
    WHERE {
      VALUES (?annotation ?object) {
        ${safeValues}
      }
      ${unionStatements.join('\nUNION\n')}      
    }
  `);

  const textByObject: { [annotation: string]: { [Object: string]: string } } =
    {};
  result.results.bindings.forEach((binding) => {
    if (!textByObject[binding.annotation.value]) {
      textByObject[binding.annotation.value] = {};
    }
    textByObject[binding.annotation.value][binding.object.value] =
      binding.objectText.value;
  });

  return textByObject;
}

async function getObjectLinks(annotations: Annotation[]) {
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

  const unionStatements = Object.keys(valueTypes)
    .filter((type) => valueInfo.some((info) => info.type === type))
    .map((type) => {
      const textPath = valueTypes[type].linkPath || config.defaultLinkPath;
      return `
        {
          ?object a ${sparqlEscapeUri(type)} .
          ${textPath}
        }
      `;
    });

  if (valueInfo.length === 0) {
    return {};
  }

  const result = await query(`
    SELECT ?object ?objectLink
    WHERE {
      VALUES ?object {
        ${valueInfo.map((t) => sparqlEscapeUri(t.value)).join('\n')}
      }
      ${unionStatements.join('\nUNION\n')}      
    }
  `);

  const linkByObject: { [object: string]: string } = {};
  result.results.bindings.forEach((binding) => {
    linkByObject[binding.object.value] = binding.objectLink.value;
  });

  return linkByObject;
}

export function buildAnnotationWhere(
  target: Target,
  targetIds: string[],
  filters = {},
) {
  const values = targetIds
    .map((id) => {
      return sparqlEscapeString(id);
    })
    .join('\n');

  let valuesStatement = '';
  if (targetIds.length > 0) {
    valuesStatement = `VALUES ?targetId {
      ${values}
    }`;
  }

  const filterString = buildFilterString(target, filters);
  return `
    ${valuesStatement}

    ?target mu:uuid ?targetId .

    ${target.annotationPath}

    ?annotation mu:uuid ?annotationId .
    {
      ?annotation oa:hasBody ?body .
      ?body rdf:predicate ?predicate .
      ?body rdf:object ?object .
    } UNION {
      ?annotation oa:hasBody ?object .
      FILTER NOT EXISTS {
        ?object rdf:object ?something .
      }
    }

    ?action prov:generated ?annotation .
    ?action prov:wasAssociatedWith ?agent .
    OPTIONAL {
      ?agent skos:prefLabel ?agentName .
    }
    OPTIONAL {
      ?object a ?typeClass .
    }
    BIND(IF(BOUND(?typeClass), ?typeClass, datatype(?object)) AS ?type)

    ${filterString}

    ${target.annotationFilter}`;
}

export async function getTargetData(target: Target, targetId?: string) {
  let targetValueFilter = '';
  if (targetId) {
    targetValueFilter = `VALUES ?uuid {
      ${sparqlEscapeString(targetId)}
    }`;
  }

  const result = await query(`
    ${target.prefixes}
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    
    SELECT ?target ?title ?uuid
    WHERE {
      ${targetValueFilter}
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
