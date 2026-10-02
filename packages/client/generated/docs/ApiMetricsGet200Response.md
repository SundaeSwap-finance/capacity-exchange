
# ApiMetricsGet200Response


## Properties

Name | Type
------------ | -------------
`server` | [ApiMetricsGet200ResponseServer](ApiMetricsGet200ResponseServer.md)
`capacity` | [Array&lt;ApiMetricsGet200ResponseCapacityInner&gt;](ApiMetricsGet200ResponseCapacityInner.md)
`revenue` | [ApiMetricsGet200ResponseRevenue](ApiMetricsGet200ResponseRevenue.md)

## Example

```typescript
import type { ApiMetricsGet200Response } from ''

// TODO: Update the object below with actual values
const example = {
  "server": null,
  "capacity": null,
  "revenue": null,
} satisfies ApiMetricsGet200Response

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiMetricsGet200Response
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


