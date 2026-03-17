import { permanentRedirect } from 'next/navigation';

export default function PaginatedPostsRedirect() {
  permanentRedirect('https://revealui.com/blog');
}
