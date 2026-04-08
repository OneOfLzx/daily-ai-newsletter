---
name: newsletter-generation
description: Use this skill when the user requests to generate, create, write, or draft a newsletter, email digest, weekly roundup, industry briefing, or curated content summary. Supports topic-based research, content curation from multiple sources, and professional formatting for email or web distribution. Trigger on requests like "create a newsletter about X", "write a weekly digest", "generate a tech roundup", or "curate news about Y".
---

# Newsletter Generation Skill

## Overview

This skill generates professional, well-researched newsletters that combine curated content with original analysis and commentary. It follows modern newsletter best practices from publications like Morning Brew, The Hustle, TLDR, and Benedict Evans to produce content that is informative, engaging, and actionable.

The output is a complete, ready-to-publish newsletter in Markdown format, suitable for email distribution platforms, web publishing, or conversion to HTML.

## Core Capabilities

- Generate topic-focused or multi-topic newsletters with consistent voice
- Write engaging summaries and original commentary
- Structure content for optimal readability and scanning
- Support multiple newsletter formats (daily digest, weekly roundup, deep-dive, industry briefing)
- Adapt tone and style to target audience (technical, executive, general)
- Generate recurring newsletter series with consistent branding and structure

## When to Use This Skill

**Always load this skill when:**

- User asks to generate a newsletter, email digest, or content roundup
- User requests a curated summary of news or developments on a topic
- User wants to create a recurring newsletter format
- User asks to compile recent developments in a field into a briefing
- User needs a formatted email-ready content piece with multiple curated items
- User asks for a "weekly roundup", "monthly digest", or "morning briefing"

## Newsletter Workflow

### Phase 1: Planning

#### Step 1.1: Understand Newsletter Requirements

Identify the key parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Topic(s)** | Primary subject area(s) to cover | Required |
| **Format** | Daily digest, weekly roundup, deep-dive, or industry briefing | Weekly roundup |
| **Target Audience** | Technical, executive, general, or niche community | General |
| **Tone** | Professional, conversational, witty, or analytical | Conversational-professional |
| **Length** | Short (5-min read), medium (10-min), long (15-min+) | Medium |
| **Sections** | Number and type of content sections | 4-6 sections |
| **Frequency Context** | One-time or part of a recurring series | One-time |

#### Step 1.2: Define Newsletter Structure

**Deep-Dive Structure**:
```
1. Introduction & Context
2. Background / Why It Matters
3. Key Developments (detailed analysis)
4. Expert Perspectives
5. What's Next / Implications
6. Further Reading
```

### Phase 2: Writing

#### Step 2.1: Newsletter Header

Every newsletter starts with a consistent header:

```markdown
# [Newsletter Name]

*[Tagline or description] — [Date]*

---

[Optional: One-sentence preview of what's inside]
```

#### Step 2.2: Section Writing Guidelines

**Top Stories / Featured Items**:
- **Hook**: Opening sentence that makes the reader care (1-2 sentences)
- **Body**: Key facts and context (2-4 paragraphs)
- **Why it matters**: Connect to the reader's world (1 paragraph)

**Quick Bites / Brief Items**:
- **Format**: 2-3 sentence summary
- **Focus**: One key takeaway per item
- **Efficiency**: Readers should get the essential insight without clicking through

**Analysis / Commentary Sections**:
- **Voice**: The newsletter's unique perspective on trends or developments
- **Structure**: Observation → Context → Implication → (Optional) Actionable takeaway

#### Step 2.3: Writing Standards

| Principle | Implementation |
|-----------|---------------|
| **Scannable** | Use bold text, bullet points, and short paragraphs |
| **Engaging** | Lead with the most interesting angle, not chronological order |
| **Concise** | Every sentence earns its place — cut filler ruthlessly |
| **Accurate** | Every fact is sourced, every number is verified |
| **Human** | Write like a knowledgeable friend, not a press release |

**Tone Calibration by Audience**:

| Audience | Tone | Example |
|----------|------|---------|
| **Technical** | Precise, no jargon explanations, assumed expertise | "The new API supports gRPC streaming with backpressure handling via flow control windows." |
| **Executive** | Impact-focused, bottom-line, strategic | "This acquisition gives Company X a 40% market share in the enterprise segment, directly threatening Incumbent Y's pricing power." |
| **General** | Accessible, analogies, explains concepts | "Think of it like a universal translator for data — it lets any app talk to any database without learning a new language." |

### Phase 3: Assembly & Polish

#### Step 3.1: Assemble the Newsletter

Combine all sections into the final document following the chosen structure template.

#### Step 3.2: Quality Checklist

Before finalizing, verify:

- [ ] **Date references use the actual current date** — No hardcoded or assumed dates
- [ ] **Content is current** — All major items are from within the expected timeframe
- [ ] **No duplicate stories** — Each item appears only once
- [ ] **Consistent formatting** — bullets use the same style throughout
- [ ] **Appropriate length** — Matches the specified length target
- [ ] **Engaging opening** — The first 2 sentences make the reader want to continue
- [ ] **Clear closing** — The newsletter ends with a memorable or actionable note
- [ ] **Proofread** — No typos, broken formatting, or incomplete sentences


## Adaptation Examples

### Technology Newsletter
- Emoji usage: ✅ Moderate
- Sections: Top Stories, Deep Dive, Quick Bites, Open Source Spotlight, Dev Tools
- Tone: Technical-conversational

### Business/Finance Newsletter
- Emoji usage: ❌ Minimal to none
- Sections: Market Overview, Deal Flow, Company News, Data Corner, Outlook
- Tone: Professional-analytical

### Industry-Specific Newsletter
- Emoji usage: Moderate
- Sections: Regulatory Updates, Market Data, Innovation Watch, People Moves, Events
- Tone: Expert-authoritative

### Creative/Marketing Newsletter
- Emoji usage: ✅ Liberal
- Sections: Campaign Spotlight, Trend Watch, Viral This Week, Tools We Love, Inspiration
- Tone: Enthusiastic-professional

## Notes

- This skill works best in combination with the `deep-research` skill for comprehensive topic coverage — load both for newsletters requiring deep analysis
- Always use `<current_date>` for temporal context in searches and date references in the newsletter
- For recurring newsletters, suggest maintaining a consistent structure so readers develop expectations
- When curating, quality beats quantity — 5 excellent items beat 15 mediocre ones
- Avoid summarizing paywalled content that the reader cannot access
- If the user provides specific URLs or articles to include, incorporate them alongside your curated findings
- The newsletter should provide enough value in the summaries that readers benefit even without clicking through to every link
