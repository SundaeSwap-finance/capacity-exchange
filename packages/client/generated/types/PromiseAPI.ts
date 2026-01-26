import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, PromiseConfigurationOptions, wrapOptions } from '../configuration'
import { PromiseMiddleware, Middleware, PromiseMiddlewareWrapper } from '../middleware';

import { ApiOffersPost201Response } from '../models/ApiOffersPost201Response';
import { ApiOffersPostRequest } from '../models/ApiOffersPostRequest';
import { ApiPricesGet200Response } from '../models/ApiPricesGet200Response';
import { ApiPricesGet200ResponsePricesInner } from '../models/ApiPricesGet200ResponsePricesInner';
import { ApiPricesGet400Response } from '../models/ApiPricesGet400Response';
import { Get200Response } from '../models/Get200Response';
import { Get200ResponseEnv } from '../models/Get200ResponseEnv';
import { HealthGet200Response } from '../models/HealthGet200Response';
import { HealthReadyGet200Response } from '../models/HealthReadyGet200Response';
import { HealthReadyGet200ResponseIndexer } from '../models/HealthReadyGet200ResponseIndexer';
import { HealthReadyGet200ResponseWallet } from '../models/HealthReadyGet200ResponseWallet';
import { ObservableDefaultApi } from './ObservableAPI';

import { DefaultApiRequestFactory, DefaultApiResponseProcessor} from "../apis/DefaultApi";
export class PromiseDefaultApi {
    private api: ObservableDefaultApi

    public constructor(
        configuration: Configuration,
        requestFactory?: DefaultApiRequestFactory,
        responseProcessor?: DefaultApiResponseProcessor
    ) {
        this.api = new ObservableDefaultApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * @param apiOffersPostRequest
     */
    public apiOffersPostWithHttpInfo(apiOffersPostRequest: ApiOffersPostRequest, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiOffersPost201Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiOffersPostWithHttpInfo(apiOffersPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * @param apiOffersPostRequest
     */
    public apiOffersPost(apiOffersPostRequest: ApiOffersPostRequest, _options?: PromiseConfigurationOptions): Promise<ApiOffersPost201Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiOffersPost(apiOffersPostRequest, observableOptions);
        return result.toPromise();
    }

    /**
     * @param dust
     */
    public apiPricesGetWithHttpInfo(dust: string, _options?: PromiseConfigurationOptions): Promise<HttpInfo<ApiPricesGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPricesGetWithHttpInfo(dust, observableOptions);
        return result.toPromise();
    }

    /**
     * @param dust
     */
    public apiPricesGet(dust: string, _options?: PromiseConfigurationOptions): Promise<ApiPricesGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.apiPricesGet(dust, observableOptions);
        return result.toPromise();
    }

    /**
     */
    public healthGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<HealthGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.healthGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     */
    public healthGet(_options?: PromiseConfigurationOptions): Promise<HealthGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.healthGet(observableOptions);
        return result.toPromise();
    }

    /**
     */
    public healthReadyGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<HealthReadyGet200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.healthReadyGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     */
    public healthReadyGet(_options?: PromiseConfigurationOptions): Promise<HealthReadyGet200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.healthReadyGet(observableOptions);
        return result.toPromise();
    }

    /**
     */
    public rootGetWithHttpInfo(_options?: PromiseConfigurationOptions): Promise<HttpInfo<Get200Response>> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.rootGetWithHttpInfo(observableOptions);
        return result.toPromise();
    }

    /**
     */
    public rootGet(_options?: PromiseConfigurationOptions): Promise<Get200Response> {
        const observableOptions = wrapOptions(_options);
        const result = this.api.rootGet(observableOptions);
        return result.toPromise();
    }


}



