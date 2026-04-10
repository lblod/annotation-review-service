export default {
  targets: {
    expression: {
      label: 'Expressions',
      // free
      // PREFIX oa: <http://www.w3.org/ns/oa#>
      // PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      prefixes: `
        PREFIX eli: <http://data.europa.eu/eli/ontology#>
        PREFIX org: <http://www.w3.org/ns/org#>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
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
          <http://example.org/named-entity-linking>
        }
      `,
      annotationPath: `
        ?annotation oa:hasTarget ?resource .
        ?resource oa:source / ^eli:is_realized_by? ?target .
      `,
      filters: {
        municipality: {
          query: `
            {
              ?work eli:passed_by ?org .
              ?municipality org:hasSubOrganization ?org .
            } UNION {
              ?target ext:importedFor ?municipality .
            }
          `,
          variable: 'municipality',
          type: 'uri',
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
    'expression-label': {
      label: 'Expression Labels',
      // free
      // PREFIX oa: <http://www.w3.org/ns/oa#>
      // PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      prefixes: `
        PREFIX eli: <http://data.europa.eu/eli/ontology#>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
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
        ?object a skos:Concept .
        FILTER NOT EXISTS {
          ?object skos:inScheme <http://mu.semte.ch/vocabularies/ext/impact> .
        }

        VALUES ?agent {
          <http://example.org/model_annotation>
        }
      `,

      // these annotations are linking directly to the expression
      annotationPath: `
        ?annotation oa:hasTarget / ^eli:is_realized_by? ?target .
      `,
      filters: {
        conceptScheme: {
          query: `
            ?annotation oa:hasBody ?concept .
            ?concept skos:inScheme ?scheme .
            ?scheme mu:uuid ?schemeId.
          `,
          variable: 'schemeId',
          type: 'string',
        },
        concept: {
          query: `
            ?annotation oa:hasBody ?concept .
            ?concept mu:uuid ?conceptId.
          `,
          type: 'string',
          variable: 'conceptId',
        },
        owner: {
          query: `
            {
               ?work eli:is_realized_by ?target .
               ?work eli:passed_by ?org .
               ?owner <http://www.w3.org/ns/org#hasSubOrganization> ?org .
             } UNION {
               ?target <http://mu.semte.ch/vocabularies/ext/importedFor> ?owner .
            }
          `,
          variable: 'owner',
          type: 'uri',
        },
        impact: {
          query: `
            ?annotation oa:hasBody ?impact .
            ?impact mu:uuid ?impactId .
          `,
          variable: 'impactId',
          type: 'string',
        },
        year: {
          query: `
            { 
              {
                ?work eli:is_realized_by ?target .
                ?work eli:date_document ?date .
              }
              UNION
              {
                ?target eli:date_document ?date .
              }
              UNION 
              {
                ?target ^oa:hasTarget / oa:hasBody ?datebody .
                ?datebody rdf:predicate eli:date_document .
                ?datebody rdf:object ?date .
              }
            }
            BIND(SUBSTR(STR(?date), 0, 4) AS ?year)
          `,
          variable: 'year',
          type: 'string',
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
      linkPath: `
        ?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink .
      `,
    },
    'http://www.w3.org/ns/org#Organization': {
      name: 'Organization',
    },
    'http://www.w3.org/2004/02/skos/core#Concept': {
      name: 'Concept',
      // concept links can have a secondary body with the impact on the concept
      // note have to put filter inside the bind's if because otherwise virtuoso doesn't want to include others as results anymore
      textPath: `
        ?object <http://www.w3.org/2004/02/skos/core#prefLabel> ?prefLabel .
        OPTIONAL {
          ?annotation oa:hasBody ?impact.
        }
        BIND(IF(BOUND(?impact) && ?impact IN (<http://mu.semte.ch/vocabularies/ext/impact/negative>, <http://mu.semte.ch/vocabularies/ext/impact/positive>), CONCAT(?prefLabel, " (",SUBSTR(STR(?impact), 44),")"),?prefLabel) AS ?objectText)
      `,
      linkPath: 'BIND(?object AS ?objectLink)',
    },
  } as {
    [typeUri: string]: { name: string; textPath?: string; linkPath?: string };
  },
  defaultTextPath: `
        ?object <http://www.w3.org/2000/01/rdf-schema#label> ?objectText .
  `,
  defaultLinkPath: `
        ?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink .
  `,
  reviewBodyPrefix: 'http://mu.semte.ch/vocabularies/ext/annotation-review#',
};
