import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { RevealUser } from "@revealui/cms"

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string
  user: RevealUser
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const token = cookieStore.get("revealui-token")?.value

  const meUserReq = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`,
    {
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  )

  const {
    user,
  }: {
    user: RevealUser
  } = await meUserReq.json()

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && (!meUserReq.ok || !user)) {
    redirect(nullUserRedirect)
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token!,
    user,
  }
}
