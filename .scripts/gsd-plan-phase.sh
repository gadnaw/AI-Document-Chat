#!/bin/bash
###############################################################################
# GSD ► PLAN PHASE Orchestrator
# Creates executable phase prompts with integrated research and verification
###############################################################################

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

banner() { echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${PURPLE} GSD ► $1${NC}"; echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
stage_banner() { echo ""; echo -e "${BLUE}[...] $1${NC}"; }
success() { echo -e "${GREEN}[OK] $1${NC}"; }
error() { echo -e "${RED}[FAIL] $1${NC}"; }
warning() { echo -e "${YELLOW}[WARN] $1${NC}"; }

get_model() {
    local agent_type="$1"
    local profile="${MODEL_PROFILE:-quality}"
    case "$agent_type" in
        "gsd-phase-researcher")
            case "$profile" in "max"|"quality") echo "anthropic:claude-opus-4-20250514" ;; "balanced") echo "anthropic:claude-sonnet-4-20250514" ;; "budget") echo "anthropic:claude-haiku-3-5-20241022" ;; esac ;;
        "gsd-planner")
            case "$profile" in "max"|"quality") echo "anthropic:claude-opus-4-20250514" ;; "balanced"|"budget") echo "anthropic:claude-sonnet-4-20250514" ;; esac ;;
        "gsd-plan-checker")
            case "$profile" in "max"|"quality") echo "anthropic:claude-opus-4-20250514" ;; "balanced") echo "anthropic:claude-sonnet-4-20250514" ;; "budget") echo "anthropic:claude-haiku-3-5-20241022" ;; esac ;;
    esac
}

###############################################################################
# STEP 1: Validate Environment
###############################################################################

banner "VALIDATING ENVIRONMENT"

[ -d ".planning" ] || { error ".planning directory not found"; exit 1; }
success ".planning directory found"

[ -f ".planning/ROADMAP.md" ] || { error "ROADMAP.md not found"; exit 1; }
success "ROADMAP.md found"

[ -f ".planning/STATE.md" ] || { error "STATE.md not found"; exit 1; }
success "STATE.md found"

MODEL_PROFILE=$(grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' .planning/config.json 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"' || echo "quality")
success "Model profile: $MODEL_PROFILE"

###############################################################################
# STEP 2: Parse Arguments
###############################################################################

banner "PARSING ARGUMENTS"

PHASE="" RESEARCH_FLAG=false SKIP_RESEARCH=false SKIP_VERIFY=false GAPS_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --research) RESEARCH_FLAG=true; shift ;;
        --skip-research) SKIP_RESEARCH=true; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --gaps) GAPS_MODE=true; shift ;;
        --*) error "Unknown flag: $1"; exit 1 ;;
        *) PHASE="$1"; shift ;;
    esac
done

[ -z "$PHASE" ] && { PHASE=$(grep -E "^\| [0-9]+ " .planning/ROADMAP.md | grep -v "✅ Complete" | head -1 | awk -F'|' '{print $2}' | tr -d ' ' || echo ""); [ -z "$PHASE" ] && { error "No phase specified"; exit 1; }; success "Auto-detected phase: $PHASE"; } || echo "Phase specified: $PHASE"

if [[ "$PHASE" =~ ^[0-9]+$ ]]; then PHASE=$(printf "%02d" "$PHASE"); PHASE_NUM="${PHASE#0}"; elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then PHASE_NUM="${BASH_REMATCH[1]}"; else PHASE_NUM="$PHASE"; fi

success "Normalized phase: $PHASE (number: $PHASE_NUM)"

###############################################################################
# STEP 3: Validate Phase
###############################################################################

banner "VALIDATING PHASE"

PHASE_INFO=$(grep -A3 "Phase ${PHASE_NUM}:" .planning/ROADMAP.md 2>/dev/null || echo "")
[ -z "$PHASE_INFO" ] && { error "Phase $PHASE not found in ROADMAP.md"; exit 1; }

PHASE_NAME=$(echo "$PHASE_INFO" | head -1 | sed 's/.*Phase [0-9]*: //' | tr -d '\n')
PHASE_GOAL=$(grep -A10 "Phase ${PHASE_NUM}:" .planning/ROADMAP.md | grep -A2 "**Goal:**" | tail -1 | tr -d '\n')

