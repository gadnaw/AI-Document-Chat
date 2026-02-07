/**
 * Citation Accuracy Validation Tests
 * 
 * Measures citation quality using precision, recall, and F1 scoring:
 * - Citation Precision: % of citations that are actually relevant
 * - Citation Recall: % of ground truth citations that appear
 * - Citation F1: Harmonic mean of precision and recall
 * - Citation Relevance: Graded scoring (1-4 scale)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Types for citation evaluation
interface Citation {
  id: string;
  documentId: string;
  chunkId: string;
  excerpt: string;
  startChar?: number;
  endChar?: number;
}

interface ChatResponse {
  responseId: string;
  query: string;
  generatedText: string;
  citations: Citation[];
  sources: string[]; // All source documents used
}

interface CitationGroundTruth {
  queryId: string;
  requiredCitations: Citation[];
  optionalCitations: Citation[];
  minRequiredCount: number;
}

interface CitationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  relevantCount: number;
  totalCitations: number;
  coveragePercent: number;
}

interface CitationAnalysis {
  hallucinations: Citation[]; // Citations not in source
  irrelevantCitations: Citation[]; // Wrong context
  incompleteCitations: Citation[]; // Partial relevance
  missingCitations: Citation[]; // Should have been cited
  correctCitations: Citation[]; // Properly cited
}

// Relevance grading scale
const RELEVANCE_GRADES = {
  IRRELEVANT: 0,      // Not related to claim
  WEAKLY_RELEVANT: 1, // Tangentially related
  RELEVANT: 2,        // Supports claim directly
  STRONGLY_RELEVANT: 3, // Strongly supports claim
  EXACT_MATCH: 4,     // Perfect citation for claim
} as const;

// Default evaluation thresholds
const DEFAULT_THRESHOLDS = {
  precisionTarget: 0.90,
  recallTarget: 0.85,
  f1Target: 0.87,
  minRelevanceScore: 2,
};

/**
 * Calculate Citation Precision
 * Percentage of citations that are actually relevant to the claims
 */
export function calculateCitationPrecision(
  response: ChatResponse,
  groundTruth: CitationGroundTruth
): number {
  if (response.citations.length === 0) {
    return 1.0; // No citations to evaluate
  }

  const relevantCitations = response.citations.filter(citation => 
    isCitationRelevant(citation, groundTruth)
  );

  return relevantCitations.length / response.citations.length;
}

/**
 * Calculate Citation Recall
 * Percentage of ground truth citations that appear in the response
 */
export function calculateCitationRecall(
  response: ChatResponse,
  groundTruth: CitationGroundTruth
): number {
  const requiredCitations = groundTruth.requiredCitations;
  
  if (requiredCitations.length === 0) {
    return 1.0; // No required citations
  }

  const foundCitations = requiredCitations.filter(required => 
    response.citations.some(c => 
      c.documentId === required.documentId && 
      c.chunkId === required.chunkId
    )
  );

  return foundCitations.length / requiredCitations.length;
}

/**
 * Calculate Citation F1 Score
 * Harmonic mean of precision and recall
 */
export function calculateCitationF1(
  precision: number,
  recall: number
): number {
  if (precision + recall === 0) {
    return 0;
  }
  return 2 * (precision * recall) / (precision + recall);
}

/**
 * Check if a citation is relevant to ground truth
 */
function isCitationRelevant(
  citation: Citation,
  groundTruth: CitationGroundTruth
): boolean {
  // Check if citation matches any required citation
  const isRequired = groundTruth.requiredCitations.some(
    required => required.documentId === citation.documentId
  );
  
  // Check if citation matches any optional citation
  const isOptional = groundTruth.optionalCitations.some(
    optional => optional.documentId === citation.documentId
  );
  
  return isRequired || isOptional;
}

/**
 * Analyze citations for common failure patterns
 */
