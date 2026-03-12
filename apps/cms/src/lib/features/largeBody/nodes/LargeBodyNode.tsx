'use server';
import type React from 'react';
import './index.css';

const baseClass = 'rich-text-large-body';

// Define the type for the 'element' prop - adjust according to your needs
interface ElementData {
  id: string;
  type: string;
}

interface LargeBodyElementProps {
  attributes: React.HTMLAttributes<HTMLDivElement>;
  element: ElementData; // Use the specific type here
  children: React.ReactNode;
}

export const LargeBodyNode = async ({ attributes, children }: LargeBodyElementProps) => (
  <div {...attributes}>
    <span className={baseClass}>{children}</span>
  </div>
);
