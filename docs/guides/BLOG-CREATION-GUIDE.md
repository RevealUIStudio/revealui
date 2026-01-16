# How to Create a Blog Using the Admin Dashboard

## Overview

The RevealUI CMS includes a fully configured blog system with a **Posts** collection. This guide shows you how to use the admin dashboard to create, manage, and publish blog posts.

## Accessing the Admin Dashboard

### Step 1: Start the Development Server

```bash
# From the project root
pnpm dev
```

The CMS app will start on `http://localhost:4000`

### Step 2: Navigate to Admin Dashboard

1. Open your browser and go to: **`http://localhost:4000/admin`**
2. You'll see the RevealUI Admin Dashboard with:
   - **Collections** card showing available collections (including "posts")
   - **Globals** card showing global settings
   - **System Status** indicator

### Step 3: Access the Posts Collection

✅ **The AdminDashboard component is now integrated!** You have full CRUD functionality.

1. **Click on "posts"** in the Collections card on the dashboard
2. You'll see the Posts collection list view with:
   - Table showing all posts (if any exist)
   - "Create New" button in the top right
   - Edit/Delete buttons for each post
   - Pagination controls if you have many posts

**Note**: If you see a loading spinner, the dashboard is fetching posts from the API. Once loaded, you'll see the full list.

---

## Creating Your First Blog Post

Now that you're in the Posts collection view, you can create your first blog post!

### Step 1: Click "Create New"

1. In the Posts collection view, click the **"Create New"** button (top right)
2. The post editor will open

### Step 2: Fill in Post Details

The Posts collection has the following fields:

#### Required Fields

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

#### Optional Fields (Sidebar)

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

#### SEO Tab

1. **Meta Image** (Relationship)
   - Select an image from Media collection for social sharing

2. **Meta Title** (Text)
   - Custom SEO title (defaults to post title)

3. **Meta Description** (Textarea)
   - SEO description for search engines

### Step 3: Save Your Post

1. Click **"Save"** button at the bottom
2. Your post will be saved as a **draft** by default
3. You'll be redirected back to the Posts list

---

## Publishing a Blog Post

### Method 1: Set Published Date

1. Edit your post
2. In the sidebar, set the **"Published At"** date to:
   - Current date/time for immediate publishing
   - Future date for scheduled publishing
3. Save the post

### Method 2: Using Draft Status

The Posts collection supports draft/published workflow:
- **Draft**: Not visible to public
- **Published**: Visible on `/posts` page

To publish:
1. Edit the post
2. Set `_status` field to `"published"` (if available in UI)
3. Or set `publishedAt` date

---

## Managing Blog Posts

### Viewing All Posts

1. Go to `/admin`
2. Click on **"posts"** collection
3. You'll see a table with:
   - Post titles
   - Slugs
   - Last updated dates
   - Edit/Delete buttons

### Editing a Post

1. Click **"Edit"** button next to any post
2. Make your changes
3. Click **"Save"**

### Deleting a Post

1. Click **"Delete"** button next to any post
2. Confirm the deletion
3. Post will be permanently removed

### Pagination

- Posts are paginated (10 per page by default)
- Use Previous/Next buttons to navigate
- Page numbers show current position

---

## Viewing Your Blog on the Frontend

### Blog Index Page

**URL**: `http://localhost:4000/posts`

- Shows all published posts
- Paginated (12 posts per page)
- Displays post cards with:
  - Title
  - Excerpt
  - Featured image (if set)
  - Publication date
  - Author(s)

### Individual Post Page

**URL**: `http://localhost:4000/posts/your-post-slug`

- Full post content
- Rich text formatting
- Related posts section (if configured)
- SEO metadata
- Author information

---

## Setting Up Categories

Before creating posts, you may want to set up categories:

### Step 1: Access Categories Collection

1. Go to `/admin`
2. Click on **"categories"** collection

### Step 2: Create a Category

1. Click **"Create New"**
2. Fill in:
   - **Title**: Category name (e.g., "Tutorials", "News")
   - **Description**: Optional description
3. Click **"Save"**

### Step 3: Assign Categories to Posts

1. When editing a post
2. Go to "Meta" tab
3. Select categories from the dropdown

---

## Blog Post Fields Reference

### Content Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | Text | Yes | Post title |
| `content` | Rich Text | Yes | Main post content with full editor |

### Meta Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relatedPosts` | Relationship | No | Link to related posts |
| `categories` | Relationship | No | Post categories |