export function analyzeCitations(
  response: ChatResponse,
  groundTruth: CitationGroundTruth,
  availableSources: string[]
): CitationAnalysis {
  const analysis: CitationAnalysis = {
    hallucinations: [],
    irrelevantCitations: [],
    incompleteCitations: [],
    missingCitations: [],
    correctCitations: [],
  };

  // Identify hallucinations (citations not in source documents)
  for (const citation of response.citations) {
    if (!availableSources.includes(citation.documentId)) {
      analysis.hallucinations.push(citation);
      continue;
    }

    // Check if citation is relevant
    const isRelevant = groundTruth.requiredCitations.some(
      r => r.documentId === citation.documentId
    ) || groundTruth.optionalCitations.some(
      o => o.documentId === citation.documentId
    );

    if (!isRelevant) {
      analysis.irrelevantCitations.push(citation);
    } else {
      // Check for incomplete relevance (partial match)
      const exactMatch = groundTruth.requiredCitations.some(
        r => r.documentId === citation.documentId && 
             r.chunkId === citation.chunkId
      );
      
      if (!exactMatch && groundTruth.requiredCitations.some(
        r => r.documentId === citation.documentId
      )) {
        analysis.incompleteCitations.push(citation);
      } else {
        analysis.correctCitations.push(citation);
      }
    }
  }

  // Identify missing citations (required but not cited)
  for (const required of groundTruth.requiredCitations) {
    const isCited = response.citations.some(
      c => c.documentId === required.documentId
    );
    
    if (!isCited) {
      analysis.missingCitations.push(required);
    }
  }

  return analysis;
}

/**
 * Grade citation relevance on 1-4 scale
 */
export function gradeCitationRelevance(
  citation: Citation,
  claim: string,
  context: string
): number {
  // This would typically involve LLM-based evaluation
  // For now, use heuristic-based scoring
  
  const citationLower = citation.ex();
  const claimcerpt.toLowerCaseLower = claim.toLowerCase();
  const contextLower = context.toLowerCase();
  
  // Check for keyword overlap
  const claimWords = new Set(claim.toLowerCase().split(/\s+/));
  const citationWords = new Set(citation.excerpt.toLowerCase().split(/\s+/));
  const overlap = [...claimWords].filter(w => w.length > 3).filter(
    w => citationWords.has(w)
  );
  
  const overlapRatio = overlap.length / Math.max(claimWords.size, 1);
  
  // Score based on overlap
  if (overlapRatio > 0.7) return RELEVANCE_GRADES.EXACT_MATCH;
  if (overlapRatio > 0.5) return RELEVANCE_GRADES.STRONGLY_RELEVANT;
  if (overlapRatio > 0.3) return RELEVANCE_GRADES.RELEVANT;
  if (overlapRatio > 0.1) return RELEVANCE_GRADES.WEAKLY_RELEVANT;
  return RELEVANCE_GRADES.IRRELEVANT;
}

/**
 * Calculate comprehensive citation metrics
 */
export function calculateCitationMetrics(
  responses: ChatResponse[],
  groundTruths: CitationGroundTruth[],
  availableSources: string[]
): CitationMetrics {
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalCitations = 0;
  let totalRelevant = 0;

  for (let i = 0; i < Math.min(responses.length, groundTruths.length); i++) {
    const response = responses[i];
    const groundTruth = groundTruths[i];
    
    const precision = calculateCitationPrecision(response, groundTruth);
    const recall = calculateCitationRecall(response, groundTruth);
    
    totalPrecision += precision;
    totalRecall += recall;
    totalCitations += response.citations.length;
    totalRelevant += response.citations.filter(c => 
      isCitationRelevant(c, groundTruth)
    ).length;
  }

  const avgPrecision = responses.length > 0 ? totalPrecision / responses.length : 0;
  const avgRecall = responses.length > 0 ? totalRecall / responses.length : 0;

  return {
    precision: avgPrecision,
    recall: avgRecall,
    f1Score: calculateCitationF1(avgPrecision, avgRecall),
    relevantCount: totalRelevant,
    totalCitations: totalCitations,
    coveragePercent: totalCitations > 0 ? (totalRelevant / totalCitations) * 100 : 100,
  };
}

/**
 * Detect hallucinated citations
 */
export function detectHallucinations(
  responses: ChatResponse[],
  availableSources: string[]
): Citation[] {
  const hallucinations: Citation[] = [];
  
  for (const response of responses) {
    for (const citation of response.citations) {
      if (!availableSources.includes(citation.documentId)) {
        hallucinations.push(citation);
      }
    }
  }
  
  return hallucinations;
}

/**
 * Detect irrelevant citations
 */
export function detectIrrelevantCitations(
  responses: ChatResponse[],
  groundTruths: CitationGroundTruth[]
): Citation[] {
  const irrelevant: Citation[] = [];
  
  for (let i = 0; i < Math.min(responses.length, groundTruths.length); i++) {
    const response = responses[i];
    const groundTruth = groundTruths[i];
    
    for (const citation of response.citations) {
      const isRequired = groundTruth.requiredCitations.some(
        r => r.documentId === citation.documentId
      );
      const isOptional = groundTruth.optionalCitations.some(
        o => o.documentId === citation.documentId
      );
      
      if (!isRequired && !isOptional) {
        irrelevant.push(citation);
      }
    }
  }
  
  return irrelevant;
}

