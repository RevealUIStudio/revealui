---
name: web-design-guidelines
description: Web interface design guidelines for building polished, accessible, and intuitive user interfaces.
---

# Web Design Guidelines

Refer to the official documentation for comprehensive guidance:

- https://interfaces.rauno.me
- https://www.w3.org/WAI/WCAG21/quickref/
- https://developer.mozilla.org/en-US/docs/Web/Accessibility

## Key Points

- Design with spatial consistency: use a fixed spacing scale (4px/8px grid), consistent border radii, and predictable padding so the interface feels cohesive rather than ad hoc
- Prioritize accessibility from the start: use semantic HTML elements, ensure sufficient color contrast (WCAG AA minimum), provide visible focus indicators, and support keyboard navigation for all interactive elements
- Respect motion preferences: wrap animations in `prefers-reduced-motion` media queries, keep transitions under 200ms for micro-interactions, and avoid layout shifts that disrupt reading flow
- Use progressive disclosure: show only essential information by default and reveal details on demand through expandable sections, tooltips, or drill-down views rather than overwhelming the user upfront
- Maintain typographic hierarchy: limit to 2-3 font sizes per view, use weight and color (not just size) to establish importance, and ensure body text has a comfortable line height (1.5-1.75) and line length (45-75 characters)