### SEO Tab

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meta.image` | Relationship | No | Social sharing image |
| `meta.title` | Text | No | Custom SEO title |
| `meta.description` | Textarea | No | SEO description |

### Sidebar Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `publishedAt` | Date | No | Publication date |
| `authors` | Relationship | No | Post authors |
| `slug` | Text | Auto | URL-friendly identifier |

---

## Rich Text Editor Features

The content editor supports:

### Text Formatting
- **Bold** (Ctrl/Cmd + B)
- **Italic** (Ctrl/Cmd + I)
- **Underline**
- **Strikethrough**
- **Code** (inline)

### Headings
- H1, H2, H3, H4
- Use toolbar or keyboard shortcuts

### Lists
- Ordered lists (numbered)
- Unordered lists (bullets)
- Nested lists

### Blocks
- **Banner Block**: Hero sections
- **Code Block**: Syntax-highlighted code
- **Media Block**: Images and videos

### Links
- Internal links
- External links
- Link to other posts/pages

---

## Workflow Example

### Complete Blog Post Creation Workflow

1. **Create Categories** (Optional)
   - Go to Categories collection
   - Create: "Tutorials", "News", "Updates"

2. **Upload Media** (Optional)
   - Go to Media collection
   - Upload featured images
   - Upload images for post content

3. **Create Post**
   - Go to Posts collection
   - Click "Create New"
   - Fill in title
   - Write content in rich text editor
   - Add images/media blocks
   - Set published date
   - Select categories
   - Select authors
   - Add SEO metadata
   - Click "Save"

4. **Preview Post**
   - Visit `/posts/your-slug` to see the post
   - Check formatting and layout

5. **Publish**
   - Edit post if needed
   - Ensure `publishedAt` is set
   - Post appears on `/posts` index

---

## Tips & Best Practices

### SEO Optimization

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

### Content Organization

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

### Rich Text Editor Tips

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

## Troubleshooting

### Post Not Appearing on Frontend

**Issue**: Post saved but not visible on `/posts`

**Solutions**:
1. Check `publishedAt` date is set
2. Ensure date is not in the future
3. Verify post `_status` is "published"
4. Check access control settings

### Rich Text Not Rendering

**Issue**: Content appears as raw HTML

**Solutions**:
1. Ensure RichText component is used on frontend
2. Check content field type is `richText`
3. Verify Lexical editor is configured

### Images Not Loading

**Issue**: Media blocks show broken images

**Solutions**:
1. Verify media uploaded to Media collection
2. Check Vercel Blob storage is configured
3. Ensure image URLs are correct
4. Check CORS settings

---

## Next Steps

### Customize Blog Appearance

1. Edit frontend components:
   - `apps/cms/src/app/(frontend)/posts/page.tsx` - Blog index
   - `apps/cms/src/app/(frontend)/posts/[slug]/page.tsx` - Post page
   - `apps/cms/src/lib/components/CollectionArchive/index.tsx` - Post cards

2. Customize styling:
   - Modify Tailwind classes
   - Update component layouts
   - Add custom CSS

### Add More Features

1. **Comments System**
   - Create Comments collection
   - Link to Posts
   - Add comment form

2. **Tags**
   - Use existing Tags collection
   - Add tag field to Posts
   - Create tag pages

3. **Search**
   - Implement search functionality
   - Filter by category/tag
   - Full-text search

---

## Quick Reference

### Admin URLs

- **Dashboard**: `/admin`
- **Posts Collection**: `/admin` → Click "posts"
- **Categories**: `/admin` → Click "categories"
- **Media**: `/admin` → Click "media"

### Frontend URLs

- **Blog Index**: `/posts`
- **Post Page**: `/posts/{slug}`
- **Paginated**: `/posts/page/{pageNumber}`

### Keyboard Shortcuts (Rich Text Editor)

- **Bold**: Ctrl/Cmd + B
- **Italic**: Ctrl/Cmd + I
- **Link**: Ctrl/Cmd + K
- **Code**: Ctrl/Cmd + `
- **Undo**: Ctrl/Cmd + Z
- **Redo**: Ctrl/Cmd + Shift + Z

---

## Example: Creating a Complete Blog Post

### Step-by-Step Example

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

---

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify database connection
3. Ensure environment variables are set
4. Check API routes are working
5. Review server logs

For more information, see:
- `ADMIN-DASHBOARD-IMPLEMENTATION-SUMMARY.md`
- `CMS-FRONTEND-CONNECTION-GUIDE.md`
- `QUICK_START.md`

## Related Documentation

- [CMS Content Examples](./CMS-CONTENT-EXAMPLES.md) - Ready-to-use content
- [CMS Content Recommendations](./CMS-CONTENT-RECOMMENDATIONS.md) - Content best practices
- [CMS Frontend Connection Guide](./CMS-FRONTEND-CONNECTION-GUIDE.md) - Connect CMS to frontend
- [RevealUI Theme Usage Guide](./REVEALUI-THEME-USAGE-GUIDE.md) - Theme customization
- [Developer Quick Start](./QUICK_START.md) - Setup guide
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task
- [Keywords Index](../KEYWORDS.md) - Search by keyword
- [Task-Based Guide](../TASKS.md) - Find docs by task