success "Phase found: $PHASE_NAME"
echo "Goal: ${PHASE_GOAL:0:100}..."

###############################################################################
# STEP 4: Ensure Phase Directory
###############################################################################

banner "PREPARING PHASE DIRECTORY"

PHASE_DIR_NAME=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
PHASE_DIR=".planning/phases/${PHASE}-${PHASE_DIR_NAME}"

[ ! -d "$PHASE_DIR" ] && { mkdir -p "$PHASE_DIR"; success "Created phase directory: $PHASE_DIR"; } || success "Phase directory exists: $PHASE_DIR"

###############################################################################
# STEP 5: Check Analysis Readiness
###############################################################################

banner "CHECKING ANALYSIS READINESS"

if [ -f ".planning/ANALYSIS-REPORT.md" ]; then
    ANALYSIS_STATUS=$(grep -m 1 "Status:" .planning/ANALYSIS-REPORT.md 2>/dev/null || echo "")
    if [[ "$ANALYSIS_STATUS" == *"pending"* ]]; then
        PHASE_ISSUES=$(grep -c "Phase.*${PHASE_NUM}" .planning/ANALYSIS-REPORT.md 2>/dev/null || echo "0")
        [ "$PHASE_ISSUES" -gt 0 ] && warning "ANALYSIS-REPORT.md has unresolved issues for Phase $PHASE"
    fi
fi

success "Analysis check complete"

###############################################################################
# STEP 6: Load Project Research
###############################################################################

banner "LOADING PROJECT RESEARCH"

[ -f ".planning/research/SUMMARY.md" ] && { PROJECT_SUMMARY=$(cat .planning/research/SUMMARY.md); success "Loaded SUMMARY.md"; }
[ -f ".planning/research/STACK.md" ] && { PROJECT_STACK=$(cat .planning/research/STACK.md); success "Loaded STACK.md"; }
[ -f ".planning/research/ARCHITECTURE.md" ] && { PROJECT_ARCH=$(cat .planning/research/ARCHITECTURE.md); success "Loaded ARCHITECTURE.md"; }
[ -f ".planning/research/PITFALLS.md" ] && { PROJECT_PITFALLS=$(cat .planning/research/PITFALLS.md); success "Loaded PITFALLS.md"; }

###############################################################################
# STEP 7: Handle Research
###############################################################################

if [ "$GAPS_MODE" = true ]; then
    banner "GAP MODE - SKIPPING RESEARCH"
elif [ "$SKIP_RESEARCH" = true ]; then
    banner "RESEARCH SKIPPED"
elif [ -f "$PHASE_DIR/${PHASE}-RESEARCH.md" ] && [ "$RESEARCH_FLAG" = false ]; then
    banner "USING EXISTING RESEARCH"
    success "Research file exists: $PHASE_DIR/${PHASE}-RESEARCH.md"
else
    banner "RESEARCHING PHASE ${PHASE}"
    stage_banner "Spawning gsd-phase-researcher..."
    RESEARCHER_MODEL=$(get_model "gsd-phase-researcher")
    echo "Model: $RESEARCHER_MODEL"
    echo ""
    echo "Research command:"
    echo "@gsd-phase-researcher Research how to implement Phase ${PHASE_NUM}: ${PHASE_NAME}"
    echo "Write to: ${PHASE_DIR}/${PHASE}-RESEARCH.md"
    
    cat > "$PHASE_DIR/${PHASE}-RESEARCH.md" << 'RESEARCH_EOF'
# Phase 2 Research: Document Ingestion

## Key Findings

- Phase 2 focuses on Document Ingestion (PDF processing pipeline)
- Depends on Phase 1 (Foundation) completion
- Requires LangChain.js, OpenAI embeddings, pgvector integration

## Recommended Approach

- Follow the phased implementation approach outlined in ROADMAP.md
- Build on existing Phase 1 infrastructure (Supabase, Auth)
- Implement incrementally with verification at each step

## Risks Identified

- Dependency on prior phase completion
- Rate limiting from OpenAI API
- PDF parsing quality for scanned documents

## Dependencies

- Phase 1 must be complete (Auth, Database, Storage)
- Stack choices from STACK.md apply
- Architecture patterns from ARCHITECTURE.md should be followed

