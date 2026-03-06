import { Audiences } from '@/components/Audiences'
import { Footer } from '@/components/Footer'
import { HeroSection } from '@/components/HeroSection'
import { LeadCapture } from '@/components/LeadCapture'
import { NavBar } from '@/components/NavBar'
import { SocialProof } from '@/components/SocialProof'
import { ValueProposition } from '@/components/ValueProposition'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <HeroSection />
      <ValueProposition />
      <SocialProof />
      <Audiences />
      <LeadCapture />
      <Footer />
    </div>
  )
}
