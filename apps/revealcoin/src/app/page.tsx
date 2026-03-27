import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/HeroSection';
import { RoadmapSection } from '@/components/RoadmapSection';
import { ValueProposition } from '@/components/ValueProposition';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <HeroSection />
      <ValueProposition />
      <RoadmapSection />
      <Footer />
    </div>
  );
}
