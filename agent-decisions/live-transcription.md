# Live transcription integration

## Goal
Add microphone-driven transcription to the multi-modal console so that the text transcript panel mirrors the user's spoken audio in real time while a session is running.

## Key decisions
- **Web Speech API reuse**: Leveraged the browser's built-in `SpeechRecognition` / `webkitSpeechRecognition` interface instead of introducing a third-party dependency. This keeps the bundle small and works entirely on-device, aligning with the existing local capture pipeline.
- **State model**: Stored final transcript text in the existing `textInput` state and layered an `interimTranscript` state for partial hypotheses. A memoized `displayedTranscript` merges them for rendering so that interim speech never pollutes the payload sent to the backend.
- **Lifecycle management**: Introduced a dedicated `startTranscription` / `stopTranscription` pair that is coordinated with the session lifecycle. A ref-driven `shouldRestartRecognitionRef` gate prevents unwanted auto-restarts when users stop the session or permissions are revoked.
- **User feedback**: Added UI affordances and error messaging to surface transcription status, permission issues, and fallback guidance when the browser lacks speech recognition support.
- **User activation preservation**: Start the speech recognizer immediately after microphone permission is granted—before heavier async setup like model loading—to keep the call within the browser's user-gesture window and avoid silent failures on `recognition.start()`.

## Follow-ups
- Consider persisting speaker language preferences rather than deferring to `navigator.language`.
- Evaluate chunking or punctuation post-processing if the raw Web Speech stream proves too noisy for downstream emotion analysis.
