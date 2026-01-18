# Agency Dashboard MVP: Cursor IDE for Content Management

## Executive Summary
Build a sophisticated admin dashboard that combines AI agent chat interfaces with live website preview and data visualization, similar to Cursor IDE but for agency content management.

## Current State Assessment (Brutal Honesty)

### ✅ What's Working
- **Multi-tenant user system** with hierarchical roles (Super Admin → Admin → Tenant Admin)
- **Comprehensive agent schemas** (context, memory, conversations, tools, actions)
- **AI orchestration framework** with memory integration and tool calling
- **Basic admin dashboard** with CRUD operations for collections
- **Authentication & authorization** with role-based access control
- **Database layer** supporting both SQLite and PostgreSQL with role scoping

### ❌ Critical Gaps
- **No agent chat interface** - Current admin is CRUD-only, not conversational
- **No data visualization** - Only basic table views, no charts/graphs/analytics
- **No live preview** - No website preview functionality
- **No multi-pane layout** - Single-pane interface vs desired IDE-style layout
- **No role-based agent access** - All agents available to all users regardless of role/subscription
- **No paywall integration** - No subscription/feature gating

---

## Target User Experience

### Layout (Cursor IDE Inspired)
```
┌─────────────────────────────────────────────────┐
│ Left Panel (25%)    │ Right Panel (75%)         │
├─────────────────────┼───────────────────────────┤
│                     │                           │
│ Agent Management    │ Live Preview (Top 60%)   │
│                     │                           │
│ • Active Agents     ├───────────────────────────┤
│ • Archived Agents   │                           │
│ • New Agent Button  │ Data Visualization        │
│                     │ (Bottom 40%)             │
│                     │                           │
└─────────────────────┴───────────────────────────┘
```

### Agent Chat Interface
- **Multi-pane conversations** similar to Cursor
- **Agent-specific contexts** maintained across sessions
- **Natural language queries** → structured data responses
- **Tool execution** with real-time feedback
- **Conversation history** and search

### Data Visualization Engine
- **Natural Language Queries**: "Show me top performing pages this month"
- **Multiple Output Formats**:
  - Tables (sortable, filterable, exportable)
  - Charts (bar, line, pie, scatter)
  - Graphs (network, flow, hierarchy)
- **Interactive Filtering** and drill-down capabilities
- **Real-time Updates** from live data sources

### Role-Based Access & Paywalling
- **Super Admin**: Full access to all agents and features
- **Agency Admin**: Access to basic agents, limited advanced features
- **Agency Users**: Subscription-based agent access
- **Paywall Integration**: Stripe subscription management

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
**Goal**: Build the multi-pane layout and basic agent chat interface

#### 1.1 Multi-Pane Layout System
- **Create resizable pane system** using react-resizable-panels
- **Implement left sidebar** for agent management
- **Build right panel** with preview + data viz split
- **Add responsive design** for mobile/tablet

#### 1.2 Agent Management Panel
- **Active Agents List** with status indicators
- **Archived Agents** with search/filter
- **New Agent Creation** with templates
- **Agent Switching** with context preservation

#### 1.3 Basic Chat Interface
- **Message input/output** components
- **Conversation threading** per agent
- **Message persistence** in database
- **Basic agent responses** (placeholder)

#### 1.4 Role-Based Access Control
- **Extend existing auth** to agent permissions
- **Agent visibility** based on user role/subscription
- **Paywall placeholders** for premium features

### Phase 2: Data Visualization Engine (Week 3-4)
**Goal**: Build comprehensive data querying and visualization

#### 2.1 Natural Language Query Parser
- **NLP processing** for user queries
- **Intent classification** (what data, how to display)
- **Entity extraction** (time ranges, filters, etc.)
- **Query translation** to database operations

#### 2.2 Data Sources Integration
- **CMS Content Queries** (pages, posts, users)
- **Analytics Data** (page views, conversions)
- **Performance Metrics** (load times, errors)
- **Real-time Data Streams** from live sites

#### 2.3 Visualization Components
- **Table Component** (sortable, filterable, paginated)
- **Chart Library Integration** (recharts/d3)
- **Interactive Filters** and controls
- **Export Capabilities** (CSV, PDF, images)

#### 2.4 Query Result Formatting
- **Automatic format selection** based on data type
- **Custom visualization** options
- **Saved queries** and favorites
- **Query history** and sharing

### Phase 3: Live Preview System (Week 5-6)
**Goal**: Real-time website preview and editing

#### 3.1 Preview Engine
- **Iframe-based preview** of agency websites
- **Live reload** on content changes
- **Responsive testing** (mobile/desktop breakpoints)
- **Cross-origin handling** for external sites

