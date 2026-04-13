# DefaultApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**apiMetricsGet**](DefaultApi.md#apimetricsget) | **GET** /api/metrics |  |
| [**apiOffersPost**](DefaultApi.md#apiofferspostoperation) | **POST** /api/offers |  |
| [**apiPricesGet**](DefaultApi.md#apipricesget) | **GET** /api/prices |  |
| [**apiSponsorPost**](DefaultApi.md#apisponsorpostoperation) | **POST** /api/sponsor |  |
| [**healthGet**](DefaultApi.md#healthget) | **GET** /health/ |  |
| [**healthReadyGet**](DefaultApi.md#healthreadyget) | **GET** /health/ready |  |
| [**rootGet**](DefaultApi.md#rootget) | **GET** / |  |



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


## apiOffersPost

> ApiOffersPost201Response apiOffersPost(apiOffersPostRequest)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiOffersPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // ApiOffersPostRequest
    apiOffersPostRequest: ...,
  } satisfies ApiOffersPostOperationRequest;

  try {
    const data = await api.apiOffersPost(body);
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
| **apiOffersPostRequest** | [ApiOffersPostRequest](ApiOffersPostRequest.md) |  | |

### Return type

[**ApiOffersPost201Response**](ApiOffersPost201Response.md)

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
| **503** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## apiPricesGet

> ApiPricesGet200Response apiPricesGet(amount, currency)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiPricesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    amount: amount_example,
    // 'DUST'
    currency: currency_example,
  } satisfies ApiPricesGetRequest;

  try {
    const data = await api.apiPricesGet(body);
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
| **currency** | `DUST` |  | [Defaults to `undefined`] [Enum: DUST] |

### Return type

[**ApiPricesGet200Response**](ApiPricesGet200Response.md)

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


## apiSponsorPost

> ApiSponsorPost200Response apiSponsorPost(apiSponsorPostRequest)



### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ApiSponsorPostOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // ApiSponsorPostRequest
    apiSponsorPostRequest: ...,
  } satisfies ApiSponsorPostOperationRequest;

  try {
    const data = await api.apiSponsorPost(body);
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
| **apiSponsorPostRequest** | [ApiSponsorPostRequest](ApiSponsorPostRequest.md) |  | |

### Return type

[**ApiSponsorPost200Response**](ApiSponsorPost200Response.md)

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

