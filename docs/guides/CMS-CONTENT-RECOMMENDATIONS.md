# CMS Content Recommendations for Frontend Components

This document provides recommendations for what content to add to each CMS collection to properly populate the frontend components.

---

## Overview

Based on the component analysis, here's what each collection should contain:

1. **Contents** → Used by `HomeMain` component
2. **Cards** → Used by `HomeCard` component
3. **Heros** → Used by `HomeHero` component
4. **Events** → Used by `HomeSection` component
5. **Banners** → Used by `HomeContent` component

---

## 1. Contents Collection

**Component**: `HomeMain` (`apps/web/src/components/Home/Main.tsx`)  
**Fetch Function**: `fetchMainInfos()`  
**CMS Collection**: `contents`

### Required Fields:
- `name` (text, required) - Used as `title`
- `description` (text) - Used for `subtitle` and `description`

**Note**: The Contents collection schema currently doesn't have an `image` field defined. The `fetchMainInfos` function expects an image, so you may need to:
1. Add an `image` field to the Contents collection schema, OR
2. Use a relationship to the Media collection, OR
3. Store image URLs in the `description` or `blocks` field

Check the actual collection configuration and update the schema if needed.

### Recommended Content:

**Example Entry 1: Welcome Section**
```
Name: "Scrapyard"
Description: "Welcome to the Scrapyard. The Scrapyard is a place where you can find all the latest news and updates from the Streetbeefs community. Join us for exciting events, watch amazing fights, and connect with fighters from around the world."
Image: [Upload a hero image - e.g., yardday_zkkuvn.jpg]
```

**Example Entry 2: About Section**
```
Name: "About Streetbeefs"
Description: "Streetbeefs is a community-driven platform for fighters and fans. We provide a safe space for combat sports enthusiasts to connect, compete, and grow. Whether you're a fighter or a spectator, experience the warrior's courage."
Image: [Upload an about image]
```

### Notes:
- The `description` field is split: first sentence becomes `subtitle`, full text becomes `description`
- Image should be uploaded to Media collection first, then linked
- Multiple entries will be displayed as separate sections

---

## 2. Cards Collection

**Component**: `HomeCard` (`apps/web/src/components/Home/Card.tsx`)  
**Fetch Function**: `fetchCard()`  
**CMS Collection**: `cards`

### Required Fields:
- `name` (text) - Card title
- `image` (upload/relationship to media) - Card image
- `label` (text) - Subtitle/label text
- `cta` (text) - Call-to-action button text
- `href` (text) - Link destination
- `loading` (radio: 'eager' or 'lazy') - Image loading strategy

### Recommended Content:

**Example Entry 1: Media Card**
```
Name: "Scrapyard Records"
Label: "ScrapRecords Label"
CTA: "Check out all Media"
Href: "/media"
Loading: "eager"
Image: [Upload card image - e.g., received_379940754080520_hzf7q1.jpg]
```

**Example Entry 2: Events Card**
```
Name: "Upcoming Events"
Label: "Fight Night"
CTA: "View Schedule"
Href: "/events"
Loading: "lazy"
Image: [Upload events card image]
```

**Example Entry 3: Fighters Card**
```
Name: "Meet the Fighters"
Label: "Top Competitors"
CTA: "Browse Fighters"
Href: "/fighters"
Loading: "lazy"
Image: [Upload fighters card image]
```

### Notes:
- Cards are displayed prominently, so use high-quality images
- `loading: "eager"` for above-the-fold cards
- `loading: "lazy"` for cards that may be below the fold
- Multiple cards can be created for different sections

---

## 3. Heros Collection

**Component**: `HomeHero` (`apps/web/src/components/Home/Hero.tsx`)  
**Fetch Function**: `fetchHero()`  
**CMS Collection**: `heros`

### Required Fields:
- `href` (text) - Link destination (usually YouTube channel or video)
- `altText` (text) - Image alt text (optional)

**Note**: The Heros collection schema currently only has `href` and `altText` fields. The `image` and `video` fields may need to be added to the collection schema, or they may be handled through a relationship to the Media collection. Check the actual collection configuration in the CMS admin.

### Recommended Content:

**Example Entry 1: Main Hero**
```
Image: [Upload hero image - e.g., firechicken_animated_photo_fj1xej.jpg]
Video: "https://www.youtube.com/@streetbeefsScrapyard"
Alt Text: "Firechicken animated photo"
Href: "https://www.youtube.com/@streetbeefsScrapyard"
```

**Example Entry 2: Featured Video Hero**
```
Image: [Upload thumbnail image]
Video: "https://www.youtube.com/watch?v=VIDEO_ID"
Alt Text: "Featured fight video"
Href: "https://www.youtube.com/@streetbeefsScrapyard"
```

### Notes:
- Hero images should be large and high-quality (recommended: 1920x1080 or larger)
- Video can be a YouTube URL or uploaded media file
- Multiple heroes will be displayed in sequence
- `altText` is important for accessibility

---

## 4. Events Collection

**Component**: `HomeSection` (`apps/web/src/components/Home/Section.tsx`)  
**Fetch Function**: `fetchEvents()`  
**CMS Collection**: `events`

### Required Fields:
- `title` (text) - Main heading (e.g., "EVENTS")
- `name` (text) - Subheading/event name
- `description` (text) - Event description
- `image` (upload/relationship to media) - Event image
- `alt` (text) - Image alt text

