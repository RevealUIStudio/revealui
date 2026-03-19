import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('revealui-session');
  const roleCookie = cookieStore.get('revealui-role');

  if (sessionCookie?.value && roleCookie?.value === 'admin') {
    redirect('/admin');
  }

  redirect('/login');
}
