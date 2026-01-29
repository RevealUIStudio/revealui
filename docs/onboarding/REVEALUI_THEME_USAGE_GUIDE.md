# RevealUI Theme Usage Guide for CMS Next.js App

## ✅ Integration Complete

The RevealUI theme has been successfully integrated into your CMS Next.js application (`apps/cms`). All components are ready to use!

---

## 📦 What's Available

### 1. Base Elements (Ready to Use)

Located in: `apps/cms/src/components/revealui/elements/`

#### Button Components
```typescript
import { ButtonLink, PlainButtonLink, SoftButtonLink } from '@/components/revealui/elements'

// Primary button
<ButtonLink href="/page" size="lg">Get Started</ButtonLink>

// Secondary button
<SoftButtonLink href="/page">Learn More</SoftButtonLink>

// Text button
<PlainButtonLink href="/page">View Details</PlainButtonLink>
```

#### Layout Components
```typescript
import { Container, Section } from '@/components/revealui/elements'

<Section>
  <Container>
    {/* Your content with consistent max-width and padding */}
  </Container>
</Section>
```

#### Typography Components
```typescript
import { Heading, Text, Eyebrow, Subheading } from '@/components/revealui/elements'

<Eyebrow>Featured</Eyebrow>
<Heading>Main Title</Heading>
<Subheading>Subtitle</Subheading>
<Text size="lg">Body text with consistent styling</Text>
```

#### Link Component
```typescript
import { RevealUILink } from '@/components/revealui/elements'

<RevealUILink href="/page">Link text</RevealUILink>
```

#### Other Elements
- `AnnouncementBadge` - For announcements/badges
- `Screenshot` - For displaying images with dark mode variants
- `LogoGrid` - For displaying logo grids
- `Main` - Main content wrapper

---

### 2. Section Components (Ready to Use)

Located in: `apps/cms/src/components/revealui/sections/`

#### Navbar
```typescript
import {
  NavbarWithLinksActionsAndCenteredLogo,
  NavbarLink,
  NavbarLogo
} from '@/components/revealui/sections'
import { ButtonLink, PlainButtonLink } from '@/components/revealui/elements'

<NavbarWithLinksActionsAndCenteredLogo
  links={
    <>
      <NavbarLink href="/about">About</NavbarLink>
      <NavbarLink href="/docs">Docs</NavbarLink>
    </>
  }
  logo={<NavbarLogo href="/">Logo</NavbarLogo>}
  actions={
    <>
      <PlainButtonLink href="/login">Log in</PlainButtonLink>
      <ButtonLink href="/get-started">Get started</ButtonLink>
    </>
  }
/>
```

**Features**:
- ✅ Sticky header
- ✅ Centered logo
- ✅ Mobile menu with dialog
- ✅ Responsive design
- ✅ Dark mode support

#### Footer
```typescript
import {
  FooterWithNewsletterFormCategoriesAndSocialIcons,
  FooterCategory,
  FooterLink,
  SocialLink,
  NewsletterForm
} from '@/components/revealui/sections'

<FooterWithNewsletterFormCategoriesAndSocialIcons
  cta={
    <NewsletterForm
      headline="Stay in the loop"
      subheadline={<p>Get updates and news</p>}
      action="/api/newsletter"
    />
  }
  links={
    <>
      <FooterCategory title="Product">
        <FooterLink href="/features">Features</FooterLink>
        <FooterLink href="/pricing">Pricing</FooterLink>
      </FooterCategory>
      <FooterCategory title="Company">
        <FooterLink href="/about">About</FooterLink>
        <FooterLink href="/blog">Blog</FooterLink>
      </FooterCategory>
    </>
  }
  socialLinks={
    <>
      <SocialLink href="https://twitter.com" name="Twitter">
        {/* Icon component */}
      </SocialLink>
    </>
  }
  fineprint="© 2025 RevealUI"
/>
```

**Features**:
- ✅ Newsletter signup form
- ✅ Link categories
- ✅ Social media icons
- ✅ Responsive grid layout
- ✅ Dark mode support

