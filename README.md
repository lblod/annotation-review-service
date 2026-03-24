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
      "type": "http://data.europa.eu/eli/ontology#based_on",
      "value": "artikel 74 van het Decreet Lokaal Bestuur\n\nStemmen",
      "agent": "http://example.org/entity-extraction",
      "agentName": "NER"
    }
  ],
  "annotationCount": 1
}
```

pagination is done by query params `page` and `pageSize`

## Configuration

The configuration specifies the available targets and how to render them. It exports a default object with the following properties:

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
  // TODO this format is still unstable, it will be the possible filters to be passed in by the frontend
  "filters": {},
  // The path to get the title of a target, can be complex if the titles themselves are annotations,
  // see example config for such a case
  "titlePath": "?target eli:title ?title ."
}
```
