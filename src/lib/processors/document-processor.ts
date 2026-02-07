/**
 * Sequential Document Processor
 * Orchestrates the complete document processing pipeline: parse → chunk → embed → store
 */

import { UploadFile, FileStatus } from '@/types/upload';
import { PDFParser, TextExtractionResult } from './pdf-parser';
import { SemanticChunker, ChunkResult } from './chunker';
import { EmbeddingGenerator, EmbeddingResult } from './embedder';
import { VectorStorage } from './storage';

/**
 * Processing status interface
 */
export interface ProcessingStatus {
  fileId: string;
  status: FileStatus;
  progress: number;
  documentId?: string;
  error?: string;
  stage?: string;
}

/**
 * Individual file processing result
 */
export interface FileProcessingResult {
  fileId: string;
  status: 'complete' | 'error';
  documentId?: string;
  error?: string;
}

/**
 * Complete processing result for a queue
 */
export interface ProcessingResult {
  sessionId: string;
  processedCount: number;
  errorCount: number;
  skippedCount: number;
  files: FileProcessingResult[];
}

/**
 * Document Processor - Sequential processing pipeline orchestrator
 * Manages the complete flow: parse → chunk → embed → store
 */
export class DocumentProcessor {
  /** PDF Parser instance */
  private pdfParser: PDFParser;
  /** Semantic Chunker instance */
  private chunker: SemanticChunker;
  /** Embedding Generator instance */
  private embedder: EmbeddingGenerator;
  /** Vector Storage instance */
  private storage: VectorStorage;
  /** Singleton instance */
  private static instance: DocumentProcessor;

  /** Processing stage percentages */
  private readonly stageProgress = {
    parsing: { start: 0, end: 30 },
    chunking: { start: 30, end: 70 },
    embedding: { start: 70, end: 100 },
  };

  /**
   * Get singleton instance
   */
  static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  /**
   * Initialize processor with all dependencies
   */
  constructor() {
    this.pdfParser = new PDFParser();
    this.chunker = new SemanticChunker();
    this.embedder = EmbeddingGenerator.getInstance();
    this.storage = VectorStorage.getInstance();
  }

  /**
   * Process all files in a queue sequentially
   * @param sessionId - Session identifier
   * @returns Promise resolving to ProcessingResult
   */
  async processQueue(sessionId: string): Promise<ProcessingResult> {
    console.log(`Starting queue processing for session: ${sessionId}`);

    const result: ProcessingResult = {
      sessionId,
      processedCount: 0,
      errorCount: 0,
      skippedCount: 0,
      files: [],
    };

    try {
      // Get pending files for this session
      const pendingFiles = await this.getPendingFiles(sessionId);

      if (pendingFiles.length === 0) {
        console.log('No files to process');
        return result;
      }

      // Process files sequentially (one at a time)
      for (const fileId of pendingFiles) {
        const fileResult = await this.processFileById(fileId);

        if (fileResult.status === 'complete') {
          result.processedCount++;
        } else {
          result.errorCount++;
        }

        result.files.push(fileResult);
      }

      console.log(`Queue processing complete: ${result.processedCount} successful, ${result.errorCount} errors`);
      return result;
    } catch (error) {
      console.error('Queue processing failed:', error);
      return {
        ...result,
        errorCount: result.processedCount + 1, // At least one error occurred
      };
    }
  }

  /**
   * Process a single file through the complete pipeline
   * @param file - Upload file to process
   * @returns Promise resolving to ProcessingStatus
   */
  async processFile(file: UploadFile): Promise<ProcessingStatus> {
    console.log(`Processing file: ${file.name} (${file.id})`);

    try {
      // Stage 1: PDF Parsing
      await this.updateFileStatus(file.id, 'parsing', 0, 'Extracting text...');
      const extraction = await this.parseFile(file);

      // Stage 2: Text Chunking
      await this.updateFileStatus(file.id, 'chunking', this.stageProgress.chunking.start, 'Creating text chunks...');
      const chunks = await this.chunkText(extraction);

      // Stage 3: Embedding Generation
      await this.updateFileStatus(file.id, 'embedding', this.stageProgress.embedding.start, 'Generating embeddings...');
      const embeddings = await this.generateEmbeddings(chunks);

      // Stage 4: Vector Storage
      const documentId = await this.storeResults(file, extraction, chunks, embeddings);

      // Complete
      await this.updateFileStatus(file.id, 'complete', 100, 'Processing complete', documentId);

      console.log(`File processing complete: ${file.name} -> ${documentId}`);

      return {
        fileId: file.id,
        status: 'complete',
        progress: 100,
        documentId,
        stage: 'complete',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`File processing failed: ${file.name}`, errorMessage);

      await this.updateFileStatus(file.id, 'error', 0, errorMessage);

      return {
        fileId: file.id,
        status: 'error',
        progress: 0,
        error: errorMessage,
        stage: 'error',
      };
    }
  }

