# Annotation Review Service

> [!Warning]
> This service is currently under construction

The annotation review service offers functionality to fetch items with annotations (called targets in the context of this service) and to fetch and modify the annotations for these targets. The normal resource approach cannot be followed here because these annotations often have very complicated formats and the targets themselves may not even have regular properties yet. For instance, a target's title may itself be part of an annotation.

## Endpoints

### GET /health

Returns `{ "status": "ok" }` if the service is running.

### GET /targets/:type

Returns the targets of a certain type together with the total count of such targets, types are configured in the config file.

The response has the format

```json
{
  "targets": [
    {
      "uri": "http://www.example.com/id/33de091e-b8ec-445e-9984-6813bcb36997",
      "id": "33de091e-b8ec-445e-9984-6813bcb36997",
      "title": "some title here",
      "annotationCount": 10
    }
  ],
  "count": 1
}
```

pagination is done by query params `page` and `pageSize`

For filtering, this method accepts query params of the format `?filter[name]=value1,value2&filter[name2]=value3` where the names of the filters are defined in configuration using `targets.filters`.

### GET /annotations/:type/:id

Returns the annotations for the given target type for the target with the given id.

The response has the format

```json
{
  "target": {
    "uri": "http://www.example.com/id/33de091e-b8ec-445e-9984-6813bcb36997",
    "id": "33de091e-b8ec-445e-9984-6813bcb36997",
    "title": "some title here"
  },
  "annotations": [
    {
      "uri": "http://example.org/1ff8e284-070f-4c0b-a390-8eddb3111a96",
      "id": "A612392A-237D-11F1-9258-8C0B7F0C8194",
      "target": "http://some-target.example.com",
      "targetId": "777b593d-50be-44e1-b7bc-a2357dd88fc7",
      "type": "http://data.europa.eu/eli/ontology#based_on",
      "value": "http://some-temp-uri.example.com",
      "valueText": "artikel 74 van het Decreet Lokaal Bestuur\n\nStemmen",
      "valueLink": "http://some-dereferenceable-uri.example.com",
      "agent": "http://example.org/entity-extraction",
      "agentName": "NER",
      "counts": {
        "reject": 1,
        "approve": 2,
        "ownReview": "approve"
      }
    }
  ],
  "annotationCount": 1
}
```

pagination is done by query params `page` and `pageSize`

For filtering, this method accepts query params of the format `?filter[name]=value1,value2&filter[name2]=value3` where the names of the filters are defined in configuration using `targets.filters`.

### GET /annotations/:type/

Returns all annotations for targets of the given type.

The response has the same format as for `GET /annotations/:type/:id` but without the target section. It accepts the same query params.

### POST /review/:annotationId/:result

Stores the user's review. This service currently tracks the user using a SESSION, not an account. This is because in our use-case, we don't want users to register/sign in. If a user reviews the same annotation instance again later, the earlier review is removed (again for the same SESSION).

Note that a review is itself an annotation (with the extra type ext:ReviewAnnotation).

Parameters:

- annotationId: the id of the annotation to review
- result: either `approve` or `reject` as a string

returns the new counts for the annotation:

```json
{
  "reject": 1,
  "approve": 2,
  "ownReview": "approve"
}
```

## Configuration

The configuration specifies the available targets and how to render them. This repository holds a default config file that is mean to be overwritten when it is used in an application, as every application has its own data model. The config file exports a default object with the following properties:

### targets

The targets hold the available types of target as a json object, with the keys being the names of the types. Each type has the format

```json
{
  // some prefixes you can reuse in the other parts of this definition
  "prefixes": "PREFIX eli: <http://data.europa.eu/eli/ontology#>",
  // some sparql snippet to be used to filter the targets, available variables are ?target, ?title and ?annotation
  "targetFilter": "?target a eli:Expression .",
  // some sparql snippet to be used to filter the targets, available variables are ?annotation, ?agent
  "annotationFilter": "VALUES ?agent {   <http://example.org/entity-extraction>  }",
  // filters that can be added to the target request by adding &<filterName>=<filterValue1,filterValue1> to the request params
  "filters": {
    "filterName": {
      "query": "{ ?target ext:importedFor ?municipality . }",
      // the variable name used in the query part to set values for
      "variable": "municipality",
      // type can be uri or string
      "type": "uri"
    }
  },
  // The path to get the title of a target, can be complex if the titles themselves are annotations,
  // see example config for such a case
  "titlePath": "?target eli:title ?title ."
}
```

The only reserved filter name is `ignoreAlreadyReviewed` which, if set to true filters out the annotations that were already reviewed in the current session.

### valueTypes

The valueTypes hold configuration per type of value for an annotation. This allows you to specify how the value should be rendered to text for a user. This is because some annotation values can be complex, e.g. a period of time, which means the annotation body itself is actually also a URI with a set of different properties.

`valueTypes` is a key-value object where the keys are the uri of the types and the values are an object specifying how they should be rendered. In this value, `textPath` connects `?object`, the body of the annotation, to its human readable textual representation of it in the variable `?objectText`. `?linkPath` specifies how to find the URI for the linked entity, if such a uri exists. For instance

```json
{
  "http://xmlns.com/foaf/0.1/Person": {
    "name": "Person",
    "textPath": "?object <http://xmlns.com/foaf/0.1/name> ?objectText .",
    "linkPath": "?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink ."
  },
  "http://www.w3.org/ns/org#Organization": {
    "name": "Organization"
  }
}
```

`?textPath` and `?linkPath` are optional. They can also be defaulted on the top level config file.

### defaultTextPath

The default path for all types to find the textual representation of a value. e.g.

````json
 {
  "defaultTextPath": "?object <http://www.w3.org/2000/01/rdf-schema#label> ?objectText ."
 }


### defaultLinkPath

The default path for all types to find the URI of the value, e.g. in case of a entity linking annotation. e.g.

```json
{
  "defaultLinkPath": "?object <http://www.w3.org/2004/02/skos/core#exactMatch> ?objectLink ."
}
````
