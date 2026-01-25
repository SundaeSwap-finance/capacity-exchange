import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, ConfigurationOptions } from '../configuration'
import type { Middleware } from '../middleware';

import { ApiOffersPost201Response } from '../models/ApiOffersPost201Response';
import { ApiOffersPostRequest } from '../models/ApiOffersPostRequest';
import { ApiPricesGet200Response } from '../models/ApiPricesGet200Response';
import { ApiPricesGet200ResponsePricesInner } from '../models/ApiPricesGet200ResponsePricesInner';
import { ApiPricesGet400Response } from '../models/ApiPricesGet400Response';
import { Get200Response } from '../models/Get200Response';
import { Get200ResponseEnv } from '../models/Get200ResponseEnv';
import { HealthGet200Response } from '../models/HealthGet200Response';
import { HealthReadyGet200Response } from '../models/HealthReadyGet200Response';
import { HealthReadyGet200ResponseAnyOf } from '../models/HealthReadyGet200ResponseAnyOf';
import { HealthReadyGet200ResponseAnyOf1 } from '../models/HealthReadyGet200ResponseAnyOf1';
import { HealthReadyGet200ResponseAnyOf2 } from '../models/HealthReadyGet200ResponseAnyOf2';
import { HealthReadyGet200ResponseAnyOfIndexer } from '../models/HealthReadyGet200ResponseAnyOfIndexer';
import { HealthReadyGet200ResponseAnyOfIndexerAnyOf } from '../models/HealthReadyGet200ResponseAnyOfIndexerAnyOf';
import { HealthReadyGet200ResponseAnyOfIndexerAnyOf1 } from '../models/HealthReadyGet200ResponseAnyOfIndexerAnyOf1';
import { HealthReadyGet200ResponseAnyOfWallet } from '../models/HealthReadyGet200ResponseAnyOfWallet';
import { HealthReadyGet200ResponseAnyOfWalletAnyOf } from '../models/HealthReadyGet200ResponseAnyOfWalletAnyOf';
import { HealthReadyGet200ResponseAnyOfWalletAnyOf1 } from '../models/HealthReadyGet200ResponseAnyOfWalletAnyOf1';
import { HealthReadyGet200ResponseAnyOfWalletAnyOf2 } from '../models/HealthReadyGet200ResponseAnyOfWalletAnyOf2';

import { ObservableDefaultApi } from "./ObservableAPI";
import { DefaultApiRequestFactory, DefaultApiResponseProcessor} from "../apis/DefaultApi";

export interface DefaultApiApiOffersPostRequest {
    /**
     * 
     * @type ApiOffersPostRequest
     * @memberof DefaultApiapiOffersPost
     */
    apiOffersPostRequest: ApiOffersPostRequest
}

export interface DefaultApiApiPricesGetRequest {
    /**
     * 
     * Defaults to: undefined
     * @type string
     * @memberof DefaultApiapiPricesGet
     */
    dust: string
}

export interface DefaultApiHealthGetRequest {
}

export interface DefaultApiHealthReadyGetRequest {
}

export interface DefaultApiRootGetRequest {
}

export class ObjectDefaultApi {
    private api: ObservableDefaultApi

    public constructor(configuration: Configuration, requestFactory?: DefaultApiRequestFactory, responseProcessor?: DefaultApiResponseProcessor) {
        this.api = new ObservableDefaultApi(configuration, requestFactory, responseProcessor);
    }

    /**
     * @param param the request object
     */
    public apiOffersPostWithHttpInfo(param: DefaultApiApiOffersPostRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiOffersPost201Response>> {
        return this.api.apiOffersPostWithHttpInfo(param.apiOffersPostRequest,  options).toPromise();
    }

    /**
     * @param param the request object
     */
    public apiOffersPost(param: DefaultApiApiOffersPostRequest, options?: ConfigurationOptions): Promise<ApiOffersPost201Response> {
        return this.api.apiOffersPost(param.apiOffersPostRequest,  options).toPromise();
    }

    /**
     * @param param the request object
     */
    public apiPricesGetWithHttpInfo(param: DefaultApiApiPricesGetRequest, options?: ConfigurationOptions): Promise<HttpInfo<ApiPricesGet200Response>> {
        return this.api.apiPricesGetWithHttpInfo(param.dust,  options).toPromise();
    }

    /**
     * @param param the request object
     */
    public apiPricesGet(param: DefaultApiApiPricesGetRequest, options?: ConfigurationOptions): Promise<ApiPricesGet200Response> {
        return this.api.apiPricesGet(param.dust,  options).toPromise();
    }

    /**
     * @param param the request object
     */
    public healthGetWithHttpInfo(param: DefaultApiHealthGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<HealthGet200Response>> {
        return this.api.healthGetWithHttpInfo( options).toPromise();
    }

    /**
     * @param param the request object
     */
    public healthGet(param: DefaultApiHealthGetRequest = {}, options?: ConfigurationOptions): Promise<HealthGet200Response> {
        return this.api.healthGet( options).toPromise();
    }

    /**
     * @param param the request object
     */
    public healthReadyGetWithHttpInfo(param: DefaultApiHealthReadyGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<HealthReadyGet200Response>> {
        return this.api.healthReadyGetWithHttpInfo( options).toPromise();
    }

    /**
     * @param param the request object
     */
    public healthReadyGet(param: DefaultApiHealthReadyGetRequest = {}, options?: ConfigurationOptions): Promise<HealthReadyGet200Response> {
        return this.api.healthReadyGet( options).toPromise();
    }

    /**
     * @param param the request object
     */
    public rootGetWithHttpInfo(param: DefaultApiRootGetRequest = {}, options?: ConfigurationOptions): Promise<HttpInfo<Get200Response>> {
        return this.api.rootGetWithHttpInfo( options).toPromise();
    }

    /**
     * @param param the request object
     */
    public rootGet(param: DefaultApiRootGetRequest = {}, options?: ConfigurationOptions): Promise<Get200Response> {
        return this.api.rootGet( options).toPromise();
    }

}