#### Hero Sections
```typescript
import { HeroLeftAlignedWithDemo } from '@/components/revealui/sections'
import { AnnouncementBadge } from '@/components/revealui/elements'
import { ButtonLink, PlainButtonLink } from '@/components/revealui/elements'
import Image from 'next/image'

<HeroLeftAlignedWithDemo
  eyebrow={<AnnouncementBadge href="#" text="New Feature" cta="Learn more" />}
  headline="Build Amazing Applications"
  subheadline={<p>Create beautiful apps with RevealUI Framework</p>}
  cta={
    <>
      <ButtonLink href="/get-started" size="lg">Get Started</ButtonLink>
      <PlainButtonLink href="/docs" size="lg">View Docs</PlainButtonLink>
    </>
  }
  demo={
    <Image src="/hero-image.jpg" alt="Hero" width={1200} height={800} />
  }
  footer={
    {/* Optional footer content like logo grid */}
  }
/>
```

**Alternative**: `HeroCenteredWithPhoto` for centered layout

#### Stats Section
```typescript
import { StatsWithGraph, Stat } from '@/components/revealui/sections'

<StatsWithGraph
  eyebrow="Built for scale"
  headline="Powering applications everywhere"
  subheadline={<p>RevealUI helps teams build faster</p>}
>
  <Stat stat="2M+" text="Applications built" />
  <Stat stat="99.9%" text="Uptime guarantee" />
  <Stat stat="50K+" text="Active developers" />
</StatsWithGraph>
```

**Features**:
- ✅ Large stat display
- ✅ Beautiful graph visualization
- ✅ Responsive grid
- ✅ Dark mode support

---

## 🎨 Design System

### Colors

Use Mist colors in Tailwind classes:

```typescript
// Backgrounds
<div className="bg-mist-100 dark:bg-mist-950">

// Text
<p className="text-mist-950 dark:text-white">

// Borders
<div className="border-mist-200 dark:border-mist-800">
```

**Available Colors**: `mist-50`, `mist-100`, `mist-200`, `mist-300`, `mist-400`, `mist-500`, `mist-600`, `mist-700`, `mist-800`, `mist-900`, `mist-950`

### Typography

**Display Font** (Mona Sans):
```typescript
<h1 className="font-display">Display Heading</h1>
```

**Body Font** (Inter):
```typescript
<p className="font-sans">Body text</p>
```

---

## 🔄 Integration with CMS Data

### Header Integration Example

```typescript
// apps/cms/src/lib/globals/Header/RevealUIHeader.tsx
import { NavbarWithLinksActionsAndCenteredLogo, NavbarLink, NavbarLogo } from '@/components/revealui/sections'
import { ButtonLink, PlainButtonLink } from '@/components/revealui/elements'
import { HeaderType } from './Component'
import { getLinkUrl } from '@/lib/utilities/revealui-helpers'

export function RevealUIHeader({ header }: { header: HeaderType }) {
  return (
    <NavbarWithLinksActionsAndCenteredLogo
      links={
        <>
          {header.navItems?.map((item, idx) => (
            <NavbarLink key={idx} href={getLinkUrl(item.link)}>
              {item.link.label}
            </NavbarLink>
          ))}
        </>
      }
      logo={
        <NavbarLogo href="/">
          <Image
            src="/logo.svg"
            alt="RevealUI"
            width={113}
            height={28}
          />
        </NavbarLogo>
      }
      actions={
        <>
          <PlainButtonLink href="/login">Log in</PlainButtonLink>
          <ButtonLink href="/get-started">Get started</ButtonLink>
        </>
      }
    />
  )
}
```

### Footer Integration Example

```typescript
// apps/cms/src/lib/globals/Footer/RevealUIFooter.tsx
import {
  FooterWithNewsletterFormCategoriesAndSocialIcons,
  FooterCategory,
  FooterLink,
} from '@/components/revealui/sections'
import { FooterType } from './Component'
import { getLinkUrl } from '@/lib/utilities/revealui-helpers'

export function RevealUIFooter({ footer }: { footer: FooterType }) {
  // Group nav items by category (you may need to add category field to CMS)
  const categories = groupNavItemsByCategory(footer.navItems)
  
  return (
    <FooterWithNewsletterFormCategoriesAndSocialIcons
      links={
        <>
          {categories.map((category) => (
            <FooterCategory key={category.title} title={category.title}>
              {category.items.map((item, idx) => (
                <FooterLink key={idx} href={getLinkUrl(item.link)}>
                  {item.link.label}
                </FooterLink>
              ))}
            </FooterCategory>
          ))}
        </>
      }
      fineprint="© 2025 RevealUI"
    />
  )
}
```

---

## 📝 Quick Reference

### Import Paths

All components use the `@/components/revealui/*` path:

