import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
const Solid = ({ color, darkColor, negativeIndex }: any) => (
  <div
    style={{
      backgroundColor: color,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      position: 'absolute',
      inset: 0
    }}
  />
)

const BackgroundWrapper = ({ children, backgrounds }: any) => (
  <div style={{ position: 'relative' }}>
    {backgrounds}
    {children}
  </div>
)

interface FightersBackgroundProps {
  children: React.ReactNode
  index: number
}

const FightersBackground: React.FC<FightersBackgroundProps> = ({ children, index }) => {
  return (
    <BackgroundWrapper
      backgrounds={[<Solid color="black" darkColor="black" key={index} negativeIndex={10} />]}
    >
      {children}
    </BackgroundWrapper>
  )
}

export default FightersBackground

// import { BackgroundWrapper, Solid } from "reveal";

// const FightersBackground = (
//   { children }: { children: React.ReactNode },
//   index: number,
// ) => {
//   return (
//     <BackgroundWrapper
//       backgrounds={[
//         <Solid
//           color="black"
//           darkColor="black"
//           key={index}
//           negativeIndex={10}
//         />,
//         // <GradientGlass
//         //   id={"firechicken"}
//         //   className="grid rounded"
//         //   indexClass={0}
//         // />,
//       ]}
//     >
//       {children}
//     </BackgroundWrapper>
//   );
// };

// export default FightersBackground;
