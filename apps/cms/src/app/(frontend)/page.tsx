import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CmsLandingPage } from '@/lib/components/CmsLandingPage'

// Force dynamic rendering — needs to check session cookie
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default async function RootPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('revealui-session') ?? cookieStore.get('revealui_session')

  if (sessionCookie?.value) {
    redirect('/admin')
  }

  return <CmsLandingPage />
}
