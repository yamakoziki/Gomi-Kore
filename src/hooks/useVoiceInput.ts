import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceInputError = "denied" | "no-speech" | "other";

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Thin wrapper around the Web Speech API's SpeechRecognition (a.k.a.
 * webkitSpeechRecognition in Safari/Chrome). Not supported in every browser
 * (notably Firefox), so callers must check `supported` and fall back to a
 * text-only input when it's false.
 */
export function useVoiceInput(language: string) {
  const ctorRef = useRef(getSpeechRecognitionCtor());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceInputError | null>(null);

  const supported = ctorRef.current !== null;

  const start = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = ctorRef.current;
      if (!Ctor) return;

      recognitionRef.current?.stop();

      const recognition = new Ctor();
      recognition.lang = language.startsWith("en") ? "en-US" : "ja-JP";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        if (transcript) onResult(transcript);
      };
      recognition.onerror = (event) => {
        setError(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "denied"
            : event.error === "no-speech"
              ? "no-speech"
              : "other",
        );
      };
      recognition.onend = () => setListening(false);

      recognitionRef.current = recognition;
      setError(null);
      setListening(true);
      recognition.start();
    },
    [language],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  return { supported, listening, error, start, stop };
}