/**
 * Generate citation quality report
 */
export function generateCitationReport(
  responses: ChatResponse[],
  groundTruths: CitationGroundTruth[],
  availableSources: string[]
): string {
  const metrics = calculateCitationMetrics(responses, groundTruths, availableSources);
  const analysis = responses.map((response, i) => 
    analyzeCitations(response, groundTruths[i], availableSources)
  );

  let report = '## Citation Accuracy Report\n\n';
  
  // Summary metrics
  report += '### Summary Metrics\n';
  report += '| Metric | Value | Target | Status |\n';
  report += '|--------|-------|--------|--------|\n';
  report += `| Precision | ${(metrics.precision * 100).toFixed(1)}% | >90% | ${metrics.precision >= 0.90 ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| Recall | ${(metrics.recall * 100).toFixed(1)}% | >85% | ${metrics.recall >= 0.85 ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| F1 Score | ${metrics.f1Score.toFixed(3)} | >0.87 | ${metrics.f1Score >= 0.87 ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| Total Citations | ${metrics.totalCitations} | - | - |\n`;
  report += `| Relevant Citations | ${metrics.relevantCount} | - | - |\n`;
  
  // Failure analysis
  const totalHallucinations = analysis.reduce((sum, a) => sum + a.hallucinations.length, 0);
  const totalIrrelevant = analysis.reduce((sum, a) => sum + a.irrelevantCitations.length, 0);
  const totalMissing = analysis.reduce((sum, a) => sum + a.missingCitations.length, 0);
  
  report += '\n### Failure Analysis\n';
  report += `| Issue | Count | Percentage |\n`;
  report += `|-------|-------|------------|\n`;
  report += `| Hallucinations | ${totalHallucinations} | ${((totalHallucinations / Math.max(metrics.totalCitations, 1)) * 100).toFixed(1)}% |\n`;
  report += `| Irrelevant | ${totalIrrelevant} | ${((totalIrrelevant / Math.max(metrics.totalCitations, 1)) * 100).toFixed(1)}% |\n`;
  report += `| Missing | ${totalMissing} | - |\n`;
  
  // Recommendations
  report += '\n### Recommendations\n';
  if (metrics.precision < 0.90) {
    report += '- ⚠️ Precision below target: Review citation selection logic\n';
  }
  if (metrics.recall < 0.85) {
    report += '- ⚠️ Recall below target: Consider including more source documents\n';
  }
  if (totalHallucinations > 0) {
    report += `- 🔴 ${totalHallucinations} hallucinated citations detected: Verify source document list\n`;
  }
  if (metrics.f1Score >= 0.87) {
    report += '- ✅ F1 score meets target: Citation accuracy is good\n';
  }
  
  return report;
}

