import { query, update, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import config from '../config/config';
import { AnnotationCounts } from '../types';

export async function reviewAnnotation(
  annotationId: string,
  sessionId: string,
  result: 'approve' | 'reject',
) {
  await addReviewAnnotation(annotationId, sessionId, result);
  const newCounts = await getAnnotationCounts(sessionId, [annotationId]);
  return newCounts[annotationId];
}

async function addReviewAnnotation(
  annotationId: string,
  sessionId: string,
  result: 'approve' | 'reject',
) {
  // separate delete and insert query because triplestore did not handle optional efficiently
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>

    DELETE {
      ?existingReview ?p ?o.
    }
    WHERE {
      ?annotation a oa:Annotation .
      ?annotation mu:uuid ${sparqlEscapeString(annotationId)} .
      ?existingReview a oa:Annotation .
      ?existingReview a ext:ReviewAnnotation .
      ?existingReview oa:hasTarget ?annotation .
      ?existingReview oa:motivatedBy oa:assessing .
      ?existingReview dct:creator ${sparqlEscapeUri(sessionId)} .
      ?existingReview ?p ?o.
    }`);

  const newId = uuid();
  const newUri = `http://data.lblod.info/id/annotations/${newId}`;

  const safeBody = sparqlEscapeUri(config.reviewBodyPrefix + result);

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT {
      ?reviewAnnotation a oa:Annotation .
      ?reviewAnnotation a ext:ReviewAnnotation .
      ?reviewAnnotation oa:hasTarget ?annotation .
      ?reviewAnnotation oa:hasBody ${safeBody} .
      ?reviewAnnotation oa:motivatedBy oa:assessing .
      ?reviewAnnotation mu:uuid ?reviewAnnotationId .
      ?reviewAnnotation dct:created ?now .
      ?reviewAnnotation dct:creator ${sparqlEscapeUri(sessionId)} .
    }
    WHERE {
      ?annotation a oa:Annotation .
      ?annotation mu:uuid ${sparqlEscapeString(annotationId)} .

      VALUES ( ?reviewAnnotationId ?reviewAnnotation ) {
        ( ${sparqlEscapeString(newId)} ${sparqlEscapeUri(newUri)})
      }
      BIND (NOW() AS ?now)
    }
  `);
}

export async function getAnnotationCounts(
  sessionId: string,
  annotationIds: string[],
) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?annotationId ?ownResult ?reviewResult (COUNT(DISTINCT(?reviewAnnotation)) AS ?count)
    WHERE {
      VALUES ?annotationId {
        ${annotationIds.map(sparqlEscapeString).join(' ')}
      }
      ?reviewAnnotation a oa:Annotation .
      ?reviewAnnotation a ext:ReviewAnnotation .
      ?reviewAnnotation oa:hasTarget ?annotation .
      ?reviewAnnotation oa:hasBody ?reviewResult .
      ?reviewAnnotation oa:motivatedBy oa:assessing .
      ?annotation mu:uuid ?annotationId .
      
      OPTIONAL {
        ?ownAnnotation a oa:Annotation .
        ?ownAnnotation a ext:ReviewAnnotation .
        ?ownAnnotation oa:hasTarget ?annotation .
        ?ownAnnotation oa:hasBody ?ownResult .
        ?ownAnnotation oa:motivatedBy oa:assessing .      
        ?ownAnnotation dct:creator ${sparqlEscapeUri(sessionId)}
      }
    }
    GROUP BY ?annotationId ?ownResult ?reviewResult
  `);

  const counts: AnnotationCounts = {};
  result.results.bindings.forEach((binding) => {
    const result = binding.reviewResult.value.replace(
      config.reviewBodyPrefix,
      '',
    );
    const annotationId = binding.annotationId.value;
    counts[annotationId] = counts[annotationId] || {};
    counts[annotationId][result] = parseInt(binding.count.value);
    const ownReview = binding.ownResult?.value.replace(
      config.reviewBodyPrefix,
      '',
    );
    counts[annotationId].ownReview = ownReview;
  });
  return counts;
}
