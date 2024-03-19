import {parse, serialize} from 'cookie';

type ParsedCookies = Record<string, string>;

export interface Env {
    // defines the origin server requests are forwarded to
    ORIGIN: string;
    // if set, all cookies that do not start with this prefix are filtered out
    COOKIE_PREFIX_FILTER: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        /**
         * Filters out all Cookies that are not matching the given filter conditions.
         * Returns the already serialized Cookie header.
         *
         * @param request
         * @returns filtered and serialized cookie header
         */
        function filterCookies(request: Request): string {
            const cookies = parse(request.headers.get('cookie') ?? '') as ParsedCookies;

            const filteredCookies: string[] = [];

            // if filter condition is given, skip cookies that are not matching
            for (const [key, value] of Object.entries(cookies)) {
                if (env.COOKIE_PREFIX_FILTER && !key.startsWith(env.COOKIE_PREFIX_FILTER)) {
                    continue;
                }
                filteredCookies.push(serialize(key, value));
            }

            return filteredCookies.join('; ')
        }

        /**
         * Forward the request to the origin server including the Host header
         *
         * @param request
         */
        async function callOrigin(request: Request) {
            const {url, method, headers, body} = request;
            const requestUrl = new URL(url);

            const originHeaders = {
                'X-Forwarded-Host': headers.get('host') ?? '',
                Referer: headers.get('referer') ?? '',
                Origin: headers.get('origin') ?? '',
                'Content-Type': headers.get('content-type') ?? '',
                Accept: headers.get('accept') ?? '',
                Cookie: filterCookies(request),
            };

            const originUrl = `https://${env.ORIGIN}${requestUrl.pathname}${requestUrl.search}`;

            return fetch(
                originUrl,
                {
                    method,
                    headers: originHeaders,
                    body
                }
            );
        }

        return callOrigin(request);
    },
};
