import { NextRequest, NextResponse } from "next/server"
import configPromise from "@reveal-config"
import { getRevealUI } from "revealui/cms"

export const dynamic = "force-dynamic"

/**
 * GDPR Right to Deletion Endpoint
 * Allows users to request deletion of their personal data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, confirmation } = body

    if (!userId && !email) {
      return NextResponse.json(
        { error: "User ID or email is required" },
        { status: 400 }
      )
    }

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        {
          error: "Confirmation required",
          message: "Please confirm deletion by sending 'DELETE' in the confirmation field",
        },
        { status: 400 }
      )
    }

    const payload = await getRevealUI({
      config: configPromise,
    })

    // Find user
    const user = await payload.find({
      collection: "users",
      where: {
        ...(userId ? { id: { equals: userId } } : { email: { equals: email } }),
      },
      limit: 1,
    })

    if (user.docs.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userIdToDelete = user.docs[0].id

    // Delete user data
    await payload.delete({
      collection: "users",
      id: userIdToDelete,
    })

    return NextResponse.json(
      {
        success: true,
        message: "User data deleted successfully",
        deletedAt: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

