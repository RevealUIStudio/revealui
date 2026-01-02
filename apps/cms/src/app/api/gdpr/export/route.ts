import { NextRequest, NextResponse } from "next/server"
import configPromise from "@reveal-config"
import { getRevealUI } from "@revealui/cms"

export const dynamic = "force-dynamic"

/**
 * GDPR Data Export Endpoint
 * Allows users to export their personal data in JSON format
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email } = body

    if (!userId && !email) {
      return NextResponse.json(
        { error: "User ID or email is required" },
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

    const userData = user.docs[0]

    // Export user data (excluding sensitive fields)
    const exportData = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      roles: userData.roles,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      // Add other non-sensitive user data
    }

    return NextResponse.json(
      {
        data: exportData,
        exportedAt: new Date().toISOString(),
        format: "json",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="user-data-${userData.id}.json"`,
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to export data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

