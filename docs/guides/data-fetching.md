# Data Fetching Guide

Learn how to fetch data in RevealUI pages.

## Server-Side Data Fetching

Use the `data()` function for server-side data fetching:

```tsx
export async function data() {
  const response = await fetch("https://api.example.com/data");
  const data = await response.json();
  return { data };
}

export default function Page({ data }) {
  return <div>{/* Use data here */}</div>;
}
```

## Client-Side Data Fetching

Use React hooks for client-side data:

```tsx
import { useState, useEffect } from "react";

export default function Page() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch("/api/data")
      .then(res => res.json())
      .then(setData);
  }, []);
  
  return <div>{data && /* render data */}</div>;
}
```

## Route Parameters in Data

Access route parameters in `data()`:

```tsx
export async function data({ routeParams }) {
  const { id } = routeParams;
  const response = await fetch(`/api/users/${id}`);
  return { user: await response.json() };
}
```

## PayloadCMS Integration

Fetch data from PayloadCMS:

```tsx
import { getPayload } from "payload";

export async function data() {
  const payload = await getPayload();
  const posts = await payload.find({
    collection: "posts",
  });
  return { posts: posts.docs };
}
```

## Error Handling

Handle errors in data fetching:

```tsx
export async function data() {
  try {
    const data = await fetchData();
    return { data };
  } catch (error) {
    return { error: error.message };
  }
}
```

## Caching

Cache data fetching results:

```tsx
export async function data() {
  // Data is automatically cached per route
  const data = await fetchExpensiveData();
  return { data };
}
```

## Streaming

Stream data for better performance:

```tsx
export async function data() {
  // Use streaming for large datasets
  const stream = await fetchStreamingData();
  return { stream };
}
```

## Learn More

- [Routing](./routing.md)
- [Plugins](./plugins.md)
- [Deployment](./deployment.md)

