import { ResponseContext, RequestContext, HttpFile, HttpInfo } from '../http/http';
import { Configuration, ConfigurationOptions, mergeConfiguration } from '../configuration'
import type { Middleware } from '../middleware';
import { Observable, of, from } from '../rxjsStub';
import {mergeMap, map} from  '../rxjsStub';
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

import { DefaultApiRequestFactory, DefaultApiResponseProcessor} from "../apis/DefaultApi";
export class ObservableDefaultApi {
    private requestFactory: DefaultApiRequestFactory;
    private responseProcessor: DefaultApiResponseProcessor;
    private configuration: Configuration;

    public constructor(
        configuration: Configuration,
        requestFactory?: DefaultApiRequestFactory,
        responseProcessor?: DefaultApiResponseProcessor
    ) {
        this.configuration = configuration;
        this.requestFactory = requestFactory || new DefaultApiRequestFactory(configuration);
        this.responseProcessor = responseProcessor || new DefaultApiResponseProcessor();
    }

    /**
     * @param apiOffersPostRequest
     */
    public apiOffersPostWithHttpInfo(apiOffersPostRequest: ApiOffersPostRequest, _options?: ConfigurationOptions): Observable<HttpInfo<ApiOffersPost201Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiOffersPost(apiOffersPostRequest, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiOffersPostWithHttpInfo(rsp)));
            }));
    }

    /**
     * @param apiOffersPostRequest
     */
    public apiOffersPost(apiOffersPostRequest: ApiOffersPostRequest, _options?: ConfigurationOptions): Observable<ApiOffersPost201Response> {
        return this.apiOffersPostWithHttpInfo(apiOffersPostRequest, _options).pipe(map((apiResponse: HttpInfo<ApiOffersPost201Response>) => apiResponse.data));
    }

    /**
     * @param dust
     */
    public apiPricesGetWithHttpInfo(dust: string, _options?: ConfigurationOptions): Observable<HttpInfo<ApiPricesGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.apiPricesGet(dust, _config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.apiPricesGetWithHttpInfo(rsp)));
            }));
    }

    /**
     * @param dust
     */
    public apiPricesGet(dust: string, _options?: ConfigurationOptions): Observable<ApiPricesGet200Response> {
        return this.apiPricesGetWithHttpInfo(dust, _options).pipe(map((apiResponse: HttpInfo<ApiPricesGet200Response>) => apiResponse.data));
    }

    /**
     */
    public healthGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<HealthGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.healthGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.healthGetWithHttpInfo(rsp)));
            }));
    }

    /**
     */
    public healthGet(_options?: ConfigurationOptions): Observable<HealthGet200Response> {
        return this.healthGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<HealthGet200Response>) => apiResponse.data));
    }

    /**
     */
    public healthReadyGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<HealthReadyGet200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.healthReadyGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.healthReadyGetWithHttpInfo(rsp)));
            }));
    }

    /**
     */
    public healthReadyGet(_options?: ConfigurationOptions): Observable<HealthReadyGet200Response> {
        return this.healthReadyGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<HealthReadyGet200Response>) => apiResponse.data));
    }

    /**
     */
    public rootGetWithHttpInfo(_options?: ConfigurationOptions): Observable<HttpInfo<Get200Response>> {
        const _config = mergeConfiguration(this.configuration, _options);

        const requestContextPromise = this.requestFactory.rootGet(_config);
        // build promise chain
        let middlewarePreObservable = from<RequestContext>(requestContextPromise);
        for (const middleware of _config.middleware) {
            middlewarePreObservable = middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => middleware.pre(ctx)));
        }

        return middlewarePreObservable.pipe(mergeMap((ctx: RequestContext) => _config.httpApi.send(ctx))).
            pipe(mergeMap((response: ResponseContext) => {
                let middlewarePostObservable = of(response);
                for (const middleware of _config.middleware.reverse()) {
                    middlewarePostObservable = middlewarePostObservable.pipe(mergeMap((rsp: ResponseContext) => middleware.post(rsp)));
                }
                return middlewarePostObservable.pipe(map((rsp: ResponseContext) => this.responseProcessor.rootGetWithHttpInfo(rsp)));
            }));
    }

    /**
     */
    public rootGet(_options?: ConfigurationOptions): Observable<Get200Response> {
        return this.rootGetWithHttpInfo(_options).pipe(map((apiResponse: HttpInfo<Get200Response>) => apiResponse.data));
    }

}
