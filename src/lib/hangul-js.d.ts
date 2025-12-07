// src/hangul-js.d.ts

declare module 'hangul-js' {
  /**
   * 문자열을 자소 단위로 분리합니다.
   * 예: '가' -> ['ㄱ', 'ㅏ']
   */
  export function disassemble(str: string, grouped?: boolean): string[];

  /**
   * 자소 배열을 문자열로 합칩니다.
   * 예: ['ㄱ', 'ㅏ'] -> '가'
   */
  export function assemble(jamos: string[]): string;

  /**
   * 초성 검색 등에 사용됩니다.
   */
  export function search(str: string, criteria: string): number;
  
  // 필요한 함수가 더 있다면 여기에 추가하면 됩니다.
  const Hangul: {
    disassemble: typeof disassemble;
    assemble: typeof assemble;
    search: typeof search;
  };

  export default Hangul;
}