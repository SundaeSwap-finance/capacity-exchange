
# ApiAdaOffersPostRequest


## Properties

Name | Type
------------ | -------------
`quoteId` | string
`offerCurrency` | string
`utxoTxHash` | string
`senderAddress` | string
`expectedValue` | string

## Example

```typescript
import type { ApiAdaOffersPostRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "quoteId": null,
  "offerCurrency": null,
  "utxoTxHash": null,
  "senderAddress": null,
  "expectedValue": null,
} satisfies ApiAdaOffersPostRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiAdaOffersPostRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


