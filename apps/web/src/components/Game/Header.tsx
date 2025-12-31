// src/components/Scoreboard.tsx
import React from "react";

interface ScoreboardProps {
  score: number;
}

const Scoreboard = ({ score }: ScoreboardProps) => {
  return <div className="bg-gray-800 p-4 text-white">Score: {score}</div>;
};

export default Scoreboard;
