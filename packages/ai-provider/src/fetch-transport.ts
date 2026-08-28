import type { HttpRequest, HttpResponse, HttpTransport } from './contracts.js';

export class FetchHttpTransport implements HttpTransport {
  async send(request: HttpRequest): Promise<HttpResponse> {
    return fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: request.signal,
    });
  }
}
