import { useState, useCallback } from 'react';

export interface SpeechComparisonResult {
  currentMatchedIndex: number;
  isCorrect: boolean;
  skippedParts: string[];
  mismatchedWords?: Array<{
    expected: string;
    spoken: string;
    position: number;
  }>;
}

export interface LLMRegenerateResult {
  regeneratedScript: string;
  summary: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * 백엔드 API 호출 커스텀 훅
 */
export function useApiClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 음성 vs 원고 비교
   */
  const compareSpeech = useCallback(
    async (
      spokenText: string,
      scriptText: string,
      lastMatchedIndex: number = 0
    ): Promise<SpeechComparisonResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/speech-comparison`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spokenText,
            scriptText,
            lastMatchedIndex,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Speech comparison failed');
        }

        const data: SpeechComparisonResult = await response.json();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Speech comparison error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * LLM으로 누락된 부분 재구성
   */
  const regenerateWithLLM = useCallback(
    async (
      fullScript: string,
      spokenText: string,
      skippedParts: string[]
    ): Promise<LLMRegenerateResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/llm-regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullScript,
            spokenText,
            skippedParts,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'LLM regeneration failed');
        }

        const data: LLMRegenerateResult = await response.json();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('LLM regeneration error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const testLLM = useCallback(async (count: number) => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

    try {
      const response = await fetch(`${API_BASE}/api/llm-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "LLM test failed");
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof Error && err.name === 'AbortError') {
        setError("요청 시간이 초과되었습니다. 다시 시도해주세요.");
      } else {
        setError(message);
      }
      console.error("LLM test error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extractKeywords = useCallback(async (script: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/extract-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Keyword extraction failed");
      }
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Keyword extraction error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    compareSpeech,
    regenerateWithLLM,
    testLLM,
    extractKeywords,
  };
}