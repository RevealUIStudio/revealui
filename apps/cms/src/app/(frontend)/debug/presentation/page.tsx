'use client'

// Test: import only @revealui/presentation/server
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server'

export default function PresentationTestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Presentation Import Test</h1>
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button">Test Button</Button>
        </CardContent>
      </Card>
    </div>
  )
}
