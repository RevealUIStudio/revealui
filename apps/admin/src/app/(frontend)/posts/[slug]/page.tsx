import { permanentRedirect } from 'next/navigation';

export default async function PostRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`https://revealui.com/blog/${slug}`);
}
