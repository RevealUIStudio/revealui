import { Footer } from '@/components/Footer'
import { HeroSection } from '@/components/HeroSection'
import { LeadCapture } from '@/components/LeadCapture'
import { SocialProof } from '@/components/SocialProof'
import { ValueProposition } from '@/components/ValueProposition'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <ValueProposition />
      <SocialProof />
      <LeadCapture />
      <Footer />
    </div>
  )
}
