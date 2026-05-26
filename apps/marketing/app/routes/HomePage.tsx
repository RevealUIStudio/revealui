import { Footer } from '../components/Footer';
import { GetStarted } from '../components/GetStarted';
import { Demo } from '../components/landing/Demo';
import { Faq } from '../components/landing/Faq';
import { Hero } from '../components/landing/Hero';
import { Persona } from '../components/landing/Persona';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { Primitives } from '../components/landing/Primitives';
import { Problem } from '../components/landing/Problem';
import { Proof } from '../components/landing/Proof';
import { WhatsShipped } from '../components/landing/WhatsShipped';

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Problem />
      <Demo />
      <Primitives />
      <WhatsShipped />
      <Persona />
      <Proof />
      <PricingTeaser />
      <Faq />
      <GetStarted />
      <Footer />
    </div>
  );
}
