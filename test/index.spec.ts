import {env, createExecutionContext, waitOnExecutionContext} from 'cloudflare:test';
import fetchMock from 'fetch-mock';
import {beforeAll, afterEach, describe, it, expect, afterAll} from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

beforeAll(() => {
    fetchMock
        .get(`https://${env.ORIGIN}`, 200)
        .get(`https://${env.ORIGIN}/with/path?param1=a&param2=b`, 200)
        .post(`https://${env.ORIGIN}/set`, 204);
});
afterAll(() => {
    fetchMock.reset();
});
afterEach(() => {
    fetchMock.resetHistory();
});

describe('Cookie filter worker', () => {
    async function callWorker(url, method, headers = {}, body = '') {
        const requestBody = method === 'GET' ? undefined : body;
        const request = new IncomingRequest(url, {headers, body: requestBody, method});
        const ctx = createExecutionContext();
        await worker.fetch(request, env, ctx);
        await waitOnExecutionContext(ctx);
    }

    it('forwards a simple GET request to the origin', async () => {
        const requestUrl = 'http://example.com';
        const expectedOriginUrl = `https://${env.ORIGIN}`;
        await callWorker(requestUrl, 'GET');

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
    });

    it('forwards request path and parameters', async () => {
        const requestUrl = 'http://example.com/with/path?param1=a&param2=b';
        const expectedOriginUrl = `https://${env.ORIGIN}/with/path?param1=a&param2=b`;
        await callWorker(requestUrl, 'GET');

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
    });

    it('forwards headers', async () => {
        const requestUrl = 'http://example.com';
        const requestHeaders = {
            accept: '*/*',
            'content-type': 'application/json',
        }
        const expectedOriginUrl = `https://${env.ORIGIN}`;
        await callWorker(requestUrl, 'GET', requestHeaders);

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
        const forwardedHeaders = fetchMock.lastCall(expectedOriginUrl)[1]?.headers;
        expect(forwardedHeaders['Accept']).toBe('*/*');
        expect(forwardedHeaders['Content-Type']).toBe('application/json');
    });

    it('forwards Host has X-Forwarded-Host', async () => {
        const requestUrl = 'http://example.com';
        const requestHeaders = {
            'Host': 'example.com',
        }
        const expectedOriginUrl = `https://${env.ORIGIN}`;
        await callWorker(requestUrl, 'GET', requestHeaders);

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
        const forwardedHeaders = fetchMock.lastCall(expectedOriginUrl)[1]?.headers;
        expect(forwardedHeaders['X-Forwarded-Host']).toBe('example.com');
    });

    it('forwards a POST request with body', async () => {
        const requestUrl = 'http://example.com/set';
        const requestBody = JSON.stringify({hello: 'world'});
        const requestHeaders = {
            accept: '*/*',
            'content-type': 'application/json',
        }
        const expectedOriginUrl = `https://${env.ORIGIN}/set`;
        await callWorker(requestUrl, 'POST', requestHeaders, requestBody);

        const forwardedBody = fetchMock.lastOptions().body;
        const {done, value} = await forwardedBody.getReader().read();
        const decoder = new TextDecoder();
        const decodedForwardedBody = decoder.decode(value);

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
        expect(decodedForwardedBody).toBe('{"hello":"world"}');
    });

    it('forwards all cookies if no filter is defined', async () => {
        const customEnv = {...env, COOKIE_PREFIX_FILTER: ''};
        const requestUrl = 'http://example.com';
        const requestHeaders = {
            'Cookie': 'a=1; b=2; c=3',
        }
        const expectedOriginUrl = `https://${env.ORIGIN}`;
        const request = new IncomingRequest(requestUrl, {headers: requestHeaders});
        const ctx = createExecutionContext();
        await worker.fetch(request, customEnv, ctx);
        await waitOnExecutionContext(ctx);

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
        const forwardedHeaders = fetchMock.lastCall(expectedOriginUrl)[1]?.headers;
        expect(forwardedHeaders.Cookie).toBe('a=1; b=2; c=3');
    });

    it('does not forward cookies which names do not match the COOKIE_PREFIX_FILTER', async () => {
        const customEnv = {...env, COOKIE_PREFIX_FILTER: 'prefix-'};
        const requestUrl = 'http://example.com';
        const requestHeaders = {
            'Cookie': 'a=1; b=2; c=3; prefix-d=4; e=5; prefix-f=6',
        }
        const expectedOriginUrl = `https://${env.ORIGIN}`;
        const request = new IncomingRequest(requestUrl, {headers: requestHeaders});
        const ctx = createExecutionContext();
        await worker.fetch(request, customEnv, ctx);
        await waitOnExecutionContext(ctx);

        expect(fetchMock.called(expectedOriginUrl)).toBeTruthy();
        const forwardedHeaders = fetchMock.lastCall(expectedOriginUrl)[1]?.headers;
        expect(forwardedHeaders.Cookie).toBe('prefix-d=4; prefix-f=6');
    });
});