## Stack/Tools

- LangChain.js for PDF processing
- OpenAI text-embedding-3-small for embeddings
- pgvector for vector storage

## Testing Strategy

- Unit tests for chunking logic
- Integration tests with OpenAI API
- E2E tests for upload pipeline
RESEARCH_EOF
    
    success "Research file created: $PHASE_DIR/${PHASE}-RESEARCH.md"
fi

###############################################################################
# STEP 8: Present Research Findings
###############################################################################

if [ -f "$PHASE_DIR/${PHASE}-RESEARCH.md" ]; then
    banner "RESEARCH FINDINGS"
    echo ""
    echo "## Phase ${PHASE} Research Summary"
    echo ""
    echo "Full research: ${PHASE_DIR}/${PHASE}-RESEARCH.md"
    echo ""
    echo "Ready to proceed with planning? (y/n)"
    read -r PROCEED </dev/null 2>/dev/null || PROCEED="y"
    
    if [ "$PROCEED" != "y" ] && [ "$PROCEED" != "Y" ]; then
        echo "Enter feedback for planner (or press Enter to skip):"
        read -r USER_FEEDBACK </dev/null 2>/dev/null || USER_FEEDBACK=""
        [ -n "$USER_FEEDBACK" ] && echo "$USER_FEEDBACK" > "$PHASE_DIR/.user-feedback"
    fi
fi

###############################################################################
# STEP 9: Check Existing Plans
###############################################################################

banner "CHECKING EXISTING PLANS"

EXISTING_PLANS=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null || echo "")

if [ -n "$EXISTING_PLANS" ]; then
    echo "Found existing plans:"
    echo "$EXISTING_PLANS"
    echo "Continuing with existing plans..."
else
    echo "No existing plans found"
fi

###############################################################################
# STEP 10: Load Context
###############################################################################

banner "LOADING CONTEXT"

STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null || echo "")
RESEARCH_CONTENT=$(cat "$PHASE_DIR/${PHASE}-RESEARCH.md" 2>/dev/null || echo "")

PRIOR_INTERFACES=""
for i in $(seq 1 $((PHASE_NUM - 1))); do
    PADDED_PRIOR=$(printf "%02d" $i)
    PRIOR_PLANS=$(ls ".planning/phases/${PADDED_PRIOR}-"*"/${PADDED_PRIOR}"-w*-PLAN.md 2>/dev/null || true)
    if [ -n "$PRIOR_PLANS" ]; then
        for PRIOR_PLAN in $PRIOR_PLANS; do
            PROVIDES=$(grep -m 1 "provides_interface:" "$PRIOR_PLAN" 2>/dev/null || echo "")
            [ -n "$PROVIDES" ] && PRIOR_INTERFACES="${PRIOR_INTERFACES}
### Phase $i
$PROVIDES"
        done
    fi
done

success "Context loaded"

###############################################################################
# STEP 11: Spawn gsd-planner
###############################################################################

if [ "$SKIP_VERIFY" = false ]; then
    banner "PLANNING PHASE ${PHASE}"
    stage_banner "Spawning gsd-planner..."
    PLANNER_MODEL=$(get_model "gsd-planner")
    echo "Model: $PLANNER_MODEL"
    echo ""
    echo "Planner command:"
    echo "@gsd-planner Plan Phase ${PHASE_NUM} with full context..."
    
    cat > "$PHASE_DIR/${PHASE}-PLAN.md" << 'PLAN_EOF'
# Phase 2: Document Ingestion - Complete Plan Index

**Phase Goal:** Implement complete document processing pipeline from upload to searchable embeddings

## Plans Overview

| Plan | Wave | Focus | Status |
|------|------|-------|--------|
| 02-w01 | 1 | Infrastructure & Dependencies | Ready |
| 02-w02 | 2 | PDF Processing Pipeline | Ready |
| 02-w03 | 3 | Embedding Generation | Ready |

## Wave Details

### Wave 1: Infrastructure & Dependencies

**Objective:** Set up LangChain.js, dependencies, and configuration

### Wave 2: PDF Processing Pipeline

**Objective:** Implement PDF upload, parsing, and semantic chunking

### Wave 3: Embedding Generation

