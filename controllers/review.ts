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

const rawAnnotationTargetTypes = process.env.ANNOTATION_TARGET_TYPES?.trim();
const annotationTargetTypes = rawAnnotationTargetTypes
  ? rawAnnotationTargetTypes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  : ['http://www.w3.org/ns/oa#Annotation'];

const annotationTargetTypesValues = `VALUES ?annotationTargetType { ${annotationTargetTypes
  .map(sparqlEscapeUri)
  .join(' ')} }`;

type ReviewInput =
  | {
      annotationTargetId: string;
      sessionId: string;
      result: 'approve';
      corrections: undefined;
    }
  | {
      annotationTargetId: string;
      sessionId: string;
      result: 'reject';
      corrections?: Correction[];
    };

export async function reviewAnnotationTarget({
  annotationTargetId,
  sessionId,
  result,
  corrections,
}: ReviewInput) {
  const reviewUri = await addReviewAnnotation(
    annotationTargetId,
    sessionId,
    result,
  );

  let correctionIds = [] as string[];
  if (corrections) {
    correctionIds = await Promise.all(
      corrections?.map((correction) => {
        return addCorrection(
          annotationTargetId,
          sessionId,
          reviewUri,
          correction,
        );
      }),
    );
  }
  const newCounts = await getAnnotationCounts(sessionId, [annotationTargetId]);
  return {
    counts: newCounts[annotationTargetId],
    correctionIds,
  };
}

async function addCorrection(
  annotationTargetId: string,
  sessionId: string,
  reviewUri: string,
  correction: Correction,
) {
  if (correction.resourceUri) {
    return addCorrectionByDirectResource(annotationId, sessionId, reviewUri, [
      correction.resourceUri,
    ]);
  } else if (correction.resourceUris) {
    return addCorrectionByDirectResource(
      annotationTargetId,
      sessionId,
      reviewUri,
      correction.resourceUris,
    );
  } else {
    return addCorrectionByStatement(
      annotationTargetId,
      sessionId,
      reviewUri,
      correction.statement!,
    );
  }
}

async function addCorrectionByDirectResource(
  annotationTargetId: string,
  sessionId: string,
  reviewUri: string,
  resourceUris: string[],
) {
  if (resourceUris.length === 0) {
    const error = new Error('No resource uris provided') as Error & {
      status: number;
    };
    error['status'] = 400;
    throw new Error();
  }
  const correctionId = uuid();
  const correctionUri = `http://data.lblod.info/id/annotations/${correctionId}`;
  const activityId = uuid();
  const activityUri = `http://data.lblod.info/id/activities/${activityId}`;
  const safeResourceUrisValues = resourceUris.map(sparqlEscapeUri).join('\n');

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
      ?correction oa:hasBody ?resourceUri .
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
      ?annotation mu:uuid ${sparqlEscapeString(annotationTargetId)} .
      ?annotation oa:hasTarget ?target .

      VALUES ( ?correctionId ?correction ?activity ?activityId ) {
        ( ${sparqlEscapeString(correctionId)} ${sparqlEscapeUri(correctionUri)} ${sparqlEscapeUri(activityUri)} ${sparqlEscapeString(activityId)})
      }
      VALUES ?resourceUri {
        ${safeResourceUrisValues}
      }
      BIND (NOW() AS ?now)
    }
  `);
  return correctionId;
}

async function addCorrectionByStatement(
  annotationTargetId: string,
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
      ?annotation mu:uuid ${sparqlEscapeString(annotationTargetId)} .
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
  annotationTargetId: string,
  sessionId: string,
  result: 'approve' | 'reject',
) {
  // separate delete and insert query because triplestore did not handle optional efficiently
  await removeReviewAnnotation(annotationTargetId, sessionId);

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
      ?reviewAnnotation oa:hasTarget ?annotationTarget .
      ?reviewAnnotation oa:hasBody ${safeBody} .
      ?reviewAnnotation oa:motivatedBy oa:assessing .
      ?reviewAnnotation mu:uuid ?reviewAnnotationId .
      ?reviewAnnotation dct:created ?now .
      ?reviewAnnotation dct:creator ${sparqlEscapeUri(sessionId)} .
    }
    WHERE {
      ${annotationTargetTypesValues}
      ?annotationTarget a ?annotationTargetType .
      ?annotationTarget mu:uuid ${sparqlEscapeString(annotationTargetId)} .

      VALUES ( ?reviewAnnotationId ?reviewAnnotation ) {
        ( ${sparqlEscapeString(newId)} ${sparqlEscapeUri(newUri)})
      }
      BIND (NOW() AS ?now)
    }
  `);
  return newUri;
}

async function removeReviewAnnotation(
  annotationTargetId: string,
  sessionId: string,
) {
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
      ?annotationTarget mu:uuid ${sparqlEscapeString(annotationTargetId)} .
      ?existingReview a oa:Annotation .
      ?existingReview a ext:ReviewAnnotation .
      ?existingReview oa:hasTarget ?annotationTarget .
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
  annotationTargetIds: string[],
) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX oa: <http://www.w3.org/ns/oa#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?annotationTargetId ?ownResult ?reviewResult (COUNT(DISTINCT(?reviewAnnotation)) AS ?count)
    WHERE {
      VALUES ?annotationTargetId {
        ${annotationTargetIds.map(sparqlEscapeString).join(' ')}
      }
      ?annotationTarget mu:uuid ?annotationTargetId .
      ?reviewAnnotation a oa:Annotation .
      ?reviewAnnotation a ext:ReviewAnnotation .
      ?reviewAnnotation oa:hasTarget ?annotationTarget .
      ?reviewAnnotation oa:hasBody ?reviewResult .
      ?reviewAnnotation oa:motivatedBy oa:assessing .

      OPTIONAL {
        ?ownAnnotation a oa:Annotation .
        ?ownAnnotation a ext:ReviewAnnotation .
        ?ownAnnotation oa:hasTarget ?annotationTarget .
        ?ownAnnotation oa:hasBody ?ownResult .
        ?ownAnnotation oa:motivatedBy oa:assessing .
        ?ownAnnotation dct:creator ${sparqlEscapeUri(sessionId)}
      }
    }
    GROUP BY ?annotationTargetId ?ownResult ?reviewResult
  `);

  const counts: AnnotationCounts = {};
  result.results.bindings.forEach((binding) => {
    const result = binding.reviewResult.value.replace(
      config.reviewBodyPrefix,
      '',
    );
    const annotationTargetId = binding.annotationTargetId.value;
    counts[annotationTargetId] = counts[annotationTargetId] || {};
    counts[annotationTargetId][result] = parseInt(binding.count.value);
    const ownReview = binding.ownResult?.value.replace(
      config.reviewBodyPrefix,
      '',
    );
    counts[annotationTargetId].ownReview = ownReview;
  });
  return counts;
}
