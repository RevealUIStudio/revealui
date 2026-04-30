# Conversational Dashboard - User Guide

Your RevealUI admin dashboard now has AI-powered conversational control! You can manage your entire admin using natural language through text, speech, or images.

## How It Works

The chat interface connects to an AI agent with 19 admin tools that can:
- Create, read, update, and delete content
- Manage globals (Header, Footer, Settings)
- Handle media files
- Manage users

## Access the Chat Interface

1. **Start the admin dev server:**
   ```bash
   pnpm dev:admin
   ```

2. **Open the admin panel:**
   ```
   http://localhost:4000/admin
   ```

3. **Look for the chat widget** in the admin dashboard (configured in `beforeDashboard` component)

## Example Conversations

### Creating Content

**You:** "Create a new page called About Us with some introductory content"

**Agent:**
```
Creating page... ✓
I've created a new "About Us" page with introductory content.
The page is now available in your admin dashboard for editing.
```

### Updating Navigation

**You:** "Add a Pricing link to the header that goes to /pricing"

**Agent:**
```
Let me update your header navigation...
Fetching current header... ✓
Adding Pricing link... ✓

Done! Your header now includes:
- Home (/)
- Posts (/posts)
- Admin (/admin)
- Pricing (/pricing)
```

### Managing Content

**You:** "Show me all published blog posts"

**Agent:**
```
Searching for published posts...

I found 12 published posts:
1. "Getting Started with RevealUI" - Jan 15, 2026
2. "Building Custom Components" - Jan 12, 2026
3. "Advanced Routing Patterns" - Jan 10, 2026
...

Would you like me to update any of these?
```

### Bulk Operations

**You:** "Create 3 new blog posts about React, Next.js, and TypeScript"

**Agent:**
```
Creating 3 blog posts...

✓ Created: "Introduction to React"
✓ Created: "Next.js Best Practices"
✓ Created: "TypeScript for Beginners"

All posts are in draft status. Would you like me to publish them?
```

### Updating Globals

**You:** "Update the footer to include social media links for Twitter and GitHub"

**Agent:**
```
Updating footer... ✓

I've added social media links to your footer:
- Twitter: /twitter
- GitHub: /github

The footer is now live on your site.
```

### Media Management

**You:** "Show me all the images uploaded this month"

**Agent:**
```
Searching media library...

Found 8 images from January 2026:
1. logo-new.png (45KB) - Jan 28
2. hero-banner.jpg (120KB) - Jan 25
3. team-photo.jpg (200KB) - Jan 20
...
```

## Voice Input

Use the voice button in the chat interface:

1. Click "Start Voice"
2. Speak your command: *"Add a contact page to the site"*
3. Click "Stop Voice"
4. The transcribed text appears in the input
5. Click Send to execute

## Input Modes

### Text Input
Type commands naturally - no special syntax required.

### Voice Input
Speak commands - they'll be transcribed automatically.

### Image Input (Coming Soon)
Upload screenshots or designs:
- "Make the homepage look like this [image]"
- "Use these colors in the header [image]"

## Available Operations

### Collections
- **Create**: "Create a new {collection} called {name}"
- **Read**: "Show me all {collection}" or "Find {collection} where {field} is {value}"
- **Update**: "Update {collection} {id} to set {field} to {value}"
- **Delete**: "Delete the {collection} with {field} {value}"

### Globals
- **View**: "Show me the current header configuration"
- **Update**: "Update {global} to {change}"
- **Navigation**: "Add/remove {link} from {header/footer}"

### Media
- **List**: "Show me all images/videos/files"
- **Upload**: "Upload this image as {filename}" (with image data)
- **Update**: "Set the alt text of {media} to {text}"
- **Delete**: "Remove {media} from the library"

### Users
- **Current**: "Who am I logged in as?"
- **List**: "Show me all admin users"
- **Create**: "Create a new user account for {email}"
- **Update**: "Change {user}'s role to {role}"

## Tips for Best Results

✅ **DO:**
- Be conversational and natural
- Specify what you want to accomplish
- Ask follow-up questions
- Confirm destructive operations when prompted

❌ **DON'T:**
- Use technical API syntax
- Try to execute multiple unrelated tasks in one message
- Assume field names - ask the agent to check first

## Security & Permissions

- The agent operates with **your** user permissions
- Admin-only operations require admin role
- Destructive operations (delete) may require confirmation
- All operations are logged for audit

## Troubleshooting

### "Tool not found" error
The admin tools may not be initialized. Check server logs for tool registration errors.

### "Authentication required" error
Your session may have expired. Log in again at `/admin/login`.

### "LLM provider not configured" error
Set up your AI provider credentials:
```bash
# For Anthropic (recommended)
ANTHROPIC_API_KEY=your-key-here

# For OpenAI
OPENAI_API_KEY=your-key-here

# For Groq
GROQ_API_KEY=gsk_your-key-here
```

### Agent seems confused
Try being more specific or break your request into smaller steps.

## Advanced Usage

### Chaining Operations

**You:** "Create a new Products collection, add 5 sample products, then update the header to include a Products link"

**Agent:** Will execute these as separate steps and report progress.

### Conditional Logic

**You:** "If there are any draft posts older than 30 days, delete them"

**Agent:** Will check conditions before executing.

### Complex Queries

**You:** "Find all pages that mention 'React' and update them to also include a 'Next.js' tag"

**Agent:** Will search, then batch update matching pages.

## Configuration

The chat API is configured in `/apps/admin/src/app/api/chat/route.ts`:

- **Rate Limit**: 10 requests per minute
- **Max Iterations**: 5 tool execution rounds
- **Token Limit**: 2000 tokens per response
- **Vector Memory**: Enabled by default (set `ENABLE_VECTOR_MEMORY=false` to disable)

## What's Next?

The conversational dashboard is ready to deploy! Future enhancements:

- [ ] Image input for visual design instructions
- [ ] Batch operations UI with progress tracking
- [ ] Workflow automation (scheduled tasks)
- [ ] Multi-language support
- [ ] Voice-only mode (hands-free admin management)

## Support

If you encounter issues or have questions:
1. Check the server logs for detailed error messages
2. Review the tool definitions in `/packages/ai/src/tools/admin/`
3. Test the chat API directly: `POST /api/chat` with sample messages

---

**Congratulations!** 🎉 You now have a fully conversational dashboard powered by AI. Manage your content naturally through chat, voice, or images!