### Recommended Content:

**Example Entry 1: Monthly Events**
```
Title: "EVENTS"
Name: "New Events Monthly"
Description: "Whether you are a fighter or a spectator, experience the warrior's courage. Join us every month for exciting fight nights, tournaments, and special events."
Image: [Upload event image - e.g., received_379940754080520_hzf7q1.jpg]
Alt: "Monthly fight events"
```

**Example Entry 2: Upcoming Tournament**
```
Title: "TOURNAMENT"
Name: "Championship Series"
Description: "The biggest tournament of the year. Watch top fighters compete for the championship title. Don't miss out on this epic showdown."
Image: [Upload tournament image]
Alt: "Championship tournament"
```

**Example Entry 3: Fight Night**
```
Title: "FIGHT NIGHT"
Name: "Weekly Matches"
Description: "Every Friday night, witness incredible matchups between skilled fighters. Experience the intensity, the passion, and the raw talent."
Image: [Upload fight night image]
Alt: "Weekly fight night"
```

### Notes:
- `title` is displayed as large heading (text-6xl to text-7xl)
- `name` is the secondary heading
- `description` provides context
- Images should be engaging and action-oriented

---

## 5. Banners Collection

**Component**: `HomeContent` (`apps/web/src/components/Home/Content.tsx`)  
**Fetch Function**: `fetchBanner()`  
**CMS Collection**: `banners`

### Required Fields:
- `title` (text) - Banner heading
- `description` (text) - Banner description
- `image` (upload/relationship to media) - Banner image
- `link` (text) - Link URL
- `alt` (text) - Image alt text

### Recommended Content:

**Example Entry 1: Welcome Banner**
```
Title: "Welcome!"
Description: "Check out the latest stats and join our growing community of fighters and fans."
Image: [Upload banner image - e.g., FB_IMG_1666183588935_zkdfmv.jpg]
Link: "/about"
Alt: "Streetbeefs Scrapyard banner image"
```

**Example Entry 2: Stats Banner**
```
Title: "Join the Community"
Description: "Connect with thousands of fighters and fans. Watch exclusive content and participate in events."
Image: [Upload community banner image]
Link: "/join"
Alt: "Community banner"
```

### Notes:
- Banner component displays stats (hardcoded in component)
- `title` becomes the heading
- `description` provides context
- `link` is used for navigation
- Only the first banner from the array is used

---

## Content Creation Workflow

### Step 1: Upload Media First
1. Go to `http://localhost:4000/admin`
2. Navigate to **Media** collection
3. Upload all images you'll need:
   - Hero images
   - Card images
   - Event images
   - Banner images
4. Note the media IDs or names for reference

### Step 2: Create Content Entries
1. **Contents**: Create 1-3 entries for main sections
2. **Cards**: Create 2-4 cards for different features
3. **Heros**: Create 1-2 hero sections
4. **Events**: Create 1-3 event entries
5. **Banners**: Create 1-2 banner entries

### Step 3: Link Media
- When creating entries, select the uploaded media for image fields
- Ensure images are properly linked (not just text URLs)

### Step 4: Verify Frontend
- Visit `http://localhost:3000`
- Check that components display CMS data
- Verify images load correctly
- Test links and navigation

---

## Content Best Practices

### Images
- **Hero Images**: 1920x1080 or larger, high quality
- **Card Images**: 800x600 or similar, optimized for web
- **Event Images**: 1200x800, action-oriented
- **Banner Images**: 1920x600, wide format

### Text Content
- Keep titles concise (3-5 words)
- Descriptions should be 1-3 sentences
- Use clear, action-oriented CTAs
- Ensure alt text is descriptive

### Organization
- Use consistent naming conventions
- Add dates/timestamps for events
- Organize by priority (most important first)
- Keep content fresh and updated

---

## Example Content Structure

### Home Page Content Flow:
1. **Hero Section** (from Heros) - Large visual impact
2. **Card Section** (from Cards) - Quick navigation
3. **Events Section** (from Events) - Featured content
4. **Main Content** (from Contents) - Detailed information
5. **Banner Section** (from Banners) - Call-to-action with stats

### Recommended Entry Counts:
- **Contents**: 1-3 entries
- **Cards**: 2-4 entries
- **Heros**: 1-2 entries
- **Events**: 1-3 entries
- **Banners**: 1 entry (only first is used)

---

## Troubleshooting

### Images Not Displaying
- Verify media is uploaded to Media collection
- Check that image relationship is properly linked
- Ensure image URLs are accessible
- Check browser console for 404 errors

### Content Not Showing
- Verify entries are created in correct collections
- Check that required fields are filled
- Ensure fetch functions are working (check Network tab)
- Verify CORS is configured correctly

### Wrong Data Displayed
- Check field names match expected structure
- Verify data mapping in fetch functions
- Check component prop types
- Review console for errors

---

## Quick Start Checklist

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

---

## Summary

Each collection serves a specific purpose on the frontend:

1. **Contents** → Main content sections with images
2. **Cards** → Feature cards with CTAs
3. **Heros** → Large hero sections with images/videos
4. **Events** → Event listings with descriptions
5. **Banners** → Promotional banners with stats

Start with 1-2 entries per collection to test, then expand based on your needs. Quality over quantity - focus on compelling content that engages users.