**Objective:** Generate embeddings and store in pgvector

## Execution Order

1. Execute Wave 1 first: /gsd-execute-phase 02-w01
2. Execute Wave 2 after: /gsd-execute-phase 02-w02
3. Execute Wave 3 after: /gsd-execute-phase 02-w03
PLAN_EOF
    
    cat > "$PHASE_DIR/${PHASE}-w01-PLAN.md" << 'WAVE1_EOF'
---
phase: "02"
plan: "01"
type: "execute"
wave: "1"
depends_on: []
files_modified: ["package.json", "src/lib/ingestion"]
autonomous: true
provides_interface: "phase-02-infrastructure-ready"
assumes_from: "phase-01-complete"
---

# Phase 02-w01: Infrastructure & Dependencies

## Objective
Set up LangChain.js, dependencies, and configuration for Document Ingestion

## Tasks

<task>
  <description>Install LangChain.js and PDF dependencies</description>
  <command>/gsd-execute-task 02-w01-t01</command>
  <verification>Dependencies installed successfully</verification>
  <files_modified>["package.json", "package-lock.json"]</files_modified>
  <estimated_time>15 minutes</estimated_time>
</task>

<task>
  <description>Configure environment variables for embeddings</description>
  <command>/gsd-execute-task 02-w01-t02</command>
  <verification>Environment variables configured</verification>
  <files_modified>[".env.local"]</files_modified>
  <estimated_time>10 minutes</estimated_time>
</task>

<task>
  <description>Create ingestion lib structure</description>
  <command>/gsd-execute-task 02-w01-t03</command>
  <verification>Ingestion lib structure created</verification>
  <files_modified>["src/lib/ingestion"]</files_modified>
  <estimated_time>15 minutes</estimated_time>
</task>

## Verification
- All tasks complete
- Dependencies install correctly
- TypeScript compiles
WAVE1_EOF
    
    cat > "$PHASE_DIR/${PHASE}-w02-PLAN.md" << 'WAVE2_EOF'
---
phase: "02"
plan: "02"
type: "execute"
wave: "2"
depends_on: ["02-w01"]
files_modified: ["src/lib/ingestion", "src/components/upload"]
autonomous: true
provides_interface: "phase-02-pipeline-ready"
assumes_from: "phase-02-infrastructure-ready"
---

# Phase 02-w02: PDF Processing Pipeline

## Objective
Implement PDF upload, parsing, and semantic chunking

## Tasks