```typescript
// Elements
import { ButtonLink } from '@/components/revealui/elements'
import { Container, Section } from '@/components/revealui/elements'
import { Heading, Text } from '@/components/revealui/elements'

// Sections
import { NavbarWithLinksActionsAndCenteredLogo } from '@/components/revealui/sections'
import { FooterWithNewsletterFormCategoriesAndSocialIcons } from '@/components/revealui/sections'
import { HeroLeftAlignedWithDemo } from '@/components/revealui/sections'
```

### Or use index exports:

```typescript
import { ButtonLink, Container, Heading } from '@/components/revealui/elements'
import { NavbarWithLinksActionsAndCenteredLogo } from '@/components/revealui/sections'
```

---

## 🎯 Recommended Usage

### For CMS Pages

1. **Use RevealUI components** for consistent styling
2. **Map CMS data** to RevealUI component props
3. **Keep CMS data fetching** logic (don't change that)
4. **Replace UI components** gradually

### Component Priority

1. **High Priority** (Replace first):
   - Header/Navbar
   - Footer
   - Buttons
   - Typography (Heading, Text)

2. **Medium Priority**:
   - Hero sections
   - Stats sections
   - Container/Section wrappers

3. **Low Priority** (As needed):
   - Feature sections
   - Testimonials
   - FAQs
   - Other sections

---

## 🚀 Getting Started

### Step 1: Test a Component

Add to any page to test:

```typescript
// apps/cms/src/app/(frontend)/[slug]/page.tsx
import { ButtonLink } from '@/components/revealui/elements'

export default async function Page() {
  return (
    <div>
      <ButtonLink href="/test">Test RevealUI Button</ButtonLink>
    </div>
  )
}
```

### Step 2: Replace Header

1. Create `RevealUIHeader.tsx` (see example above)
2. Update `Header/Component.tsx` to use it
3. Test navigation and mobile menu

### Step 3: Replace Footer

1. Create `RevealUIFooter.tsx` (see example above)
2. Update `Footer/Component.tsx` to use it
3. Test footer links and layout

### Step 4: Use in Pages

1. Replace custom components with RevealUI components
2. Use `Container` and `Section` for layout
3. Use `Heading` and `Text` for typography

---

## 📊 Component Compatibility

| Component | Next.js | CMS Data | Status |
|-----------|---------|----------|--------|
| Buttons | ✅ | ✅ | Ready |
| Container | ✅ | ✅ | Ready |
| Typography | ✅ | ✅ | Ready |
| Navbar | ✅ | ⚠️ Needs adapter | Ready after adapter |
| Footer | ✅ | ⚠️ Needs adapter | Ready after adapter |
| Hero | ✅ | ⚠️ Needs adapter | Ready after adapter |
| Stats | ✅ | ⚠️ Needs adapter | Ready after adapter |

---

## 🎨 Styling Notes

### Dark Mode

All components support dark mode automatically:
- Use `dark:` variant classes
- Colors switch automatically
- No additional configuration needed

### Responsive Design

All components are mobile-first:
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Mobile menu in navbar
- Responsive grids in sections

### Customization

You can customize components by:
1. Passing `className` prop (merges with default styles)
2. Modifying component files directly
3. Using Tailwind classes with Mist colors

---

## 📚 Additional Resources

- **Full Analysis**: `REVEALUI-THEME-ANALYSIS.md` - Complete theme breakdown
- **Integration Plan**: `REVEALUI-CMS-INTEGRATION-PLAN.md` - Detailed steps
- **Summary**: `REVEALUI-CMS-INTEGRATION-SUMMARY.md` - Quick reference

---

## ✅ Status

**Foundation**: ✅ **Complete**

- Dependencies installed
- Theme configured
- Components copied and updated
- Next.js Link integrated
- Imports fixed
- Ready to use!

**Next Steps**: Create adapted Header/Footer components that map CMS data to RevealUI components.

---

**All RevealUI theme components are now available in your CMS Next.js app!** 🎉

## Related Documentation

- [CMS Content Examples](./CMS-CONTENT-EXAMPLES.md) - Ready-to-use content
- [CMS Content Recommendations](./CMS_CONTENT_RECOMMENDATIONS.md) - Content best practices
- [CMS Frontend Connection Guide](./CMS_FRONTEND_CONNECTION_GUIDE.md) - Connect CMS to frontend
- [Blog Creation Guide](./BLOG-CREATION-GUIDE.md) - Create blog posts
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
- [Keywords Index](../KEYWORDS.md) - Search by keyword