  /**
   * Get current processing status for a file
   * @param fileId - File identifier
   * @returns Promise resolving to ProcessingStatus
   */
  async getProcessingStatus(fileId: string): Promise<ProcessingStatus | null> {
    try {
      // This would typically query the database for current status
      // For now, return a placeholder implementation
      return {
        fileId,
        status: 'pending',
        progress: 0,
      };
    } catch (error) {
      console.error('Failed to get processing status:', error);
      return null;
    }
  }

  /**
   * Stage 1: Parse PDF file
   */
  private async parseFile(file: UploadFile): Promise<TextExtractionResult> {
    const startTime = Date.now();

    try {
      // Get file path from storage (this would be implemented based on your storage solution)
      const filePath = await this.getFilePath(file.id);

      const result = await this.pdfParser.extractText(filePath, file.id);

      const duration = Date.now() - startTime;
      console.log(`Parsing complete: ${result.pages} pages, ${result.chunks} estimated chunks, ${duration}ms`);

      // Check timing target (< 10 seconds)
      if (duration > 10000) {
        console.warn(`Parsing exceeded 10 second target: ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error('Parsing failed:', error);
      throw error;
    }
  }

  /**
   * Stage 2: Chunk extracted text
   */
  private async chunkText(extraction: TextExtractionResult): Promise<ChunkResult> {
    const startTime = Date.now();

    try {
      const result = this.chunker.chunkDocument(extraction);

      const duration = Date.now() - startTime;
      console.log(`Chunking complete: ${result.chunkCount} chunks, ${duration}ms`);

      return result;
    } catch (error) {
      console.error('Chunking failed:', error);
      throw error;
    }
  }

  /**
   * Stage 3: Generate embeddings
   */
  private async generateEmbeddings(chunks: ChunkResult): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      const result = await this.embedder.generateEmbeddings(chunks.chunks);

      const duration = Date.now() - startTime;
      console.log(
        `Embedding complete: ${result.batchCount} batches, ${result.tokensUsed} tokens, ${duration}ms`
      );

      // Log warning if generation took longer than expected
      const expectedMaxDuration = 20000; // 20 seconds for embedding stage
      if (duration > expectedMaxDuration) {
        console.warn(`Embedding generation exceeded expected duration: ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Stage 4: Store results in database
   */
  private async storeResults(
    file: UploadFile,
    extraction: TextExtractionResult,
    chunks: ChunkResult,
    embeddings: EmbeddingResult
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Create document record
      const documentId = await this.storage.createDocumentRecord(file, extraction);

      // Store embeddings and chunks
      const storageResult = await this.storage.storeEmbeddings(documentId, chunks, embeddings);

      if (!storageResult.success) {
        throw new Error(storageResult.error || 'Storage failed');
      }

      // Update document status to complete
      await this.storage.updateDocumentStatus(documentId, 'complete');

      const duration = Date.now() - startTime;
      console.log(`Storage complete: ${storageResult.chunksStored} chunks stored, ${duration}ms`);

      return documentId;
    } catch (error) {
      console.error('Storage failed:', error);
      throw error;
    }
  }

  /**
   * Process file by its ID
   */
  private async processFileById(fileId: string): Promise<FileProcessingResult> {
    try {
      // Get file details from database (placeholder implementation)
      const file: UploadFile = {
        id: fileId,
        name: 'document.pdf',
        size: 0,
        status: 'pending',
        progress: 0,
        sessionId: '',
        createdAt: new Date(),
      };

      const result = await this.processFile(file);

      return {
        fileId: result.fileId,
        status: result.status === 'complete' ? 'complete' : 'error',
        documentId: result.documentId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        fileId,
        status: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * Get pending files for a session
   */
  private async getPendingFiles(sessionId: string): Promise<string[]> {
    try {
      // This would query the database for pending files
      // Placeholder implementation
      return [];
    } catch (error) {
      console.error('Failed to get pending files:', error);
      return [];
    }
  }

  /**
   * Get file path from storage
   */
  private async getFilePath(fileId: string): Promise<string> {
    // This would retrieve the file path from your storage solution
    // Placeholder implementation
    return `/uploads/${fileId}.pdf`;
  }

  /**
   * Update file status in the database
   */
  private async updateFileStatus(
    fileId: string,
    status: FileStatus,
    progress: number,
    error?: string,
    documentId?: string
  ): Promise<void> {
    try {
      // This would update the file status in the database
      // Placeholder implementation
      console.log(`Status update: ${fileId} -> ${status} (${progress}%) ${error || ''}`);
    } catch (error) {
      console.error('Failed to update file status:', error);
    }
  }
}

// Export singleton instance for easy use
export const documentProcessor = DocumentProcessor.getInstance();
