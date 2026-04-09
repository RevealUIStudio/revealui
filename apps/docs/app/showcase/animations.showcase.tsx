import { usePresence, useSpring, useStagger } from '@revealui/presentation/animations';
import { useState } from 'react';
import type { ShowcaseStory } from '@/components/showcase/types.js';

function SpringDemo({ stiffness, damping }: { stiffness: number; damping: number }) {
  const [target, setTarget] = useState(0);
  const spring = useSpring(target, {
    config: { stiffness, damping, mass: 1 },
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-16 w-64 rounded-lg bg-(--rvui-color-surface-2)">
        <div
          className="absolute top-1 h-14 w-14 rounded-lg bg-(--rvui-color-primary) shadow-md"
          style={{ left: `${spring.value * 200}px` }}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setTarget(target === 0 ? 1 : 0)}
          className="rounded-lg bg-(--rvui-color-primary) px-4 py-2 text-sm font-medium text-white"
        >
          Toggle
        </button>
        <span className="flex items-center text-sm font-mono text-(--rvui-color-text-secondary)">
          v: {spring.value.toFixed(2)} | vel: {spring.velocity.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function PresenceDemo() {
  const [show, setShow] = useState(true);
  const { mounted, present, ref } = usePresence(show, 300);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="rounded-lg bg-(--rvui-color-primary) px-4 py-2 text-sm font-medium text-white"
      >
        {show ? 'Hide' : 'Show'}
      </button>
      {mounted && (
        <div
          ref={ref}
          className="rounded-lg bg-(--rvui-color-surface-2) px-8 py-6 shadow-lg"
          style={{
            opacity: present ? 1 : 0,
            transform: present ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          }}
        >
          <p className="font-medium text-(--rvui-color-text)">Animated content</p>
          <p className="text-sm text-(--rvui-color-text-secondary)">Smooth enter and exit</p>
        </div>
      )}
    </div>
  );
}

function StaggerDemo() {
  const [count, setCount] = useState(6);
  const delays = useStagger(count, { delay: 80 });
  const [key, setKey] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="rounded-lg bg-(--rvui-color-primary) px-4 py-2 text-sm font-medium text-white"
        >
          Replay
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => Math.min(c + 1, 12))}
          className="rounded-lg border border-(--rvui-color-border) px-3 py-2 text-sm"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => Math.max(c - 1, 2))}
          className="rounded-lg border border-(--rvui-color-border) px-3 py-2 text-sm"
        >
          -
        </button>
      </div>
      <div key={key} className="flex gap-2">
        {delays.map((delay) => (
          <div
            key={`${key}-${delay}`}
            className="h-12 w-12 rounded-lg bg-(--rvui-color-primary)"
            style={{
              animation: `fadeInUp 400ms ease-out ${delay}ms both`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const story: ShowcaseStory = {
  slug: 'animations',
  name: 'Animations',
  description:
    'Zero-dependency animation library: spring physics, presence animations, stagger delays, gestures.',
  category: 'hook',

  controls: {
    demo: {
      type: 'select',
      options: ['spring', 'presence', 'stagger'],
      default: 'spring',
    },
    stiffness: {
      type: 'range',
      default: 170,
      min: 50,
      max: 500,
      step: 10,
    },
    damping: {
      type: 'range',
      default: 26,
      min: 5,
      max: 80,
      step: 1,
    },
  },

  render: (props) => {
    const demo = props.demo as string;

    if (demo === 'presence') return <PresenceDemo />;
    if (demo === 'stagger') return <StaggerDemo />;
    return <SpringDemo stiffness={props.stiffness as number} damping={props.damping as number} />;
  },

  examples: [
    {
      name: 'Spring Presets',
      description: 'Compare different spring configurations',
      render: () => {
        const presets = [
          { name: 'gentle', stiffness: 120, damping: 14 },
          { name: 'default', stiffness: 170, damping: 26 },
          { name: 'bouncy', stiffness: 300, damping: 10 },
          { name: 'stiff', stiffness: 400, damping: 30 },
        ];

        function PresetRow({
          stiffness,
          damping,
          name,
        }: {
          stiffness: number;
          damping: number;
          name: string;
        }) {
          const [target, setTarget] = useState(0);
          const spring = useSpring(target, { config: { stiffness, damping, mass: 1 } });

          return (
            <div className="flex items-center gap-4">
              <span className="w-16 text-xs font-mono text-(--rvui-color-text-secondary)">
                {name}
              </span>
              <div className="relative h-8 w-48 rounded bg-(--rvui-color-surface-2)">
                <div
                  className="absolute top-0.5 h-7 w-7 rounded bg-(--rvui-color-primary)"
                  style={{ left: `${spring.value * 164}px` }}
                />
              </div>
              <button
                type="button"
                onClick={() => setTarget(target === 0 ? 1 : 0)}
                className="text-xs text-(--rvui-color-primary) hover:underline"
              >
                toggle
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-3">
            {presets.map((p) => (
              <PresetRow key={p.name} {...p} />
            ))}
          </div>
        );
      },
    },
    {
      name: 'Presence Animation',
      render: () => <PresenceDemo />,
    },
    {
      name: 'Staggered List',
      render: () => <StaggerDemo />,
    },
  ],

  code: (props) => {
    if (props.demo === 'presence') {
      return `const { mounted, present, ref } = usePresence(show, 300);

if (!mounted) return null;
<div ref={ref} style={{
  opacity: present ? 1 : 0,
  transition: 'opacity 300ms ease-out',
}}>
  Content
</div>`;
    }
    if (props.demo === 'stagger') {
      return `const delays = useStagger(items.length, { delay: 80 });

items.map((item, i) => (
  <div style={{ animation: \`fadeIn 400ms \${delays[i]}ms both\` }}>
    {item}
  </div>
))`;
    }
    return `const spring = useSpring(target, {
  config: { stiffness: ${props.stiffness}, damping: ${props.damping}, mass: 1 },
});

<div style={{ transform: \`translateX(\${spring.value * 200}px)\` }} />`;
  },
};

export default story;
