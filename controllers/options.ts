import { timedQuery } from '../utils/timed-query';
import { KeyValuePair } from '../types';

// eslint-disable-next-line prettier/prettier
export async function fetchExpressionPredicates(): Promise<Array<KeyValuePair>> {
  const queryString = `
    prefix oa: <http://www.w3.org/ns/oa#>
    prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    select distinct ?predicateUri
    where {
      ?annotation oa:hasTarget / oa:hasSource ?target.
      ?annotation oa:hasBody ?body.
      ?body rdf:predicate ?predicateUri .
    }
  `;

  const sparqlResult = await timedQuery(queryString);
  const values = sparqlResult.results?.bindings ?? [];

  return values.map((result) => ({
    key: result.predicateUri.value,
    value: result.predicateUri.value,
  }));
}

export async function fetchAiModels(): Promise<Array<KeyValuePair>> {
  const queryString = `
    prefix prov: <http://www.w3.org/ns/prov#>

    select distinct ?model
    where {
      ?s prov:specializationOf ?model .
    }
  `;

  const sparqlResult = await timedQuery(queryString);
  const values = sparqlResult.results?.bindings ?? [];

  return values.map((result) => ({
    key: result.model.value,
    value: result.model.value,
  }));
}

export async function fetchValueTypes(): Promise<Array<KeyValuePair>> {
  const queryString = `
    prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    select distinct ?type
    where {
      ?body rdf:object ?object .
      optional {
        ?object a ?typeClass .
      }
      bind(if(isIRI(?typeClass), ?typeClass, datatype(?object)) as ?type)
    }
  `;

  const sparqlResult = await timedQuery(queryString);
  const values = sparqlResult.results?.bindings ?? [];

  return values
    .map((result) => ({
      key: result.type?.value,
      value: result.type?.value,
    }))
    .filter((_pair) => _pair.key && _pair.key.trim() !== '');
}
