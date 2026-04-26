---
title: "Admin Guide"
description: "Collections, access control, hooks, rich text, media, and admin dashboard"
category: guide
audience: developer
---

# RevealUI Admin Guide

**Purpose**: Complete guide to using the RevealUI admin dashboard and content engine
**Last Updated**: 2026-02-01
**Extracted From**: OVERVIEW.md (consolidated 2026-02-01)

---

## Admin Guide

This comprehensive guide covers everything you need to know about using the RevealUI admin dashboard, from frontend connection to content management and blog creation.

### Admin Guide Table of Contents

1. [Admin Overview](#admin-overview)
2. [Frontend Connection](#frontend-connection)
   - [Admin API Endpoints](#admin-api-endpoints)
   - [Environment Configuration](#environment-configuration)
   - [Creating API Client](#creating-api-client)
   - [Creating Fetch Functions](#creating-fetch-functions)
   - [Testing the Connection](#testing-the-connection)
3. [Content Management](#content-management)
   - [Collections Overview](#collections-overview)
   - [Content Creation Workflow](#content-creation-workflow)
   - [Content Best Practices](#content-best-practices)
4. [Blog Management](#blog-management)
   - [Accessing Admin Dashboard](#accessing-admin-dashboard)
   - [Creating Blog Posts](#creating-blog-posts)
   - [Publishing Posts](#publishing-posts)
   - [Managing Posts](#managing-posts)
5. [Content Examples](#content-examples)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

### Admin Overview

Your RevealUI project consists of:

- **Admin App** (`apps/admin`): Next.js 16 app with RevealUI admin backend
- **Marketing App** (`apps/marketing`): Next.js app that consumes admin data

The admin provides a REST API for content delivery and includes collections for:

- **Pages**, **Posts** (blog), **Media**, **Heros**, **Cards**, **Contents**, **Events**, **Banners**
- **Products**, **Prices**, **Categories**, **Tags**, **Orders**, **Subscriptions**
- **Users**, **Tenants**, **Layouts**, **Videos**

### Commercial framing

For hosted RevealUI deployments, premium admin access should be modeled primarily around account or workspace entitlements.

That means:

- subscription and premium access should attach to the billing owner, not only an individual user
- AI and automation features should be able to use metered billing
- perpetual or deployment licenses should stay secondary for the products that actually need them

---

### Frontend Connection

#### Admin API Endpoints

The admin exposes a REST API at `/api/[...slug]/route.ts` using `handleRESTRequest` from `@revealui/core/api/rest`.

**Collections API**

```
GET    /api/collections/{collection}           - List all documents
GET    /api/collections/{collection}/{id}      - Get single document
POST   /api/collections/{collection}           - Create document
PATCH  /api/collections/{collection}/{id}      - Update document
DELETE /api/collections/{collection}/{id}      - Delete document
```

**Globals API**

```
GET    /api/globals/{global}                   - Get global
PATCH  /api/globals/{global}                   - Update global
```

**Query Parameters**

- `depth` - Relationship depth (e.g., `?depth=2`)
- `where` - Filter conditions (JSON)
- `limit` - Results per page
- `page` - Page number
- `sort` - Sort field
- `locale` - Locale for i18n

**Testing API Endpoints**

You can test the Admin API directly:

```bash
# Get all pages
curl http://localhost:4000/api/collections/pages

# Get a specific page
curl http://localhost:4000/api/collections/pages/{id}

# Get with filters
curl "http://localhost:4000/api/collections/posts?where[status][equals]=published&limit=10"

# Get with depth (relationships)
curl "http://localhost:4000/api/collections/pages?depth=2"
```

#### Environment Configuration

**admin App Environment Variables**

Create `apps/admin/.env.local`:

```env
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
REVEALUI_WHITELISTORIGINS=http://localhost:3000,http://localhost:5173
REVEALUI_SECRET=your-secret-key
```

**Frontend App Environment Variables**

Create `apps/marketing/.env.local`:

```env
NEXT_PUBLIC_ADMIN_URL=http://localhost:4000
# OR
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

**CORS Configuration**

The admin has CORS handling in:

- `apps/admin/src/proxy.ts` - Defines allowed origins
- `apps/admin/revealui.config.ts` - `cors` and `csrf` arrays

Ensure your frontend URL is in `REVEALUI_WHITELISTORIGINS`.

#### Creating API Client

Create a base API client function in your frontend app.

**File**: `apps/marketing/src/lib/api/client.ts`

```typescript
const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  "http://localhost:4000";

export async function fetchFromAdmin<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${ADMIN_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Admin API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

#### Creating Fetch Functions

Create fetch functions for each collection you need to access.

**fetchMainInfos**

**File**: `apps/marketing/src/lib/api/fetchMainInfos.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface MainInfo {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

export default async function fetchMainInfos(): Promise<MainInfo[]> {
  const response = await fetchFromAdmin<{
    docs: MainInfo[];
    totalDocs: number;
  }>("/api/collections/contents?where[type][equals]=main-info&depth=1");

  return response.docs || [];
}
```

**fetchVideos**

**File**: `apps/marketing/src/lib/api/fetchVideos.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface Video {
  url: string;
}

export default async function fetchVideos(): Promise<Video[]> {
  const response = await fetchFromAdmin<{
    docs: Array<{ url?: string; file?: { url?: string } }>;
  }>("/api/collections/videos?depth=1");

  return response.docs
    .map((doc) => ({
      url: doc.url || doc.file?.url || "",
    }))
    .filter((v) => v.url);
}
```

**fetchCard**

**File**: `apps/marketing/src/lib/api/fetchCard.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface CardData {
  name: string;
  image: string;
  label: string;
  cta: string;
  href: string;
  loading?: "eager" | "lazy";
}

export default async function fetchCard(): Promise<CardData[]> {
  const response = await fetchFromAdmin<{
    docs: CardData[];
  }>("/api/collections/cards?depth=1");

  return response.docs || [];
}
```

**fetchHero**

**File**: `apps/marketing/src/lib/api/fetchHero.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface HeroData {
  id: number;
  image: string;
  videos: string;
  altText: string;
  href: string;
}

export default async function fetchHero(): Promise<HeroData[]> {
  const response = await fetchFromAdmin<{
    docs: HeroData[];
  }>("/api/collections/heros?depth=1");

  return response.docs || [];
}
```

**fetchEvents**

**File**: `apps/marketing/src/lib/api/fetchEvents.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface EventData {
  title: string;
  name: string;
  description: string;
  image: string;
  alt: string;
}

export default async function fetchEvents(): Promise<EventData[]> {
  const response = await fetchFromAdmin<{
    docs: EventData[];
  }>("/api/collections/events?depth=1");

  return response.docs || [];
}
```

**fetchBanner**

**File**: `apps/marketing/src/lib/api/fetchBanner.ts`

```typescript
import { fetchFromAdmin } from "./client";

export interface BannerData {
  title: string;
  description: string;
  image: string;
  link: string;
  alt: string;
}

export default async function fetchBanner(): Promise<BannerData[]> {
  const response = await fetchFromAdmin<{
    docs: BannerData[];
  }>("/api/collections/banners?depth=1");

  return response.docs || [];
}
```

**Updating Component Imports**

Update your components to import from the new location:

**In `apps/marketing/src/components/Home/Main.tsx`**:

```typescript
import fetchMainInfos from "@/lib/api/fetchMainInfos";
// Or using relative paths:
import fetchMainInfos from "../../lib/api/fetchMainInfos";
```

Apply the same pattern to:

- `apps/marketing/src/components/Home/Header.tsx`
- `apps/marketing/src/components/Home/Card.tsx`
- `apps/marketing/src/components/Home/Hero.tsx`
- `apps/marketing/src/components/Home/Section.tsx`
- `apps/marketing/src/components/Home/Content.tsx`

#### Testing the Connection

1. Start the admin: `cd apps/admin && pnpm dev` (runs on port 4000)
2. Start the frontend: `cd apps/marketing && pnpm dev` (runs on port 5173 or 3000)
3. Check browser console for API errors
4. Verify data is loading in components

---

### Content Management

#### Collections Overview

Each collection serves a specific purpose on the frontend:

1. **Contents** → Main content sections with images (used by `HomeMain`)
2. **Cards** → Feature cards with CTAs (used by `HomeCard`)
3. **Heros** → Large hero sections with images/videos (used by `HomeHero`)
4. **Events** → Event listings with descriptions (used by `HomeSection`)
5. **Banners** → Promotional banners with stats (used by `HomeContent`)

**Home Page Content Flow**

1. **Hero Section** (from Heros) - Large visual impact
2. **Card Section** (from Cards) - Quick navigation
3. **Events Section** (from Events) - Featured content
4. **Main Content** (from Contents) - Detailed information
5. **Banner Section** (from Banners) - Call-to-action with stats

**Recommended Entry Counts**

- **Contents**: 1-3 entries
- **Cards**: 2-4 entries
- **Heros**: 1-2 entries
- **Events**: 1-3 entries
- **Banners**: 1 entry (only first is used)

#### Content Creation Workflow

**Step 1: Upload Media First**

1. Go to `http://localhost:4000/admin`
2. Navigate to **Media** collection
3. Upload all images you'll need:
   - Hero images (1920x1080 or larger)
   - Card images (800x600 or similar)
   - Event images (1200x800)
   - Banner images (1920x600)
4. Note the media IDs or names for reference

**Step 2: Create Content Entries**

1. **Contents**: Create 1-3 entries for main sections
2. **Cards**: Create 2-4 cards for different features
3. **Heros**: Create 1-2 hero sections
4. **Events**: Create 1-3 event entries
5. **Banners**: Create 1-2 banner entries

**Step 3: Link Media**

- When creating entries, select the uploaded media for image fields
- Ensure images are properly linked (not just text URLs)

**Step 4: Verify Frontend**

- Visit `http://localhost:3000` or `http://localhost:5173`
- Check that components display admin data
- Verify images load correctly
- Test links and navigation

#### Collection Field Requirements

**Contents Collection**

**Component**: `HomeMain`
**Fetch Function**: `fetchMainInfos()`
**Admin Collection**: `contents`

**Required Fields**:

- `name` (text, required) - Used as `title`
- `description` (text) - Used for `subtitle` and `description`
- `image` (upload/relationship) - Main image

**Notes**:

- The `description` field is split: first sentence becomes `subtitle`, full text becomes `description`
- Multiple entries will be displayed as separate sections

**Cards Collection**

**Component**: `HomeCard`
**Fetch Function**: `fetchCard()`
**Admin Collection**: `cards`

**Required Fields**:

- `name` (text) - Card title
- `image` (upload/relationship) - Card image
- `label` (text) - Subtitle/label text
- `cta` (text) - Call-to-action button text
- `href` (text) - Link destination
- `loading` (radio: 'eager' or 'lazy') - Image loading strategy

**Notes**:

- Use `loading: "eager"` for above-the-fold cards
- Use `loading: "lazy"` for cards that may be below the fold
- Cards are displayed prominently, so use high-quality images

**Heros Collection**

**Component**: `HomeHero`
**Fetch Function**: `fetchHero()`
**Admin Collection**: `heros`

**Required Fields**:

- `href` (text) - Link destination (usually YouTube channel or video)
- `altText` (text) - Image alt text
- `image` (upload/relationship) - Hero image
- `video` (text) - Video URL

**Notes**:

- Hero images should be large and high-quality (recommended: 1920x1080 or larger)
- Video can be a YouTube URL or uploaded media file
- Multiple heroes will be displayed in sequence

**Events Collection**

**Component**: `HomeSection`
**Fetch Function**: `fetchEvents()`
**Admin Collection**: `events`

**Required Fields**:

- `title` (text) - Main heading (e.g., "EVENTS")
- `name` (text) - Subheading/event name
- `description` (text) - Event description
- `image` (upload/relationship) - Event image
- `alt` (text) - Image alt text

**Notes**:

- `title` is displayed as large heading (text-6xl to text-7xl)
- Images should be engaging and action-oriented

**Banners Collection**

**Component**: `HomeContent`
**Fetch Function**: `fetchBanner()`
**Admin Collection**: `banners`

**Required Fields**:

- `title` (text) - Banner heading
- `description` (text) - Banner description
- `image` (upload/relationship) - Banner image
- `link` (text) - Link URL
- `alt` (text) - Image alt text

**Notes**:

- Banner component displays stats (hardcoded in component)
- Only the first banner from the array is used

#### Content Best Practices

**Images**

- **Hero Images**: 1920x1080 or larger, high quality
- **Card Images**: 800x600 or similar, optimized for web
- **Event Images**: 1200x800, action-oriented
- **Banner Images**: 1920x600, wide format

**Text Content**

- Keep titles concise (3-5 words)
- Descriptions should be 1-3 sentences
- Use clear, action-oriented CTAs
- Ensure alt text is descriptive

**Organization**

- Use consistent naming conventions
- Add dates/timestamps for events
- Organize by priority (most important first)
- Keep content fresh and updated

---

### Blog Management

#### Accessing Admin Dashboard

**Step 1: Start the Development Server**

```bash
# From the project root
pnpm dev
```

The admin app will start on `http://localhost:4000`

**Step 2: Navigate to Admin Dashboard**

1. Open your browser and go to: **`http://localhost:4000/admin`**
2. You'll see the RevealUI Admin Dashboard with:
   - **Collections** card showing available collections (including "posts")
   - **Globals** card showing global settings
   - **System Status** indicator

**Step 3: Access the Posts Collection**

1. **Click on "posts"** in the Collections card on the dashboard
2. You'll see the Posts collection list view with:
   - Table showing all posts (if any exist)
   - "Create New" button in the top right
   - Edit/Delete buttons for each post
   - Pagination controls if you have many posts

#### Creating Blog Posts

**Step 1: Click "Create New"**

1. In the Posts collection view, click the **"Create New"** button (top right)
2. The post editor will open

**Step 2: Fill in Post Details**

**Required Fields**

1. **Title** (Text field)
   - Enter your blog post title
   - Example: "Getting Started with RevealUI"

2. **Content** (Rich Text Editor)
   - Located in the "Content" tab
   - Full-featured Lexical editor with:
     - Headings (H1-H4)
     - Bold, Italic, formatting
     - Lists (ordered/unordered)
     - Links
     - Code blocks
     - Media blocks (images/videos)
     - Banner blocks
   - Write your blog post content here

3. **Slug** (Auto-generated from title)
   - Automatically created from the title
   - Can be edited if needed
   - Used in the URL: `/posts/your-slug`

**Optional Fields (Sidebar)**

1. **Published At** (Date)
   - Set when the post should be published
   - Leave empty for draft
   - Auto-filled when you publish

2. **Authors** (Relationship)
   - Select one or more authors from Users collection
   - Links to user accounts

3. **Categories** (Relationship)
   - Select categories to organize posts
   - Create categories first in the Categories collection

4. **Related Posts** (Relationship)
   - Link to other related blog posts
   - Helps with content discovery

**SEO Tab**

1. **Meta Image** (Relationship)
   - Select an image from Media collection for social sharing

2. **Meta Title** (Text)
   - Custom SEO title (defaults to post title)

3. **Meta Description** (Textarea)
   - SEO description for search engines

**Step 3: Save Your Post**

1. Click **"Save"** button at the bottom
2. Your post will be saved as a **draft** by default
3. You'll be redirected back to the Posts list

#### Rich Text Editor Features

**Text Formatting**

- **Bold** (Ctrl/Cmd + B)
- **Italic** (Ctrl/Cmd + I)
- **Underline**
- **Strikethrough**
- **Code** (inline)

**Headings**

- H1, H2, H3, H4
- Use toolbar or keyboard shortcuts

**Lists**

- Ordered lists (numbered)
- Unordered lists (bullets)
- Nested lists

**Blocks**

- **Banner Block**: Hero sections
- **Code Block**: Syntax-highlighted code
- **Media Block**: Images and videos

**Links**

- Internal links
- External links
- Link to other posts/pages

#### Publishing Posts

**Method 1: Set Published Date**

1. Edit your post
2. In the sidebar, set the **"Published At"** date to:
   - Current date/time for immediate publishing
   - Future date for scheduled publishing
3. Save the post

**Method 2: Using Draft Status**

The Posts collection supports draft/published workflow:

- **Draft**: Not visible to public
- **Published**: Visible on `/posts` page

To publish:

1. Edit the post
2. Set `_status` field to `"published"` (if available in UI)
3. Or set `publishedAt` date

#### Managing Posts

**Viewing All Posts**

1. Go to `/admin`
2. Click on **"posts"** collection
3. You'll see a table with:
   - Post titles
   - Slugs
   - Last updated dates
   - Edit/Delete buttons

**Editing a Post**

1. Click **"Edit"** button next to any post
2. Make your changes
3. Click **"Save"**

**Deleting a Post**

1. Click **"Delete"** button next to any post
2. Confirm the deletion
3. Post will be permanently removed

**Pagination**

- Posts are paginated (10 per page by default)
- Use Previous/Next buttons to navigate
- Page numbers show current position

**Viewing Your Blog on the Frontend**

**Blog Index Page**

**URL**: `http://localhost:4000/posts`

- Shows all published posts
- Paginated (12 posts per page)
- Displays post cards with:
  - Title
  - Excerpt
  - Featured image (if set)
  - Publication date
  - Author(s)

**Individual Post Page**

**URL**: `http://localhost:4000/posts/your-post-slug`

- Full post content
- Rich text formatting
- Related posts section (if configured)
- SEO metadata
- Author information

**Setting Up Categories**

Before creating posts, you may want to set up categories:

**Step 1: Access Categories Collection**

1. Go to `/admin`
2. Click on **"categories"** collection

**Step 2: Create a Category**

1. Click **"Create New"**
2. Fill in:
   - **Title**: Category name (e.g., "Tutorials", "News")
   - **Description**: Optional description
3. Click **"Save"**

**Step 3: Assign Categories to Posts**

1. When editing a post
2. Go to "Meta" tab
3. Select categories from the dropdown

**Blog Tips and Best Practices**

**SEO Optimization**

1. **Use Descriptive Titles**
   - Clear, keyword-rich titles
   - Keep under 60 characters

2. **Write Meta Descriptions**
   - 150-160 characters
   - Compelling summaries
   - Include keywords

3. **Add Featured Images**
   - High-quality images
   - Proper alt text
   - Optimized file sizes

**Content Organization**

1. **Use Categories**
   - Organize posts by topic
   - Helps readers find content
   - Improves navigation

2. **Link Related Posts**
   - Connect related content
   - Improves engagement
   - Helps SEO

3. **Set Publication Dates**
   - Schedule posts in advance
   - Maintain consistent publishing
   - Use for content planning

**Rich Text Editor Tips**

1. **Use Headings**
   - Structure content with H2, H3
   - Improves readability
   - Better SEO

2. **Add Media**
   - Break up text with images
   - Use media blocks for videos
   - Optimize images before upload

3. **Format Code**
   - Use code blocks for snippets
   - Syntax highlighting included
   - Improves readability

---

### Content Examples

Ready-to-use content examples for each collection. Copy and paste these into your admin panel and replace the placeholder text with your own content.

**Contents Collection Examples**

**Entry 1: Welcome Section**

**Name**:

```
Welcome
```

**Description**:

```
Welcome to [Your Site Name]. Discover our latest news, updates, and community highlights. We're glad you're here.
```

**Image**:

- Upload to Media first: a hero or welcome image
- Link the uploaded media here

**Entry 2: About Section**

**Name**:

```
About Us
```

**Description**:

```
[Your Site Name] is built on RevealUI — an open-source business runtime for software companies. Users, content, products, payments, and AI, pre-wired and ready to deploy.
```

**Image**:

- Upload to Media first: an about or team image
- Link the uploaded media here

**Entry 3: Community Section**

**Name**:

```
Join Our Community
```

**Description**:

```
Connect with our growing community. Share your journey, learn from others, and be part of something bigger.
```

**Image**:

- Upload to Media first: a community or team gathering image
- Link the uploaded media here

**Cards Collection Examples**

**Entry 1: Feature Card**

**Name**: `[Feature Name]`
**Label**: `[Category]`
**CTA**: `Learn More`
**Href**: `/features`
**Loading**: `eager`
**Image**: Upload a feature or product image

**Entry 2: News Card**

**Name**: `Latest Updates`
**Label**: `News`
**CTA**: `Read More`
**Href**: `/news`
**Loading**: `lazy`
**Image**: Upload a news or blog image

**Entry 3: Community Card**

**Name**: `Join the Community`
**Label**: `Community`
**CTA**: `Get Started`
**Href**: `/community`
**Loading**: `lazy`
**Image**: Upload a community image

**Heros Collection Examples**

**Entry 1: Main Hero**

**Href**: `https://your-site.com`
**Alt Text**: `[Descriptive alt text for hero image]`
**Video**: _(leave blank or add a video URL)_
**Image**: Upload a hero image (recommended: 1200×600px or wider)

**Entry 2: Featured Content Hero**

**Href**: `https://your-site.com/featured`
**Alt Text**: `[Descriptive alt text]`
**Video**: _(optional video URL)_
**Image**: Upload a featured content image

**Banners Collection Examples**

**Entry 1: Welcome Banner**

**Heading**: `Welcome!`
**Subheading**: `Discover More`
**Description**: `Explore everything [Your Site Name] has to offer. Join our community and get started today.`
**CTA**: `Get Started`
**Highlight**: `today`
**Punctuation**: `.`
**Alt**: `[Site name] welcome banner`
**Link - Href**: `/about`
**Link - Text**: `Learn More`
**Stats**:

- Label: Members, Value: [X]
- Label: Posts, Value: [X]

**Image**: Upload a banner image

**Entry 2: Community Banner**

**Heading**: `Join the Community`
**Subheading**: `Connect Today`
**Description**: `Connect with other members. Share ideas, get help, and be part of something bigger.`
**CTA**: `Sign Up`
**Highlight**: `something bigger`
**Punctuation**: `!`
**Alt**: `Community banner`
**Link - Href**: `/join`
**Link - Text**: `Get Started`
**Stats**:

- Label: Members, Value: [X]
- Label: Countries, Value: [X]

**Image**: Upload a community image

**Quick Copy-Paste Templates**

**Contents Entry Template**

```
Name: [Your title]
Description: [First sentence becomes subtitle. Full description here.]
Image: [Link uploaded media]
```

**Cards Entry Template**

```
Name: [Card title]
Label: [Subtitle]
CTA: [Button text]
Href: [Link URL]
Loading: [eager or lazy]
Image: [Link uploaded media]
```

**Heros Entry Template**

```
Href: [YouTube or link URL]
Alt Text: [Image description]
Video: [Video URL]
Image: [Link uploaded media]
```

**Events Entry Template**

```
Title: [EVENTS, TOURNAMENT, etc.]
Name: [Event name]
Description: [Event description]
Alt: [Image alt text]
Image: [Link uploaded media]
```

**Banners Entry Template**

```
Heading: [Welcome!]
Subheading: [Discover More]
Description: [Banner description]
CTA: [Join Now]
Highlight: [highlight text]
Punctuation: [.]
Alt: [Image alt text]
Link Href: [/about]
Link Text: [Learn More]
Stats: [Add 4 stats with label and value]
Image: [Link uploaded media]
```

---

### Troubleshooting

**Frontend Connection Issues**

**CORS Errors**

**Problem**: Frontend can't access Admin API
**Solution**: Add frontend URL to `REVEALUI_WHITELISTORIGINS` in admin `.env`

**404 Errors**

**Problem**: Collection not found
**Solution**: Check collection slug matches exactly (case-sensitive)

**Empty Results**

**Problem**: API returns empty `docs` array
**Solutions**:

- Check if data exists in admin
- Verify collection access permissions
- Check `where` filters are correct

**Type Mismatches**

**Problem**: TypeScript errors in fetch functions
**Solution**: Match the actual admin collection schema structure

**Content Display Issues**

**Images Not Displaying**

**Solutions**:

- Verify media is uploaded to Media collection
- Check that image relationship is properly linked
- Ensure image URLs are accessible
- Check browser console for 404 errors

**Content Not Showing**

**Solutions**:

- Verify entries are created in correct collections
- Check that required fields are filled
- Ensure fetch functions are working (check Network tab)
- Verify CORS is configured correctly

**Wrong Data Displayed**

**Solutions**:

- Check field names match expected structure
- Verify data mapping in fetch functions
- Check component prop types
- Review console for errors

**Blog Post Issues**

**Post Not Appearing on Frontend**

**Problem**: Post saved but not visible on `/posts`

**Solutions**:

1. Check `publishedAt` date is set
2. Ensure date is not in the future
3. Verify post `_status` is "published"
4. Check access control settings

**Rich Text Not Rendering**

**Problem**: Content appears as raw HTML

**Solutions**:

1. Ensure RichText component is used on frontend
2. Check content field type is `richText`
3. Verify Lexical editor is configured

**Images Not Loading in Posts**

**Problem**: Media blocks show broken images

**Solutions**:

1. Verify media uploaded to Media collection
2. Check Vercel Blob storage is configured
3. Ensure image URLs are correct
4. Check CORS settings

---

### Quick Reference

**Admin URLs**

- **Dashboard**: `/admin`
- **Posts Collection**: `/admin` → Click "posts"
- **Categories**: `/admin` → Click "categories"
- **Media**: `/admin` → Click "media"
- **Any Collection**: `/admin` → Click collection name

**Frontend URLs**

- **Blog Index**: `/posts`
- **Post Page**: `/posts/{slug}`
- **Paginated Posts**: `/posts/page/{pageNumber}`

**Keyboard Shortcuts (Rich Text Editor)**

- **Bold**: Ctrl/Cmd + B
- **Italic**: Ctrl/Cmd + I
- **Link**: Ctrl/Cmd + K
- **Code**: Ctrl/Cmd + `
- **Undo**: Ctrl/Cmd + Z
- **Redo**: Ctrl/Cmd + Shift + Z

**Quick Start Checklist**

General Content:

- [ ] Upload images to Media collection
- [ ] Create 1-3 Contents entries
- [ ] Create 2-4 Cards entries
- [ ] Create 1-2 Heros entries
- [ ] Create 1-3 Events entries
- [ ] Create 1 Banner entry
- [ ] Verify all images are linked
- [ ] Test frontend display
- [ ] Check mobile responsiveness
- [ ] Verify all links work

Blog Setup:

- [ ] Create categories (optional)
- [ ] Upload featured images to Media
- [ ] Create first blog post
- [ ] Add content with rich text editor
- [ ] Set published date
- [ ] Select categories and authors
- [ ] Add SEO metadata
- [ ] Preview post on frontend
- [ ] Publish post

**Complete Workflow Example**

**Creating a Blog Post**

1. **Navigate**: Go to `http://localhost:4000/admin`
2. **Click**: "posts" in Collections card
3. **Click**: "Create New" button
4. **Fill Title**: "My First Blog Post"
5. **Add Content**:
   - Click in content editor
   - Type: "Welcome to my blog!"
   - Add H2 heading: "Introduction"
   - Add paragraph text
   - Insert image using Media block
6. **Set Published Date**: Today's date
7. **Add Category**: Select "Tutorials" (if exists)
8. **Add Author**: Select your user account
9. **SEO Tab**:
   - Meta description: "My first blog post about..."
   - Upload featured image
10. **Click**: "Save"
11. **View**: Visit `http://localhost:4000/posts/my-first-blog-post`

**File Locations Reference**

**admin Side (Already Configured)**

- `apps/admin/src/app/(backend)/api/[...slug]/route.ts` - API route handler
- `apps/admin/revealui.config.ts` - Collections configuration
- `apps/admin/src/proxy.ts` - CORS configuration
- `apps/admin/.env.local` - Environment variables

**Frontend Side (Need to Create/Modify)**

- `apps/marketing/src/lib/api/client.ts` - Base API client
- `apps/marketing/src/lib/api/fetchMainInfos.ts` - Fetch function
- `apps/marketing/src/lib/api/fetchVideos.ts` - Fetch function
- `apps/marketing/src/lib/api/fetchCard.ts` - Fetch function
- `apps/marketing/src/lib/api/fetchHero.ts` - Fetch function
- `apps/marketing/src/lib/api/fetchEvents.ts` - Fetch function
- `apps/marketing/src/lib/api/fetchBanner.ts` - Fetch function
- `apps/marketing/src/components/Home/*.tsx` - Update import paths
- `apps/marketing/.env.local` - Environment variables

**Blog Post Fields Reference**

**Content Tab**

| Field     | Type      | Required | Description                        |
| --------- | --------- | -------- | ---------------------------------- |
| `title`   | Text      | Yes      | Post title                         |
| `content` | Rich Text | Yes      | Main post content with full editor |

**Meta Tab**

| Field          | Type         | Required | Description           |
| -------------- | ------------ | -------- | --------------------- |
| `relatedPosts` | Relationship | No       | Link to related posts |
| `categories`   | Relationship | No       | Post categories       |

**SEO Tab**

| Field              | Type         | Required | Description          |
| ------------------ | ------------ | -------- | -------------------- |
| `meta.image`       | Relationship | No       | Social sharing image |
| `meta.title`       | Text         | No       | Custom SEO title     |
| `meta.description` | Textarea     | No       | SEO description      |

**Sidebar Fields**

| Field         | Type         | Required | Description             |
| ------------- | ------------ | -------- | ----------------------- |
| `publishedAt` | Date         | No       | Publication date        |
| `authors`     | Relationship | No       | Post authors            |
| `slug`        | Text         | Auto     | URL-friendly identifier |

**admin Guide Next Steps**

**Enhance Frontend Connection**

1. **Add error handling** - Consider adding retry logic, error boundaries
2. **Add caching** - Consider React Query or SWR for data fetching
3. **Add TypeScript types** - Generate types from admin schema if available
4. **Create shared package** - Move fetch functions to `packages/api-client` for reusability

**Customize Blog**

1. **Edit frontend components**:
   - `apps/admin/src/app/(frontend)/posts/page.tsx` - Blog index
   - `apps/admin/src/app/(frontend)/posts/[slug]/page.tsx` - Post page
   - `apps/admin/src/lib/components/CollectionArchive/index.tsx` - Post cards

2. **Customize styling**:
   - Modify Tailwind classes
   - Update component layouts
   - Add custom CSS

**Add Features**

1. **Comments System**:
   - Create Comments collection
   - Link to Posts
   - Add comment form

2. **Tags**:
   - Use existing Tags collection
   - Add tag field to Posts
   - Create tag pages

3. **Search**:
   - Implement search functionality
   - Filter by category/tag
   - Full-text search

**Alternative: Use Shared Package**

If you want to share fetch functions across multiple apps:

1. Create `packages/api-client` package
2. Move fetch functions there
3. Export from package
4. Import in both admin and Web apps

This allows:

- Shared TypeScript types
- Reusable API utilities
- Consistent error handling

---

## Environment Options

---

**Last Updated**: 2026-02-01
**Extracted From**: OVERVIEW.md
**Maintainer**: RevealUI Framework Team
