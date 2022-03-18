import { Logger } from "../logging/logger.js";
import {
    ESAggregateParams,
    ESAggregateResponse,
    ESSearchParams,
    ESSearchResponse
} from "./types";

import {Client, ClientOptions} from '@elastic/elasticsearch';

export class ElasticSearchClient {
    client: any;
    index: string;

    constructor(clientOptions: ClientOptions, index: string) {
        this.client = new Client(clientOptions);
        this.index = index;
    }

    async aggregateQuery(params: ESAggregateParams): Promise<ESAggregateResponse> {
        const order: Record<any,any>[] = []
        if (params.order_by === 'count') {
            order.push({'_count': params.order_how})
        } else if (params.order_by === 'value') {
            order.push({'_key': params.order_how})
        }

        const requestBody: any = {
            _source: [],
            // query: { //TODO
            //     bool: {
            //         filter: [
            //             {term: {'host.account': 'test'}}, // implicit filter based on x-rh-identity
            //         ]
            //     }
            // },
            size: 0,
            aggs: {
                [params.field]: {
                    terms: {
                        field: params.field,
                        size: '10000', //TODO parameterize
                        order: order,
                        show_term_doc_count_error: true
                    }
                }
            }
        }

        if (params.fieldFilter && params.fieldFilter.search) {
            const search = params.fieldFilter.search;
            if (search.eq) {
                requestBody.aggs[params.field].terms.include = [search.eq];
            } else if (search.regex) {
                requestBody.aggs[params.field].terms.include = search.regex;
            }
        }

        const searchRequest: any = {
            index: this.index,
            body: requestBody
        };

        try {
            const {body} = await this.client.search(searchRequest);
            Logger.debug('Elasticsearch query', {request: searchRequest, response: body});

            const page = this.extractPage(
                body.aggregations[params.field].buckets,
                params.limit,
                params.offset
            );

            return {
                field: params.field,
                data: page.map(bucket => ({
                    value: bucket.key,
                    count: bucket.doc_count
                })),
                total: body.aggregations[params.field].buckets.length
            };
        } catch (e) {
            Logger.debug('Failed Elasticsearch query', {request: searchRequest})
            throw e
        }
    }

    extractPage(list: any[], limit: number, offset: number): any[] {
        return list.slice(offset, offset + limit);
    }

    async search(params: ESSearchParams): Promise<ESSearchResponse> {
        const response: ESSearchResponse = {
            data: [],
            total: 0
        }

        const searchRequest: any = {
            index: this.index,
            filter_path: 'hits.hits._source,hits.total',
            body: {}
        };

        //source fields
        if (params.sourceFields !== undefined) {
            searchRequest.body._source = params.sourceFields;
        }

        //sort
        const sort: any = {};
        if (params.order_by !== undefined && params.order_how !== undefined) {
            sort[params.order_by] = params.order_how;
        }
        searchRequest.body.sort = [sort];

        //pagination
        if (params.offset !== undefined) {
            searchRequest.body.from = params.offset;
        }
        if (params.limit !== undefined) {
            searchRequest.body.size = params.limit;
        }

        //filter
        if (params.filter !== undefined) {
            searchRequest.body.query = {
                bool: {
                    filter: params.filter
                }
            };
        }

        //do the request
        try {
            const {body} = await this.client.search(searchRequest);
            Logger.debug('Elasticsearch query', {request: searchRequest, response: body});

            if (body.hits?.hits != null) {
                response.data = body.hits.hits.map((d: any) => d._source[params.rootField.toLowerCase()])
                response.total = body.hits.total.value;
            }
        } catch (e) {
            Logger.debug('Failed Elasticsearch query', {request: searchRequest})
            throw e
        }
        return response;
    }
}
