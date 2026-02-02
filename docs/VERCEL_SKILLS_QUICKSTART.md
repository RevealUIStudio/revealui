# Vercel Skills Quick Start

Get started with Vercel Skills integration in 5 minutes.

## 1. Search for Skills

Find skills in the Vercel catalog:

```bash
pnpm skills search "react" --vercel
```

Output:
```
Vercel Skills Search Results
  react-best-practices (95.0% match)
    React optimization patterns from Vercel Engineering
    81,700 installs
    Install: pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
```

## 2. Install a Skill

```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
```

Output:
```
Installing from Vercel Skills: vercel-labs/agent-skills/react-best-practices
Installed skill: react-best-practices
  Description: React optimization patterns and best practices
  Source: vercel
  Location: .revealui/skills/react-best-practices
```

## 3. View Trending Skills

```bash
pnpm skills trending --vercel
```

Output:
```
Trending Vercel Skills
  react-best-practices
    React optimization patterns and best practices
    81,700 installs

  web-design-guidelines
    100+ accessibility and performance rules
    61,900 installs

  find-skills
    Meta-skill for discovering other skills
    78,800 installs
```

## 4. List Installed Skills

```bash
pnpm skills list
```

Output shows all skills from all sources (GitHub, local, Vercel).

## 5. Use the Skill

Skills are automatically activated based on context. The AI will use them when relevant to your task.

For example, when working on React code:
- `react-best-practices` activates automatically
- Provides optimization guidance
- Suggests better patterns

## 6. Update a Skill

Keep Vercel skills up to date:

```bash
pnpm skills update react-best-practices
```

## Common Workflows

### Install Multiple Skills

```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
pnpm skills add vercel-labs/agent-skills/nextjs-best-practices --vercel
pnpm skills add vercel-labs/agent-skills/typescript-patterns --vercel
pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel
```

### Search Before Installing

```bash
# Search catalog
pnpm skills search "typescript" --vercel

# Pick one and install
pnpm skills add vercel-labs/agent-skills/typescript-patterns --vercel
```

### Install Globally

```bash
# Available across all projects
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel --global
```

### View Skill Details

```bash
pnpm skills info react-best-practices
```

### Remove a Skill

```bash
pnpm skills remove react-best-practices
```

## Recommended First Skills

Start with these popular skills:

1. **react-best-practices** - Essential for React development
2. **nextjs-best-practices** - Must-have for Next.js projects
3. **web-design-guidelines** - Universal UI/UX guidelines
4. **typescript-patterns** - TypeScript best practices
5. **find-skills** - Helps discover more skills

Install all at once:
```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel && \
pnpm skills add vercel-labs/agent-skills/nextjs-best-practices --vercel && \
pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel && \
pnpm skills add vercel-labs/agent-skills/typescript-patterns --vercel && \
pnpm skills add vercel-labs/agent-skills/find-skills --vercel
```

## What Makes Vercel Skills Special?

- ✅ **Professional Quality**: From Vercel's 10 years of React/Next.js experience
- ✅ **Battle-Tested**: 36,000+ installations across the community
- ✅ **Maintained**: Regular updates from Vercel and community
- ✅ **Cross-Platform**: Works with 17+ AI tools
- ✅ **Enhanced in RevealUI**: Gets semantic search and embeddings

## Next Steps

- Read the [full documentation](./VERCEL_SKILLS_INTEGRATION.md)
- Explore the [skills catalog](https://skills.sh)
- Learn about [RevealUI's skills system](./AUTOMATION.md)

## Getting Help

### Skill not found?
Check the catalog: `pnpm skills search <query> --vercel`

### Installation failed?
Try with force: `pnpm skills add <source> --vercel --force`

### Want to create your own?
```bash
pnpm skills create my-skill
# Edit .revealui/skills/my-skill/SKILL.md
```

## Tips

- Use `--json` flag for machine-readable output
- Search before installing to discover related skills
- Check trending skills regularly for new releases
- Keep skills updated for the latest improvements
- Mix Vercel, GitHub, and local skills as needed

Enjoy using Vercel Skills with RevealUI! 🚀
