import React from "react";
import { BackgroundWrapper, Solid } from "reveal/ui/backgrounds";

interface FightersBackgroundProps {
  children: React.ReactNode;
  index: number;
}

const FightersBackground: React.FC<FightersBackgroundProps> = ({
  children,
  index,
}) => {
  return (
    <BackgroundWrapper
      backgrounds={[
        <Solid
          color="black"
          darkColor="black"
          key={index}
          negativeIndex={10}
        />,
      ]}
    >
      {children}
    </BackgroundWrapper>
  );
};

export default FightersBackground;

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
