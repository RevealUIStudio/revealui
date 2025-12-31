# Components API Reference

## Island

Isolated hydration component.

```tsx
import { Island } from "reveal/components/Island";

<Island
  component={MyComponent}
  props={{ data: someData }}
  strategy="visible"
/>
```

### Props

- `component` - Component to render
- `props` - Props to pass to component
- `strategy` - Hydration strategy (`immediate`, `idle`, `visible`, `interaction`, `never`)
- `clientOnly` - Skip SSR

## createIsland

Create an island component:

```tsx
import { createIsland } from "reveal/components/Island";

const LazyComponent = createIsland(MyComponent, "visible");
```

## Progressive Hydration

Configure progressive hydration:

```typescript
import { setupProgressiveHydration } from "reveal/integration/hydration";

setupProgressiveHydration("/blog", {
  type: "idle",
  priority: 5,
});
```

## Learn More

- [Island Architecture](../guides/island-architecture.md)

