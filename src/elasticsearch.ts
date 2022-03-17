import {ApolloError, UserInputError} from "apollo-server-express";

export function checkMin(min: number, value: number | null | undefined): void {
    if (value === null || value === undefined) {
        return;
    }

    if (value < min) {
        throw new UserInputError(`value must be ${min} or greater (was ${value})`);
    }
}

export function checkMax(max: number, value: number | null | undefined): void {
    if (value === null || value === undefined) {
        return;
    }

    if (value > max) {
        throw new UserInputError(`value must be ${max} or less (was ${value})`);
    }
}

export function checkLimit(limit: number | null | undefined): void {
    checkMin(0, limit);
    checkMax(100, limit);
}

export function checkOffset(offset: number | null | undefined): void {
    checkMin(0, offset);
}

export function defaultValue(value: number | undefined | null, def: number): number {
    if (value === undefined || value === null) {
        return def;
    }

    return value;
}

export function extractPage(list: any, limit: number, offset: number): any {
    return list.slice(offset, offset + limit);
}

export class ElasticSearchError extends ApolloError {
    constructor(originalError: any, message = 'Elastic search error', code = 'ELASTIC_SEARCH_ERROR') {
        super(message, code, {originalError});
    }
}

export class ResultWindowError extends ElasticSearchError {
    constructor(originalError: any,
                message = 'Request could not be completed because the page is too deep',
                code = 'REQUEST_WINDOW_ERROR')
    {
        super(originalError, message, code);
    }
}
