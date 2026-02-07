/**
 * Document Ingestion Library
 * Main entry point for document processing and embeddings generation
 */

// Types
export * from './types';

// PDF Processing
export {
  extractTextFromPDF,
  cleanExtractedText,
  splitTextIntoChunks,
  isPDFFile,
  formatFileSize,
} from './pdf';

// Embeddings
export {
  getEmbeddings,
  generateEmbedding,
  generateEmbeddingsBatch,
  embedDocumentChunks,
  cosineSimilarity,
  findMostSimilarChunks,
} from './embeddings';

/**
 * Process a document file and generate embeddings
 * Main function for document ingestion pipeline
 */
export async function processDocument(
  file: File,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    generateEmbeddings?: boolean;
  } = {}
): Promise<{
  documentId: string;
  filename: string;
  chunks: string[];
  embeddings?: EmbeddingResult[];
  metadata: {
    fileSize: string;
    fileType: string;
    numChunks: number;
    processingTime: number;
  };
}> {
  const startTime = Date.now();
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    generateEmbeddings = true,
  } = options;

  // Import PDF and embeddings utilities locally to avoid circular dependencies
  const { isPDFFile, extractTextFromPDF, splitTextIntoChunks, formatFileSize } = await import('./pdf');
  const { embedDocumentChunks } = await import('./embeddings');

  // Validate file
  if (!isPDFFile(file)) {
    throw new Error(`Invalid file type: ${file.type}. Only PDF files are supported.`);
  }

  // Extract text from PDF
  const pdfResult = await extractTextFromPDF(file);
  console.log(`Extracted ${pdfResult.numPages} pages from ${file.name}`);

  // Split into chunks
  const chunks = splitTextIntoChunks(pdfResult.text, chunkSize, chunkOverlap);
  console.log(`Split document into ${chunks.length} chunks`);

  // Generate embeddings if requested
  let embeddings: EmbeddingResult[] | undefined;
  if (generateEmbeddings) {
    embeddings = await embedDocumentChunks(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);
  }

  const processingTime = Date.now() - startTime;

  return {
    documentId: generateDocumentId(),
    filename: file.name,
    chunks,
    embeddings,
    metadata: {
      fileSize: formatFileSize(file.size),
      fileType: file.type,
      numChunks: chunks.length,
      processingTime,
    },
  };
}

/**
 * Generate a unique document ID
 */
function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Re-export types for convenience
import type {
  DocumentChunk,
  DocumentMetadata,
  ProcessedDocument,
  IngestionConfig,
  EmbeddingResult,
  PDFProcessingResult,
} from './types';
