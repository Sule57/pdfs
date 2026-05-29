/**
 * Optional Cloudflare Worker: adds COOP/COEP/CORP to GitHub Pages responses.
 * Deploy: npx wrangler deploy (see wrangler.toml)
 */
const GITHUB_PAGES_HOST = 'sule57.github.io'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const originUrl = `https://${GITHUB_PAGES_HOST}${url.pathname}${url.search}`

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    })
    originRequest.headers.set('Host', url.hostname)

    const response = await fetch(originRequest)
    const headers = new Headers(response.headers)
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
