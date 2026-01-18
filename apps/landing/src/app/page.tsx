import { HeroSection } from '@/components/HeroSection'
import { ValueProposition } from '@/components/ValueProposition'
import { SocialProof } from '@/components/SocialProof'
import { LeadCapture } from '@/components/LeadCapture'
import { Footer } from '@/components/Footer'

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
