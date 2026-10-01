
# ApiMidnightOffersPost201Response


## Properties

Name | Type
------------ | -------------
`offerId` | string
`offerAmount` | string
`offerCurrency` | [ApiPricesGet200ResponsePricesInnerCurrency](ApiPricesGet200ResponsePricesInnerCurrency.md)
`serializedTx` | string
`expiresAt` | Date

## Example

```typescript
import type { ApiMidnightOffersPost201Response } from ''

// TODO: Update the object below with actual values
const example = {
  "offerId": null,
  "offerAmount": null,
  "offerCurrency": null,
  "serializedTx": null,
  "expiresAt": null,
} satisfies ApiMidnightOffersPost201Response

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiMidnightOffersPost201Response
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


