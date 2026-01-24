import type React from "react";
export { Page };

const Page = (): React.ReactElement => {
	return <h1>game</h1>;
};
// const Page = (): React.ReactElement => {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const [timer, setTimer] = useState(60);
//   // const [playerHealth, setPlayerHealth] = useState(100);
//   // const [enemyHealth, setEnemyHealth] = useState(100);
//   // const [playerScore, setPlayerScore] = useState(0);
//   // const [enemyScore, setEnemyScore] = useState(0);

//   useEffect(() => {
//     const handleKeyDown = (event: {
//       key: string;
//       preventDefault: () => void;
//     }) => {
//       // Key down logic

//       // Prevent default behavior of arrow keys
//       if (
//         ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
//       ) {
//         event.preventDefault();
//       }

//       // Prevent default behavior of spacebar
//       if (event.key === " ") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of enter key
//       if (event.key === "Enter") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of escape key
//       if (event.key === "Escape") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of tab key
//       if (event.key === "Tab") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of backspace key
//       if (event.key === "Backspace") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of delete key
//       if (event.key === "Delete") {
//         event.preventDefault();
//       }

//       // Prevent default behavior of shift key
//       if (event.key === "Shift") {
//         event.preventDefault();
//       }
//     };
//     const handleKeyUp = (event: { key: string }) => {
//       // Key up logic
//       const canvas = canvasRef.current;
//       if (event.key === "ArrowUp" && canvas !== null) {
//         // Move player up logic

//         const context = canvas.getContext("2d");
//         if (context !== null) {
//           context.clearRect(0, 0, canvas.width, canvas.height);
//           context.fillStyle = "#000000";
//           context.fillRect(0, 0, canvas.width, canvas.height);
//           context.fillStyle = "#ffffff";
//           context.fillRect(10, 10, 100, 100);
//         }
//       } else if (event.key === "ArrowDown") {
//         // Move player down logic
//         const canvas = canvasRef.current;
//         if (canvas !== null) {
//           const context = canvas.getContext("2d");
//           if (context !== null) {
//             context.clearRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#000000";
//             context.fillRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#ffffff";
//             context.fillRect(10, 10, 100, 100);
//           }
//         }
//       } else if (event.key === "ArrowLeft") {
//         // Move player left logic
//         const canvas = canvasRef.current;
//         if (canvas !== null) {
//           const context = canvas.getContext("2d");
//           if (context !== null) {
//             context.clearRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#000000";
//             context.fillRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#ffffff";
//             context.fillRect(10, 10, 100, 100);
//           }
//         }
//       } else if (event.key === "ArrowRight") {
//         // Move player right logic
//         const canvas = canvasRef.current;
//         if (canvas !== null) {
//           const context = canvas.getContext("2d");
//           if (context !== null) {
//             context.clearRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#000000";
//             context.fillRect(0, 0, canvas.width, canvas.height);
//             context.fillStyle = "#ffffff";
//             context.fillRect(10, 10, 100, 100);
//           }
//         }
//       }
//     };

//     window.addEventListener("keydown", handleKeyDown);
//     window.addEventListener("keyup", handleKeyUp);

//     return () => {
//       window.removeEventListener("keydown", handleKeyDown);
//       window.removeEventListener("keyup", handleKeyUp);
//     };
//   }, []);

//   useEffect(() => {
//     // Game initialization logic
//     const canvas = canvasRef.current;
//     const context = canvas?.getContext("2d");
//     if (canvas && context) {
//       canvas.width = 1024;
//       canvas.height = 576;
//       context.fillStyle = "#000000";
//       context.fillRect(0, 0, canvas.width, canvas.height);
//       context.fillStyle = "#ffffff";
//       context.fillRect(10, 10, 100, 100);
//     }

//     // Animation and game loop logic
//     const animate = () => {
//       // Animation logic
//       requestAnimationFrame(animate);
//     };

//     animate();

//     // Timer logic
//     const timerId = setInterval(() => {
//       if (timer > 0) {
//         setTimer((prevTimer) => prevTimer - 1);
//       } else {
//         clearInterval(timerId);
//         // Determine winner logic
//       }
//     }, 1000);

//     return () => clearInterval(timerId);
//   }, [timer]);

//   return <canvas ref={canvasRef}></canvas>;
// };
