# Brutal Honesty Integration

**Status**: ✅ **Built into Ralph Workflow System**

---

## Overview

Brutal honesty is now **built into** the Ralph workflow system and cohesion engine by default. You no longer need to explicitly request "brutal honesty" - it's automatic.

---

## How It Works

### 1. **Automatic Prompt Enhancement**

When you start a Ralph workflow, brutal honesty requirements are automatically added to the prompt:

```bash
pnpm ralph:start "Assess codebase cohesion"
# Automatically includes brutal honesty requirements
```

**What Gets Added**:
- Brutal honesty criteria (blunt language, quantitative evidence, code examples)
- Explicit requirements (no euphemisms, realistic grades)
- Validation notice (assessment will be checked)

**To Disable** (not recommended):
```bash
pnpm ralph:start "Assess codebase" --no-brutal-honesty
```

### 2. **Automatic Assessment Validation**

When assessments are generated, they're automatically validated for brutal honesty:

```bash
pnpm cohesion:assess
# Automatically validates brutal honesty score
# Enhances if needed
```

**Validation Checks**:
- ✅ Uses blunt, direct language (not euphemisms)
- ✅ Includes quantitative evidence (numbers, percentages)
- ✅ Includes code examples (file:line references)
- ✅ Identifies root causes (explains WHY)
- ✅ Uses severity ratings (CRITICAL/HIGH/MEDIUM/LOW)
- ✅ Provides honest grade (not inflated)
- ✅ Includes "Would I Use This" assessment

**Scoring**:
- **70+ points**: Passes brutal honesty validation
- **< 70 points**: Automatically enhanced, warnings shown

### 3. **Automatic Enhancement**

If an assessment doesn't meet brutal honesty standards, it's automatically enhanced:

- Adds missing required phrases ("Bottom Line", "Would I Use This")
- Replaces euphemisms with direct language
- Adds missing sections

---

## Validation Criteria

### Required Elements (Score: 0-100)

1. **Blunt Language** (15 points)
   - Uses words like "painful", "frustrating", "broken"
   - Avoids euphemisms like "needs improvement"

2. **Quantitative Evidence** (15 points)
   - Includes specific numbers (file counts, percentages)
   - Not vague like "some" or "many"

3. **Code Examples** (15 points)
   - Shows file:line references
   - Includes actual code snippets

4. **Root Cause Analysis** (10 points)
   - Explains WHY issues exist
   - Not just WHAT they are

5. **Avoids Euphemisms** (15 points)
   - No "could be improved" or "needs work"
   - Direct, honest language

6. **Severity Ratings** (10 points)
   - Uses CRITICAL/HIGH/MEDIUM/LOW
   - Not just "issues"

7. **Honest Grade** (10 points)
   - Realistic grade (D+, C-, etc.)
   - Not inflated

8. **"Would I Use This"** (10 points)
   - Honest assessment of production readiness
   - Clear recommendation

---

## Usage Examples

### Cohesion Assessment (Automatic)

```bash
# Start Ralph workflow for cohesion improvement
pnpm ralph:start "Improve codebase cohesion" --completion-promise "DONE"

# Run cohesion workflow
pnpm cohesion:ralph workflow
# → Automatically includes brutal honesty
# → Validates assessments
# → Enhances if needed
```

### Direct Assessment (Automatic)

```bash
# Generate assessment
pnpm cohesion:assess
# → Automatically validates brutal honesty
# → Shows score and violations
# → Enhances if needed
```

### Manual Ralph Workflow (Automatic)

```bash
# Start any workflow
pnpm ralph:start "Refactor authentication system"
# → Automatically includes brutal honesty requirements in prompt
# → Agent will use brutal honesty by default
```

---

## What Gets Validated

### Assessment Text

- Language patterns (blunt vs. euphemistic)
- Quantitative evidence presence
- Code example presence
- Required phrases ("Bottom Line", "Would I Use This")
- Severity ratings
- Grade presence

### Analysis Results

- Grade inflation (A/B with critical issues = inflated)
- Missing severity ratings
- Missing evidence

---

## Output Examples

### Passed Validation

```
✅ Brutal honesty validation passed (85/100)
```

### Failed Validation (Auto-Enhanced)

```
⚠️  Brutal honesty score: 45/100
⚠️  Violations: 4
ℹ️  Enhancing assessment with brutal honesty...
  - Added "Bottom Line" section to executive summary
  - Replaced euphemism with blunt language
✅ Assessment now meets brutal honesty standards
```

### Failed Validation (Needs Manual Review)

```
⚠️  Assessment still needs improvement. Score: 65/100. Suggestions:
  - Use words like "painful", "frustrating", "broken" instead of euphemisms
  - Include specific numbers (file counts, percentages, line numbers)
  - Include "Would I Use This" assessment
```

---

## Configuration

### Enable/Disable Brutal Honesty

**Default**: Enabled for all workflows

**Disable for specific workflow**:
```bash
pnpm ralph:start "Assess codebase" --no-brutal-honesty
```

**Check if enabled**:
- Look for "Brutal honesty mode enabled" message when starting workflow

---

## Benefits

1. **No More Asking** - Brutal honesty is automatic
2. **Consistent Quality** - All assessments meet standards
3. **Automatic Enhancement** - Fixes violations automatically
4. **Clear Validation** - Shows score and violations
5. **Built-in Enforcement** - Can't skip brutal honesty

---

## Technical Details

### Files

- `scripts/cohesion/utils/brutal-honesty.ts` - Validation and enhancement logic
- `scripts/cohesion/assess.ts` - Automatic validation on generation
- `scripts/cohesion/ralph.ts` - Validation in Ralph workflow
- `scripts/ralph/start.ts` - Automatic prompt enhancement

### Functions

- `validateBrutalHonesty()` - Validates assessment text
- `enhanceWithBrutalHonesty()` - Enhances assessment if needed
- `generateBrutalHonestyPromptPrefix()` - Adds requirements to prompts
- `validateAnalysisForBrutalHonesty()` - Validates analysis results

---

## Future Enhancements

1. **Custom Rules** - Allow custom brutal honesty criteria
2. **Score Thresholds** - Configurable minimum scores
3. **Domain-Specific Rules** - Different rules for different domains
4. **Learning Mode** - Learn from manual corrections

---

## See Also

- `scripts/cohesion/utils/brutal-honesty.ts` - Implementation
- `BRUTAL_RALPH_COHESION_ASSESSMENT.md` - Example brutal assessment
- `DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md` - Generated assessment (validated)
