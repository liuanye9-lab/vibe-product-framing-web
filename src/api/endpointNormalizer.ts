/**
 * Re-export from shared normalizer for frontend use.
 */
export {
  normalizeOpenAICompatibleEndpoint,
  runEndpointNormalizerSelfTest,
  type EndpointKind,
  type NormalizedEndpointResult,
  type EndpointSelfTestCase,
} from '../../shared/endpointNormalizer';