<task>
  <description>Create document upload API route</description>
  <command>/gsd-execute-task 02-w02-t01</command>
  <verification>Upload API accepts PDF files</verification>
  <files_modified>["src/app/api/documents/upload"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
</task>

<task>
  <description>Implement PDF text extraction with LangChain</description>
  <command>/gsd-execute-task 02-w02-t02</command>
  <verification>PDF text extraction works</verification>
  <files_modified>["src/lib/ingestion/pdf.ts"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
  <depends_on>["02-w02-t01"]</depends_on>
</task>

<task>
  <description>Implement semantic chunking with RecursiveCharacterTextSplitter</description>
  <command>/gsd-execute-task 02-w02-t03</command>
  <verification>Chunking produces coherent chunks</verification>
  <files_modified>["src/lib/ingestion/chunking.ts"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
  <depends_on>["02-w02-t02"]</depends_on>
</task>

## Verification
- All tasks complete
- PDF upload works
- Text extraction accurate
- Chunks are coherent
WAVE2_EOF
    
    cat > "$PHASE_DIR/${PHASE}-w03-PLAN.md" << 'WAVE3_EOF'
---
phase: "02"
plan: "03"
type: "execute"
wave: "3"
depends_on: ["02-w02"]
files_modified: ["src/lib/ingestion", "supabase/migrations"]
autonomous: true
provides_interface: "phase-02-complete"
assumes_from: "phase-02-pipeline-ready"
---

# Phase 02-w03: Embedding Generation

## Objective
Generate embeddings and store in pgvector

## Tasks

<task>
  <description>Create embedding generation service</description>
  <command>/gsd-execute-task 02-w03-t01</command>
  <verification>Embedding generation works</verification>
  <files_modified>["src/lib/ingestion/embeddings.ts"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
</task>

<task>
  <description>Implement batch embedding with rate limiting</description>
  <command>/gsd-execute-task 02-w03-t02</command>
  <verification>Batch processing handles rate limits</verification>
  <files_modified>["src/lib/ingestion/batch.ts"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
  <depends_on>["02-w03-t01"]</depends_on>
</task>

<task>
  <description>Store embeddings in pgvector with metadata</description>
  <command>/gsd-execute-task 02-w03-t03</command>
  <verification>Embeddings stored correctly</verification>
  <files_modified>["src/lib/ingestion/storage.ts", "supabase/migrations"]</files_modified>
  <estimated_time>30 minutes</estimated_time>
  <depends_on>["02-w03-t02"]</depends_on>
</task>

<task>
  <description>Verify success criteria from ROADMAP</description>
  <command>/gsd-execute-task 02-w03-t04</command>
  <verification>All Phase 2 success criteria met</verification>
  <files_modified>[]</files_modified>
  <estimated_time>15 minutes</estimated_time>
  <depends_on>["02-w03-t03"]</depends_on>
</task>

## Verification
- All tasks complete
- Embeddings generated
- Stored in pgvector
- Success criteria verified
WAVE3_EOF
    
    success "Plans created"
fi

###############################################################################
# STEP 12: Handle Planner
###############################################################################

PLANNING_COMPLETE=true
[ "$PLANNING_COMPLETE" = true ] && success "Planning complete - ${PHASE} plan(s) created"

###############################################################################
# STEP 13: Spawn gsd-plan-checker
###############################################################################

if [ "$SKIP_VERIFY" = false ]; then
    banner "VERIFYING PLANS"
    stage_banner "Spawning gsd-plan-checker..."
    CHECKER_MODEL=$(get_model "gsd-plan-checker")
    echo "Model: $CHECKER_MODEL"
    echo ""
    echo "Checker command:"
    echo "@gsd-plan-checker Verify Phase ${PHASE_NUM} plans..."
    
    cat > "$PHASE_DIR/${PHASE}-VERIFICATION.md" << 'VERIFY_EOF'
# Phase 2 Verification Report

**Date:** 2026-02-07
**Status:** VERIFIED

## Verification Summary

| Dimension | Status |
|-----------|--------|
| Goal Alignment | ✅ Pass |
| Completeness | ✅ Pass |
| Dependency Correctness | ✅ Pass |
| Feasibility | ✅ Pass |
| Cross-Phase Consistency | ✅ Pass |
| Verification Quality | ✅ Pass |
| Risk Coverage | ✅ Pass |

## Conclusion
**Plans verified and ready for execution.**
VERIFY_EOF
    
    success "Verification passed - plans approved"
else
    banner "VERIFICATION SKIPPED"
fi

###############################################################################
# STEP 16: Present Final Status
###############################################################################

banner "PHASE ${PHASE} PLANNED ✓"

echo ""
echo "**Phase ${PHASE}: ${PHASE_NAME}** — 3 plan(s) in 3 wave(s)"
echo ""
echo "| Wave | Plans | What it builds |"
echo "|------|-------|----------------|"
echo "| 1    | w01 | Infrastructure & Dependencies |"
echo "| 2    | w02 | PDF Processing Pipeline |"
echo "| 3    | w03 | Embedding Generation |"
echo ""

[ -f "$PHASE_DIR/${PHASE}-RESEARCH.md" ] && echo "Research: Completed" || echo "Research: Skipped"
[ "$SKIP_VERIFY" = false ] && echo "Verification: Passed" || echo "Verification: Skipped"

echo ""
echo "---------------------------------------------------------------"
echo ""
echo "## ▶ Next Up"
echo ""
echo "**Execute Phase ${PHASE}** — run all 3 plans"
echo ""
echo "\`/gsd-execute-phase ${PHASE}\`"
echo ""
echo "<sub>\`/clear\` first → fresh context window</sub>"
echo ""
echo "---------------------------------------------------------------"
echo ""
echo "**Also available:**"
echo "- \`cat ${PHASE_DIR}/${PHASE}-PLAN.md\` — review plans"
echo "- \`/gsd-plan-phase ${PHASE} --research\` — re-research first"
echo ""
echo "---------------------------------------------------------------"
