import { Audiences } from '@/components/Audiences';
import { EcosystemSection } from '@/components/EcosystemSection';
import { Footer } from '@/components/Footer';
import { GetStarted } from '@/components/GetStarted';
import { HeroSection } from '@/components/HeroSection';
import { SocialProof } from '@/components/SocialProof';
import { ValueProposition } from '@/components/ValueProposition';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <ValueProposition />
      <SocialProof />
      <EcosystemSection />
      <Audiences />
      <GetStarted />
      <Footer />
    </div>
  );
}