#### 3.2 Content Synchronization
- **Real-time updates** from CMS changes
- **Preview of unpublished content**
- **Version comparison** (current vs draft)
- **Rollback capabilities**

#### 3.3 Interactive Editing
- **Click-to-edit** content elements
- **Visual page builder** integration
- **Drag-and-drop** component placement
- **Style customization** preview

### Phase 4: Advanced Agent Features (Week 7-8)
**Goal**: Full AI agent integration and orchestration

#### 4.1 Agent Orchestration
- **Multi-agent conversations**
- **Agent delegation** and collaboration
- **Task planning** and execution
- **Memory sharing** between agents

#### 4.2 Specialized Agents
- **Content Creation Agent** (writes blog posts, landing pages)
- **SEO Optimization Agent** (analyzes and suggests improvements)
- **Data Analysis Agent** (insights and recommendations)
- **Customer Support Agent** (handles user inquiries)

#### 4.3 Tool Integration
- **CMS manipulation tools** (create/edit content)
- **Analytics tools** (query performance data)
- **External API tools** (social media, email marketing)
- **File management tools** (upload, process documents)

---

## Technical Architecture

### Frontend Stack
- **Next.js 16** with App Router
- **React 19** with concurrent features
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Key Libraries
- **react-resizable-panels** - Multi-pane layout
- **recharts** or **d3** - Data visualization
- **react-markdown** - Rich text rendering
- **socket.io-client** - Real-time updates
- **react-query** - Data fetching and caching

### Backend Integration
- **Existing RevealUI CMS** as data source
- **Agent orchestration** via existing AI package
- **Real-time subscriptions** for live updates
- **Role-based API endpoints**

---

## Risk Assessment & Mitigation

### High Risk: Agent Complexity
**Risk**: Building full AI agent orchestration is technically complex
**Mitigation**:
- Start with simple agent chat (Phase 1)
- Use existing agent schemas as foundation
- Build incrementally with working prototypes

### High Risk: Data Visualization Performance
**Risk**: Complex queries and visualizations may be slow
**Mitigation**:
- Implement query optimization and caching
- Start with simple table views
- Add performance monitoring early

### Medium Risk: Live Preview CORS Issues
**Risk**: Cross-origin issues when previewing external websites
**Mitigation**:
- Start with same-origin previews (agency subdomains)
- Implement proxy server for external sites
- Provide fallback static previews

---

## Success Metrics

### Phase 1 Success (Week 2)
- ✅ Multi-pane layout working
- ✅ Basic agent chat interface functional
- ✅ Role-based agent access implemented
- ✅ 3+ agents available for testing

### Phase 2 Success (Week 4)
- ✅ Natural language queries working
- ✅ Data visualization renders correctly
- ✅ 5+ chart types supported
- ✅ Query performance <2 seconds

### Phase 3 Success (Week 6)
- ✅ Live website preview working
- ✅ Real-time content synchronization
- ✅ Cross-device responsive testing
- ✅ Visual editing capabilities

### Phase 4 Success (Week 8)
- ✅ 5+ specialized agents functional
- ✅ Agent orchestration working
- ✅ Full tool integration complete
- ✅ Production deployment ready

---

## Go-to-Market Strategy

### Phase 1 Launch (Week 2)
- **Internal beta** with select agencies
- **Basic agent chat** + data tables only
- **Gather feedback** on UX and core functionality

### Phase 2 Launch (Week 4)
- **Public beta** with data visualization
- **Marketing focus**: "AI-powered content management"
- **Pricing**: Freemium with premium agents

### Full Launch (Week 8)
- **Complete product** with all features
- **Agency-focused positioning**
- **Enterprise sales** for large agencies

---

## Development Priorities

### Immediate Focus (Start Here)
1. **Multi-pane layout** - Foundation of the UX
2. **Basic agent chat** - Core interaction model
3. **Role-based access** - Security and business model
4. **Simple data queries** - Start with tables, add charts later

### Avoid These Traps
- **Don't build advanced agents first** - Start simple
- **Don't over-engineer data viz** - Tables first, fancy charts later
- **Don't focus on live preview initially** - Chat + data first
- **Don't build for scale prematurely** - Get MVP working first

---

## Conclusion

This plan transforms the existing RevealUI infrastructure into a **Cursor IDE for agency content management**. The brutal assessment shows we have solid foundations but critical gaps in UX and functionality.

**Start with Phase 1** - the multi-pane agent chat interface. This establishes the core interaction model that everything else builds upon. Focus on getting agencies chatting with AI agents about their data first, then layer on visualization and live preview.

The key insight: **agencies don't need another CMS admin panel** - they need an AI-powered content management assistant that feels like a modern IDE.