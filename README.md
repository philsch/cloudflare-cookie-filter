cloudflare-cookie-filter
==========================

Cloudflare worker to forward requests to an Origin but filter out Cookies that do not match
certain criteria.

## Usage

The worker supports configuration via the following environment variables:

| Name                 | Required? | Description                                                   | Example         |
|----------------------|-----------|---------------------------------------------------------------|-----------------|
| ORIGIN               | yes       | The origin server to call                                     | srv.example.org |
| COOKIE_PREFIX_FILTER | no        | Prefix filter to remove Cookies not starting with this prefix | abc-            |

The worker forwards request methods, paths and query parameters as is, so you should map a complete subdomain
to this worker and not use any path prefix (to ensure paths are forwarded correctly to the origin).

```
 +------------+                                      +------------+                                       +------------+
 |  Browser   | --POST test.mysite.com/set?id=123--> |    Worker  |  --POST srv.example.org/set?id=123--> |  Origin    |
 +------------+                                      +------------+                                       +------------+
```

## Local development

Learn more at https://developers.cloudflare.com/workers/

- Adjust the environment variables in `[wrangler.toml](wrangler.toml)` to your needs.
- Run `npm run dev` in your terminal to start a development server
- Open a browser tab at http://localhost:8787/ to see your worker in action
