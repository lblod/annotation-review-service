import { query } from 'mu';
import { KeyValuePair } from '../types';

// eslint-disable-next-line prettier/prettier
export async function fetchExpressionPredicates(): Promise<Array<KeyValuePair>> {
  const queryString = `
    prefix oa: <http://www.w3.org/ns/oa#>
    prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    select distinct ?predicateUri
    where {
      ?annotationT oa:hasTarget / oa:hasSource ?target.
      ?annotationT oa:hasBody ?bodyT.
      ?bodyT rdf:predicate ?predicateUri .
    }
  `;

  const sparqlResult = await query(queryString);
  const values = sparqlResult.results?.bindings ?? [];

  return values.map((result) => ({
    key: result.predicateUri.value,
    value: result.predicateUri.value,
  }));
}

export async function fetchAiModels() {
  const queryString = `
    prefix prov: <http://www.w3.org/ns/prov#>

    select distinct ?model
    where {
      ?s prov:specializationOf ?model .
    }
  `;

  const sparqlResult = await query(queryString);
  const values = sparqlResult.results?.bindings ?? [];

  return values.map((result) => ({
    key: result.model.value,
    value: result.model.value,
  }));
}
