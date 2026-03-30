export default {
  targets: {
    expression: {
      label: 'Expressions',
      // free
      // PREFIX oa: <http://www.w3.org/ns/oa#>
      // PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      prefixes: `
        PREFIX eli: <http://data.europa.eu/eli/ontology#>
      `,
      // can also use to filter ?annotation in case we want to filter the kind of annotations to show
      // note that we have to filter by expressions having a work because other expressions are created
      // by the ai flow (translations etc)
      // filtering on expressions that have som sort of title too (regular or annotation)
      targetFilter: `
        ?target a eli:Expression .
        ?work eli:is_realized_by ?target .
        FILTER (BOUND(?title))
      `,
      // can use to filter annotations for a given target, need to fix the set of agents once we have final uris for them
      annotationFilter: `
        VALUES ?agent {
          <http://example.org/entity-extraction>
        }
      `,
      annotationPath: `
        ?annotation oa:hasTarget ?resource .
        ?resource oa:source / ^eli:is_realized_by? ?target .
      `,
      filters: {
        owner: {
          query: `
            ?target oa:hasBody ?body .
            VALUES ?body { $filterValue } 
          `,
          type: 'uri[]',
        },
      },
      titlePath: `
        OPTIONAL {
          ?target eli:title ?directTitle .
        }
        OPTIONAL {
          ?target ^oa:hasTarget / oa:hasBody ?body .
          ?body rdf:predicate eli:title .
          ?body rdf:object ?annotatedTitle .
        }
        BIND(IF(BOUND(?directTitle), ?directTitle, ?annotatedTitle) AS ?title)
      `,
    },
  },
  valueTypes: {
    'http://xmlns.com/foaf/0.1/Person': {
      name: 'Person',
      textPath: `
        ?object <http://www.w3.org/2000/01/rdf-schema#label> ?objectText .
      `,
      LinkPath: `
        ?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink .
      `,
    },
    'http://www.w3.org/ns/org#Organization': {
      name: 'Organization',
    },
  },
  defaultTextPath: `
        ?object <http://www.w3.org/2000/01/rdf-schema#label> ?objectText .
  `,
  defaultLinkPath: `
        ?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink .
  `,
  reviewBodyPrefix: 'http://mu.semte.ch/vocabularies/ext/annotation-review#',
};
