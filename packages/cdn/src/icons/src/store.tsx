import React from "react";

export interface IconProps {
  size: number;
  className?: string;
}

export const Expand: React.FC<IconProps> = ({ size, className }) => {
  // Replace this with your actual Expand icon implementation
  return (
    <div style={{ fontSize: size }} className={className}>
      Expand Icon
    </div>
  );
};

export const ShoppingCart: React.FC<IconProps> = ({ size, className }) => {
  // Replace this with your actual ShoppingCart icon implementation
  return (
    <div style={{ fontSize: size }} className={className}>
      Shopping Cart Icon
    </div>
  );
};
