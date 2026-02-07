/**
 * Embeddings Integration
 * OpenAI embeddings generation using LangChain.js
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { EmbeddingResult } from './types';

// Singleton embeddings instance
let embeddingsInstance: OpenAIEmbeddings | null = null;

/**
 * Get or create OpenAI embeddings instance
 */
export function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
      throw new Error('OPENAI_API_KEY environment variable is not configured');
    }

    embeddingsInstance = new OpenAIEmbeddings({
      apiKey,
      model: 'text-embedding-3-small',
      dimensions: 256, // Smaller dimensions for faster processing
    });
  }

  return embeddingsInstance;
}

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const embeddings = getEmbeddings();

  const [embedding] = await embeddings.embedDocuments([text]);

  return {
    text,
    embedding,
    model: 'text-embedding-3-small',
  };
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than individual calls for multiple texts
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];

  const embeddings = getEmbeddings();
  const batchEmbeddings = await embeddings.embedDocuments(texts);

  return texts.map((text, index) => ({
    text,
    embedding: batchEmbeddings[index],
    model: 'text-embedding-3-small',
  }));
}

/**
 * Generate embeddings for document chunks
 * Includes error handling and retry logic
 */
export async function embedDocumentChunks(
  chunks: string[],
  maxRetries: number = 3
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  let failedChunks: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const pendingChunks = attempt === 0 ? chunks : failedChunks;
    const failedIndices: number[] = [];

    for (let i = 0; i < pendingChunks.length; i++) {
      try {
        const result = await generateEmbedding(pendingChunks[i]);
        results.push(result);
      } catch (error) {
        console.error(`Failed to embed chunk ${i}:`, error);
        failedIndices.push(i);
      }
    }

    if (failedIndices.length === 0) break;

    // Collect failed chunks for retry
    failedChunks = failedIndices.map(i => pendingChunks[i]);

    if (attempt < maxRetries) {
      console.log(`Retry ${attempt + 1}/${maxRetries}: Re-embedding ${failedChunks.length} failed chunks`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  if (failedChunks.length > 0) {
    console.warn(`Could not embed ${failedChunks.length} chunks after ${maxRetries} retries`);
  }

  return results;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar chunks to a query
 */
export function findMostSimilarChunks(
  queryEmbedding: number[],
  chunkEmbeddings: EmbeddingResult[],
  topK: number = 5
): { result: EmbeddingResult; similarity: number }[] {
  const similarities = chunkEmbeddings.map((chunk, index) => ({
    index,
    result: chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by similarity (descending) and take top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map(({ result, similarity }) => ({ result, similarity }));
}
