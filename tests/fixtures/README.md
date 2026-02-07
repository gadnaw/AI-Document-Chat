# Test Fixtures Directory

This directory contains test data and fixtures for the AI Document Chat test suite.

## Directory Structure

```
tests/fixtures/
├── documents/          # Sample documents for testing
│   ├── small.pdf       # < 1MB test document
│   ├── medium.pdf      # 1-5MB test document
│   └── large.pdf       # 5-10MB test document
├── queries/            # Test queries for chat and search
│   ├── simple.json     # Basic queries
│   └── complex.json    # Multi-part queries
├── expected-results/   # Expected results for validation
│   └── citations.json  # Expected citation formats
└── README.md           # This file
```

## Creating Test Documents

### Using Python (recommended)
```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_test_pdf(filename, num_pages=1):
    c = canvas.Canvas(filename, pagesize=letter)
    for i in range(num_pages):
        c.drawString(100, 750, f"Test Document - Page {i+1}")
        c.drawString(100, 730, "This is test content for document processing.")
        c.showPage()
    c.save()

create_test_pdf("small.pdf", 1)
create_test_pdf("medium.pdf", 5)
create_test_pdf("large.pdf", 20)
```

### Using Command Line (Linux/macOS)
```bash
# Create a simple PDF using cups
cupsfilter > small.pdf <<'EOF'
Test content for document processing
EOF

# Or use pdftk if available
echo "Test content" > test.txt
ps2pdf test.txt small.pdf
```

## Test Queries

### Simple Queries
- "What is this document about?"
- "Summarize the main points"
- "What are the key findings?"

### Complex Queries
- "Compare and contrast the methodologies described in sections 2 and 3"
- "What recommendations are made regarding the implementation timeline?"
- "Analyze the statistical significance of the results"

## Performance Benchmarks

The test suite validates against these performance targets:

| Metric | Target | Threshold |
|--------|--------|-----------|
| Document Processing | 95% < 30s | 95% < 35s |
| Query Latency (p95) | < 2s | < 3s |
| E2E Test Pass Rate | > 95% | > 90% |
| Unit Test Coverage | > 80% | > 75% |

## Adding New Fixtures

1. Place test files in appropriate subdirectory
2. Update this README with file descriptions
3. Add any metadata to fixtures.json if needed
4. Ensure files are gitignored (large files should not be committed)

## Notes

- All PDF fixtures should be valid PDF 1.4+ files
- Test documents should contain realistic but generic content
- Avoid including sensitive or personally identifiable information
- For load testing, use documents that reflect real-world size distributions
