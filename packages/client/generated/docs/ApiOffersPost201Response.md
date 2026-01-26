
# ApiOffersPost201Response


## Properties

Name | Type
------------ | -------------
`offerId` | string
`offerAmount` | string
`offerCurrency` | string
`serializedTx` | string
`expiresAt` | Date

## Example

```typescript
import type { ApiOffersPost201Response } from ''

// TODO: Update the object below with actual values
const example = {
  "offerId": null,
  "offerAmount": null,
  "offerCurrency": null,
  "serializedTx": null,
  "expiresAt": null,
} satisfies ApiOffersPost201Response

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiOffersPost201Response
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


