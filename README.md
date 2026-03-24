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

## Configuration

The configuration specifies the available targets and how to render them. It exports a default object with the following properties:

### targets

The targets hold the available types of target as a json object, with the keys being the names of the types. Each type has the format

```json
{
  // some prefixes you can reuse in the other parts of this definition
  "prefixes": "PREFIX eli: <http://data.europa.eu/eli/ontology#>",
  // some sparql snippet to be used to filter the targets, available variables are ?target, ?title and ?annotation
  "targetFilters": "?target a eli:Expression .",
  // TODO this format is still unstable, it will be the possible filters to be passed in by the frontend
  "filters": {},
  // The path to get the title of a target, can be complex if the titles themselves are annotations,
  // see example config for such a case
  "titlePath": "?target eli:title ?title ."
}
```
