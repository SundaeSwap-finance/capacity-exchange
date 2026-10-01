
# ApiMetricsGet200ResponseCapacityInner


## Properties

Name | Type
------------ | -------------
`asset` | string
`available` | string
`consumedTotal` | string
`consumedLastHour` | string
`locksLastHour` | number
`contention` | [ApiMetricsGet200ResponseCapacityInnerContention](ApiMetricsGet200ResponseCapacityInnerContention.md)

## Example

```typescript
import type { ApiMetricsGet200ResponseCapacityInner } from ''

// TODO: Update the object below with actual values
const example = {
  "asset": null,
  "available": null,
  "consumedTotal": null,
  "consumedLastHour": null,
  "locksLastHour": null,
  "contention": null,
} satisfies ApiMetricsGet200ResponseCapacityInner

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiMetricsGet200ResponseCapacityInner
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


