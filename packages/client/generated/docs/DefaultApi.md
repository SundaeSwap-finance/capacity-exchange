# DefaultApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiCardanoPricesGet**](DefaultApi.md#apicardanopricesget) | **GET** /api/cardano/prices |  |
| [**apiMetricsGet**](DefaultApi.md#apimetricsget) | **GET** /api/metrics |  |
| [**apiMidnightAdaOffersPost**](DefaultApi.md#apimidnightadaofferspostoperation) | **POST** /api/midnight/ada/offers |  |
| [**apiMidnightOffersPost**](DefaultApi.md#apimidnightofferspostoperation) | **POST** /api/midnight/offers |  |
| [**apiMidnightPricesGet**](DefaultApi.md#apimidnightpricesget) | **GET** /api/midnight/prices |  |
| [**apiMidnightSponsorPost**](DefaultApi.md#apimidnightsponsorpostoperation) | **POST** /api/midnight/sponsor |  |
| [**healthGet**](DefaultApi.md#healthget) | **GET** /health/ |  |
| [**healthReadyGet**](DefaultApi.md#healthreadyget) | **GET** /health/ready |  |
| [**rootGet**](DefaultApi.md#rootget) | **GET** / |  |



## apiCardanoPricesGet

> PricesResponse apiCardanoPricesGet(amount)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiCardanoPricesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    amount: amount_example,
  } satisfies ApiCardanoPricesGetRequest;

  try {
    const data = await api.apiCardanoPricesGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **amount** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PricesResponse**](PricesResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Default Response |  -  |
| **500** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiMetricsGet

> ApiMetricsGet200Response apiMetricsGet()



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiMetricsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.apiMetricsGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiMetricsGet200Response**](ApiMetricsGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiMidnightAdaOffersPost

> ApiMidnightOffersPost201Response apiMidnightAdaOffersPost(apiMidnightAdaOffersPostRequest)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiMidnightAdaOffersPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // ApiMidnightAdaOffersPostRequest
    apiMidnightAdaOffersPostRequest: ...,
  } satisfies ApiMidnightAdaOffersPostOperationRequest;

  try {
    const data = await api.apiMidnightAdaOffersPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **apiMidnightAdaOffersPostRequest** | [ApiMidnightAdaOffersPostRequest](ApiMidnightAdaOffersPostRequest.md) |  | |

### Return type

[**ApiMidnightOffersPost201Response**](ApiMidnightOffersPost201Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Default Response |  -  |
| **400** | Default Response |  -  |
| **404** | Default Response |  -  |
| **409** | Default Response |  -  |
| **410** | Default Response |  -  |
| **500** | Default Response |  -  |
| **501** | Default Response |  -  |
| **503** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiMidnightOffersPost

> ApiMidnightOffersPost201Response apiMidnightOffersPost(apiMidnightOffersPostRequest)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiMidnightOffersPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // ApiMidnightOffersPostRequest
    apiMidnightOffersPostRequest: ...,
  } satisfies ApiMidnightOffersPostOperationRequest;

  try {
    const data = await api.apiMidnightOffersPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **apiMidnightOffersPostRequest** | [ApiMidnightOffersPostRequest](ApiMidnightOffersPostRequest.md) |  | |

### Return type

[**ApiMidnightOffersPost201Response**](ApiMidnightOffersPost201Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Default Response |  -  |
| **400** | Default Response |  -  |
| **409** | Default Response |  -  |
| **410** | Default Response |  -  |
| **500** | Default Response |  -  |
| **501** | Default Response |  -  |
| **503** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiMidnightPricesGet

> PricesResponse apiMidnightPricesGet(amount)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiMidnightPricesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    amount: amount_example,
  } satisfies ApiMidnightPricesGetRequest;

  try {
    const data = await api.apiMidnightPricesGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **amount** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PricesResponse**](PricesResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Default Response |  -  |
| **500** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiMidnightSponsorPost

> ApiMidnightSponsorPost200Response apiMidnightSponsorPost(apiMidnightSponsorPostRequest)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiMidnightSponsorPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // ApiMidnightSponsorPostRequest
    apiMidnightSponsorPostRequest: ...,
  } satisfies ApiMidnightSponsorPostOperationRequest;

  try {
    const data = await api.apiMidnightSponsorPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **apiMidnightSponsorPostRequest** | [ApiMidnightSponsorPostRequest](ApiMidnightSponsorPostRequest.md) |  | |

### Return type

[**ApiMidnightSponsorPost200Response**](ApiMidnightSponsorPost200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **422** | Default Response |  -  |
| **500** | Default Response |  -  |
| **501** | Default Response |  -  |
| **503** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthGet

> HealthGet200Response healthGet()



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { HealthGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.healthGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**HealthGet200Response**](HealthGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## healthReadyGet

> HealthReadyGet200Response healthReadyGet()



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { HealthReadyGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.healthReadyGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**HealthReadyGet200Response**](HealthReadyGet200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **500** | Default Response |  -  |
| **503** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## rootGet

> Get200Response rootGet()



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { RootGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.rootGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Get200Response**](Get200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

