# New React Component Workflow

Step-by-step guide for creating a new React component.

## Steps

1. **Create Component File**
   - Location: `apps/cms/src/lib/components/YourComponent/index.tsx`
   - Use functional component with TypeScript
   - Add proper prop types with interface

2. **Add TypeScript Interface**
   ```typescript
   interface YourComponentProps {
     title: string;
     optional?: boolean;
   }
   ```

3. **Export Component**
   - Use named export: `export const YourComponent`
   - Create index file for clean imports

4. **Add Styling**
   - Use Tailwind CSS classes
   - Follow existing component patterns
   - Ensure responsive design

5. **Add to Storybook (if applicable)**
   - Create story file
   - Document props and usage

6. **Test Component**
   - Create unit test if complex logic
   - Test in isolation
   - Verify accessibility

## Template

```typescript
import React from "react";

interface YourComponentProps {
  title: string;
  description?: string;
}

export const YourComponent: React.FC<YourComponentProps> = ({
  title,
  description,
}) => {
  return (
    <div className="container">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
};
```

