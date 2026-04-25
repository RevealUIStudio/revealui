import { Footer } from '@/components/Footer';
import { GetStarted } from '@/components/GetStarted';
import { DemoV2 } from '@/components/v2/DemoV2';
import { FaqV2 } from '@/components/v2/FaqV2';
import { HeroV2 } from '@/components/v2/HeroV2';
import { PersonaV2 } from '@/components/v2/PersonaV2';
import { PricingTeaserV2 } from '@/components/v2/PricingTeaserV2';
import { PrimitivesV2 } from '@/components/v2/PrimitivesV2';
import { ProblemV2 } from '@/components/v2/ProblemV2';
import { ProofV2 } from '@/components/v2/ProofV2';

export default function HomeV2() {
  return (
    <div className="min-h-screen bg-white">
      <HeroV2 />
      <ProblemV2 />
      <DemoV2 />
      <PrimitivesV2 />
      <PersonaV2 />
      <ProofV2 />
      <PricingTeaserV2 />
      <FaqV2 />
      <GetStarted />
      <Footer />
    </div>
  );
}
