import { Heading, RevealUIMark } from '@revealui/presentation/server';

const Logo = () => (
  <div className="flex flex-col items-center gap-4">
    <RevealUIMark title="RevealUI" className="h-16 w-16 text-primary lg:h-24 lg:w-24" />
    <Heading as="h1" size="2xl" className="text-center tracking-tight lg:text-3xl">
      RevealUI
    </Heading>
  </div>
);

export default Logo;
