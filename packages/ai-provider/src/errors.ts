export type AiProviderErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'BAD_RESPONSE'
  | 'MODEL_UNAVAILABLE';

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiProviderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}
