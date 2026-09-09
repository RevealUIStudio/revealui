export {
  createLocalTtsAdapter,
  createWebSpeechAdapter,
  type LocalTtsClient,
  resolveSpeechAdapter,
  type SpeechAdapter,
  type SpeechSynthesisLike,
  type SpeechUtteranceLike,
} from './adapter';
export {
  configureSpeakBack,
  getSpeakBackConfig,
  resetSpeakBackConfig,
  type SpeakBackConfig,
} from './config';
export {
  containsSecretShapedText,
  requestSpeakBack,
  type SpeakBackReason,
  type SpeakBackRequest,
  type SpeakBackResult,
} from './policy';
export { readSpeakBackEnabled, writeSpeakBackEnabled } from './preference';
export { useSpeakBack } from './use-speak-back';
