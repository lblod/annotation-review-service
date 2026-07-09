import {
  query,
  update,
  sparqlEscapeString,
  sparqlEscapeUri,
  uuid,
  sparqlEscape,
} from 'mu';
import config from '../config/config';
import { AnnotationCounts, Correction, Statement } from '../types';

type ReviewInput =
  | {
      annotationId: string;
      sessionId: string;
      result: 'approve';
      corrections: undefined;
    }
  | {
      annotationId: string;
      sessionId: string;
      result: 'reject';
      corrections?: Correction[];
    };

export async function reviewAnnotation({
  annotationId,
  sessionId,
  result,
  corrections,
}: ReviewInput) {
  const reviewUri = await addReviewAnnotation(annotationId, sessionId, result);

  let correctionIds = [] as string[];
  if (corrections) {
    correctionIds = await Promise.all(
      corrections?.map((correction) => {
        return addCorrection(annotationId, sessionId, reviewUri, correction);
      }),
    );
  }
  const newCounts = await getAnnotationCounts(sessionId, [annotationId]);
  return {
    counts: newCounts[annotationId],
    correctionIds,
  };
}

async function addCorrection(
  annotationId: string,
  sessionId: string,
  reviewUri: string,
  correction: Correction,
) {
  if (correction.resourceUri) {
    return addCorrectionByDirectResource(
      annotationId,
      sessionId,
      reviewUri,
      correction.resourceUri,
    );
  } else {
    return addCorrectionByStatement(
      annotationId,
      sessionId,
      reviewUri,
      correction.statement!,
    );
  }
}

async function addCorrectionByDirectResource(
  annotationId: string,
  sessionId: string,
  reviewUri: string,
  resourceUri: string,
) {
  const correctionId = uuid();
  const correctionUri = `http://data.lblod.info/id/annotations/${correctionId}`;
  const activityId = uuid();
  const activityUri = `http://data.lblod.info/id/activities/${activityId}`;

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    INSERT {
      ?correction a oa:Annotation .
      ?correction a ext:CorrectionAnnotation .
      ?correction oa:hasTarget ?target .
      ?correction dct:replaces ?annotation .
      ?correction oa:hasBody ${sparqlEscapeUri(resourceUri)} .
      ?correction oa:motivatedBy oa:assessing .
      ?correction mu:uuid ?correctionId .
      ?correction dct:created ?now .
      ?correction dct:creator ${sparqlEscapeUri(sessionId)} .
      ?activity a prov:Activity .
      ?activity mu:uuid ?activityId .
      ?activity prov:generated ?correction .
      ?activity prov:wasAssociatedWith ${sparqlEscapeUri(sessionId)} .
      ${sparqlEscapeUri(reviewUri)} prov:influenced ?correction .
    }
    WHERE {
      ?annotation a oa:Annotation .
      ?annotation mu:uuid ${sparqlEscapeString(annotationId)} .
      ?annotation oa:hasTarget ?target .

      VALUES ( ?correctionId ?correction ?activity ?activityId ) {
        ( ${sparqlEscapeString(correctionId)} ${sparqlEscapeUri(correctionUri)} ${sparqlEscapeUri(activityUri)} ${sparqlEscapeString(activityId)})
      }
      BIND (NOW() AS ?now)
    }
  `);
  return correctionId;
}

async function addCorrectionByStatement(
  annotationId: string,
  sessionId: string,
  reviewUri: string,
  statement: Statement,
) {
  const correctionId = uuid();
  const correctionUri = `http://data.lblod.info/id/annotations/${correctionId}`;
  const statementId = uuid();
  const statementUri = `http://data.lblod.info/id/statements/${statementId}`;
  const activityId = uuid();
  const activityUri = `http://data.lblod.info/id/activities/${activityId}`;

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    INSERT {
      ?correction a oa:Annotation .
      ?correction a ext:CorrectionAnnotation .
      ?correction oa:hasTarget ?target .
      ?correction dct:replaces ?annotation .
      ?correction oa:hasBody ${sparqlEscapeUri(statementUri)} .
      ${sparqlEscapeUri(statementUri)} a rdf:Statement .
      ${sparqlEscapeUri(statementUri)} mu:uuid ${sparqlEscapeString(statementId)} .      
      ${sparqlEscapeUri(statementUri)} rdf:subject ${sparqlEscapeUri(statement.subject)} .
      ${sparqlEscapeUri(statementUri)} rdf:predicate ${sparqlEscapeUri(statement.predicate)} .
      ${sparqlEscapeUri(statementUri)} rdf:subject ${sparqlEscape(statement.object, statement.type || 'string')} .
      ?correction oa:motivatedBy oa:assessing .
      ?correction mu:uuid ?correctionId .
      ?correction dct:created ?now .
      ?correction dct:creator ${sparqlEscapeUri(sessionId)} .
      ?activity a prov:Activity .
      ?activity mu:uuid ?activityId .
      ?activity prov:generated ?correction .
      ?activity prov:wasAssociatedWith ${sparqlEscapeUri(sessionId)} .
      ${sparqlEscapeUri(reviewUri)} prov:influenced ?correction .
    }
    WHERE {
      ?annotation a oa:Annotation .
      ?annotation mu:uuid ${sparqlEscapeString(annotationId)} .
      ?annotation oa:hasTarget ?target .

      VALUES ( ?correctionId ?correction ?activity ?activityId ) {
        ( ${sparqlEscapeString(correctionId)} ${sparqlEscapeUri(correctionUri)} ${sparqlEscapeUri(activityUri)} ${sparqlEscapeString(activityId)})
      }
      BIND (NOW() AS ?now)
    }
  `);
  return correctionId;
}

export async function deleteAnnotationReview(
  annotationId: string,
  sessionId: string,
) {
  await removeReviewAnnotation(annotationId, sessionId);
  const newCounts = await getAnnotationCounts(sessionId, [annotationId]);
  return newCounts[annotationId] || {};
}

async function addReviewAnnotation(
  annotationId: string,
  sessionId: string,
  result: 'approve' | 'reject',
) {
  // separate delete and insert query because triplestore did not handle optional efficiently
  await removeReviewAnnotation(annotationId, sessionId);

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
  return newUri;
}

async function removeReviewAnnotation(annotationId: string, sessionId: string) {
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    DELETE {
      ?existingReview ?p ?o.
      ?correction ?cp ?co .
      ?statement ?sp ?so .
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

      OPTIONAL {
        ?existingReview prov:influenced ?correction .
        ?correction a ext:CorrectionAnnotation .
        ?correction dct:creator ${sparqlEscapeUri(sessionId)} .
        ?correction ?cp ?co .

        OPTIONAL {
          ?correction oa:hasBody ?statement .
          ?statement a rdf:Statement .
          ?statement ?sp ?so .
        }
      }
    }`);
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
