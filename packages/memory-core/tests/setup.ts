import 'jest';

// Mock embedding service for testing
export class MockEmbeddingService {
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    return text1 === text2 ? 1.0 : 0.5;
  }

  async generateMerge(prompt: string): Promise<string> {
    return `Merged: ${prompt}`;
  }
}
