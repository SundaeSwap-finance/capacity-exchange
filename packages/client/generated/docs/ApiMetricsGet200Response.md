
# ApiMetricsGet200Response


## Properties

Name | Type
------------ | -------------
`server` | [ApiMetricsGet200ResponseServer](ApiMetricsGet200ResponseServer.md)
`health` | [ApiMetricsGet200ResponseHealth](ApiMetricsGet200ResponseHealth.md)
`dustUsage` | [ApiMetricsGet200ResponseDustUsage](ApiMetricsGet200ResponseDustUsage.md)
`revenue` | [ApiMetricsGet200ResponseRevenue](ApiMetricsGet200ResponseRevenue.md)
`contention` | [ApiMetricsGet200ResponseContention](ApiMetricsGet200ResponseContention.md)

## Example

```typescript
import type { ApiMetricsGet200Response } from ''

// TODO: Update the object below with actual values
const example = {
  "server": null,
  "health": null,
  "dustUsage": null,
  "revenue": null,
  "contention": null,
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


