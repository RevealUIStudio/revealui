import { redirect } from 'next/navigation';

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://revealui.com';

export default function PrivacyPage() {
  redirect(`${MARKETING_URL}/privacy`);
}