// Test suite
describe('Citation Accuracy Validation', () => {
  describe('Precision Calculation', () => {
    it('should return 1.0 for perfect precision', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library...',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          { id: 'c2', documentId: 'doc1', chunkId: 'chunk2', excerpt: 'Created by Facebook' },
        ],
        sources: ['doc1'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
        ],
        optionalCitations: [],
        minRequiredCount: 1,
      };
      
      const precision = calculateCitationPrecision(response, groundTruth);
      expect(precision).toBe(1.0);
    });

    it('should penalize irrelevant citations', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library...',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          { id: 'c2', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'Angular is different' },
        ],
        sources: ['doc1', 'doc2'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
        ],
        optionalCitations: [],
        minRequiredCount: 1,
      };
      
      const precision = calculateCitationPrecision(response, groundTruth);
      expect(precision).toBe(0.5); // 1 out of 2 citations are relevant
    });
  });

  describe('Recall Calculation', () => {
    it('should return 1.0 for perfect recall', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library...',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
        ],
        sources: ['doc1'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
        ],
        optionalCitations: [],
        minRequiredCount: 1,
      };
      
      const recall = calculateCitationRecall(response, groundTruth);
      expect(recall).toBe(1.0);
    });

    it('should penalize missing citations', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library...',
        citations: [], // No citations
        sources: ['doc1'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          { id: 'c2', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'Created by Facebook' },
        ],
        optionalCitations: [],
        minRequiredCount: 2,
      };
      
      const recall = calculateCitationRecall(response, groundTruth);
      expect(recall).toBe(0); // 0 out of 2 required citations found
    });
  });

  describe('F1 Score Calculation', () => {
    it('should calculate F1 correctly', () => {
      expect(calculateCitationF1(1.0, 1.0)).toBe(1.0);
      expect(calculateCitationF1(1.0, 0.5)).toBeCloseTo(0.667, 2);
      expect(calculateCitationF1(0.5, 0.5)).toBe(0.5);
      expect(calculateCitationF1(0, 0)).toBe(0);
    });
  });

  describe('Hallucination Detection', () => {
    it('should detect citations to non-existent documents', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'Test',
        generatedText: 'Test response',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'Real doc' },
          { id: 'c2', documentId: 'fake-doc', chunkId: 'chunk1', excerpt: 'Hallucinated' },
        ],
        sources: ['doc1'],
      };
      
      const hallucinations = detectHallucinations([response], ['doc1']);
      expect(hallucinations).toHaveLength(1);
      expect(hallucinations[0].documentId).toBe('fake-doc');
    });
  });

  describe('Irrelevant Citation Detection', () => {
    it('should detect citations not in ground truth', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library...',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          { id: 'c2', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'Python is a language' },
        ],
        sources: ['doc1', 'doc2'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
        ],
        optionalCitations: [],
        minRequiredCount: 1,
      };
      
      const irrelevant = detectIrrelevantCitations([response], [groundTruth]);
      expect(irrelevant).toHaveLength(1);
      expect(irrelevant[0].documentId).toBe('doc2');
    });
  });

  describe('Citation Analysis', () => {
    it('should categorize citations correctly', () => {
      const response: ChatResponse = {
        responseId: 'r1',
        query: 'What is React?',
        generatedText: 'React is a JavaScript library created by Facebook...',
        citations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' }, // Correct
          { id: 'c2', documentId: 'doc3', chunkId: 'chunk1', excerpt: 'Angular documentation' }, // Irrelevant
          { id: 'c3', documentId: 'fake', chunkId: 'chunk1', excerpt: 'Hallucinated' }, // Hallucination
        ],
        sources: ['doc1', 'doc2', 'doc3'],
      };
      
      const groundTruth: CitationGroundTruth = {
        queryId: 'q1',
        requiredCitations: [
          { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          { id: 'c4', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'Created by Facebook' },
        ],
        optionalCitations: [],
        minRequiredCount: 2,
      };
      
      const analysis = analyzeCitations(response, groundTruth, ['doc1', 'doc2', 'doc3']);
      
      expect(analysis.correctCitations).toHaveLength(1);
      expect(analysis.irrelevantCitations).toHaveLength(1);
      expect(analysis.hallucinations).toHaveLength(1);
      expect(analysis.missingCitations).toHaveLength(1); // doc2 is missing
    });
  });

  describe('Comprehensive Metrics', () => {
    it('should calculate overall citation metrics', () => {
      const responses: ChatResponse[] = [
        {
          responseId: 'r1',
          query: 'What is React?',
          generatedText: 'React is a JavaScript library...',
          citations: [
            { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          ],
          sources: ['doc1'],
        },
        {
          responseId: 'r2',
          query: 'What is TypeScript?',
          generatedText: 'TypeScript is a typed superset...',
          citations: [
            { id: 'c2', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'TypeScript features' },
            { id: 'c3', documentId: 'doc3', chunkId: 'chunk1', excerpt: 'Unrelated content' },
          ],
          sources: ['doc2', 'doc3'],
        },
      ];
      
      const groundTruths: CitationGroundTruth[] = [
        {
          queryId: 'q1',
          requiredCitations: [
            { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        },
        {
          queryId: 'q2',
          requiredCitations: [
            { id: 'c2', documentId: 'doc2', chunkId: 'chunk1', excerpt: 'TypeScript features' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        },
      ];
      
      const metrics = calculateCitationMetrics(responses, groundTruths, ['doc1', 'doc2', 'doc3']);
      
      // Response 1: precision=1.0, recall=1.0
      // Response 2: precision=0.5, recall=1.0
      // Average: precision=0.75, recall=1.0
      expect(metrics.precision).toBeCloseTo(0.75, 2);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1Score).toBeCloseTo(0.857, 2);
      expect(metrics.totalCitations).toBe(3);
    });

    it('should meet precision > 90% target', () => {
      const responses: ChatResponse[] = [];
      const groundTruths: CitationGroundTruth[] = [];
      
      // Generate 20 responses with high precision
      for (let i = 0; i < 20; i++) {
        const docId = `doc${i % 5}`;
        responses.push({
          responseId: `r${i}`,
          query: `Query ${i}`,
          generatedText: 'Response',
          citations: [
            { id: `c${i}`, documentId: docId, chunkId: 'chunk1', excerpt: 'Relevant content' },
          ],
          sources: ['doc0', 'doc1', 'doc2', 'doc3', 'doc4'],
        });
        
        groundTruths.push({
          queryId: `q${i}`,
          requiredCitations: [
            { id: `c${i}`, documentId: docId, chunkId: 'chunk1', excerpt: 'Relevant content' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        });
      }
      
      const metrics = calculateCitationMetrics(responses, groundTruths, ['doc0', 'doc1', 'doc2', 'doc3', 'doc4']);
      
      expect(metrics.precision).toBeGreaterThanOrEqual(0.90);
    });

    it('should meet recall > 85% target', () => {
      const responses: ChatResponse[] = [];
      const groundTruths: CitationGroundTruth[] = [];
      
      // Generate responses with high recall
      for (let i = 0; i < 20; i++) {
        responses.push({
          responseId: `r${i}`,
          query: `Query ${i}`,
          generatedText: 'Response',
          citations: [
            { id: `c${i*2}`, documentId: `doc${i % 5}`, chunkId: 'chunk1', excerpt: 'Required' },
            { id: `c${i*2+1}`, documentId: `doc${i % 5}`, chunkId: 'chunk2', excerpt: 'Optional' },
          ],
          sources: ['doc0', 'doc1', 'doc2', 'doc3', 'doc4'],
        });
        
        groundTruths.push({
          queryId: `q${i}`,
          requiredCitations: [
            { id: `c${i*2}`, documentId: `doc${i % 5}`, chunkId: 'chunk1', excerpt: 'Required' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        });
      }
      
      const metrics = calculateCitationMetrics(responses, groundTruths, ['doc0', 'doc1', 'doc2', 'doc3', 'doc4']);
      
      expect(metrics.recall).toBeGreaterThanOrEqual(0.85);
    });

    it('should meet F1 > 0.87 target', () => {
      const responses: ChatResponse[] = [];
      const groundTruths: CitationGroundTruth[] = [];
      
      // Generate responses with balanced precision/recall
      for (let i = 0; i < 20; i++) {
        responses.push({
          responseId: `r${i}`,
          query: `Query ${i}`,
          generatedText: 'Response',
          citations: [
            { id: `c${i}`, documentId: `doc${i % 5}`, chunkId: 'chunk1', excerpt: 'Relevant' },
          ],
          sources: ['doc0', 'doc1', 'doc2', 'doc3', 'doc4'],
        });
        
        groundTruths.push({
          queryId: `q${i}`,
          requiredCitations: [
            { id: `c${i}`, documentId: `doc${i % 5}`, chunkId: 'chunk1', excerpt: 'Relevant' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        });
      }
      
      const metrics = calculateCitationMetrics(responses, groundTruths, ['doc0', 'doc1', 'doc2', 'doc3', 'doc4']);
      
      // Perfect precision and recall = F1 of 1.0
      expect(metrics.f1Score).toBeGreaterThanOrEqual(0.87);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', () => {
      const responses: ChatResponse[] = [
        {
          responseId: 'r1',
          query: 'What is React?',
          generatedText: 'React is a JavaScript library...',
          citations: [
            { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          ],
          sources: ['doc1'],
        },
      ];
      
      const groundTruths: CitationGroundTruth[] = [
        {
          queryId: 'q1',
          requiredCitations: [
            { id: 'c1', documentId: 'doc1', chunkId: 'chunk1', excerpt: 'React is a library' },
          ],
          optionalCitations: [],
          minRequiredCount: 1,
        },
      ];
      
      const report = generateCitationReport(responses, groundTruths, ['doc1']);
      
      expect(report).toContain('## Citation Accuracy Report');
      expect(report).contain('Precision');
      expect(report).contain('Recall');
      expect(report).contain('F1 Score');
    });
  });
});

// Export types
export type { Citation, ChatResponse, CitationGroundTruth, CitationMetrics, CitationAnalysis };
