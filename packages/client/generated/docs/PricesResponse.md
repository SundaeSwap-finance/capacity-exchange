
# PricesResponse


## Properties

Name | Type
------------ | -------------
`quoteId` | string
`prices` | [Array&lt;Price&gt;](Price.md)

## Example

```typescript
import type { PricesResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "quoteId": null,
  "prices": null,
} satisfies PricesResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PricesResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


