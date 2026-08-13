import { Heading, LinkButton, Text } from '@revealui/presentation';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Heading>RevealUI</Heading>
      <Text className="mt-3">Your project is running. Visit the admin to manage content.</Text>
      <div className="mt-6">
        <LinkButton href="/admin" variant="brand">
          Open admin
        </LinkButton>
      </div>
      <Text className="mt-6 text-sm">
        Edit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">src/app/page.tsx</code> to
        customize this page.
      </Text>
    </main>
  );
}
