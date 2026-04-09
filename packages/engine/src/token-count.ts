const CJK_RANGE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  // Sample first 200 chars for CJK density
  const sample = text.slice(0, 200);
  const cjkChars = (sample.match(new RegExp(CJK_RANGE.source, "g")) || [])
    .length;
  const cjkRatio = cjkChars / Math.max(sample.length, 1);

  const charsPerToken = cjkRatio > 0.3 ? 2 : 4;
  return Math.ceil(text.length / charsPerToken);
}
