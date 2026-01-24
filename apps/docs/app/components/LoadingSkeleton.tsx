/**
 * Loading skeleton component for better UX during markdown file loading
 */

export function LoadingSkeleton() {
	return (
		<div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
			{/* Title skeleton */}
			<div
				style={{
					height: "2.5rem",
					width: "60%",
					background: "#e0e0e0",
					borderRadius: "4px",
					marginBottom: "1.5rem",
					animation: "pulse 1.5s ease-in-out infinite",
				}}
			/>

			{/* Paragraph skeletons */}
			{[1, 2, 3].map((i) => (
				<div key={i} style={{ marginBottom: "1rem" }}>
					<div
						style={{
							height: "1rem",
							width: "100%",
							background: "#e0e0e0",
							borderRadius: "4px",
							marginBottom: "0.5rem",
							animation: "pulse 1.5s ease-in-out infinite",
							animationDelay: `${i * 0.1}s`,
						}}
					/>
					<div
						style={{
							height: "1rem",
							width: "85%",
							background: "#e0e0e0",
							borderRadius: "4px",
							animation: "pulse 1.5s ease-in-out infinite",
							animationDelay: `${i * 0.1 + 0.05}s`,
						}}
					/>
				</div>
			))}

			{/* Code block skeleton */}
			<div
				style={{
					height: "8rem",
					width: "100%",
					background: "#f0f0f0",
					borderRadius: "4px",
					marginTop: "1.5rem",
					border: "1px solid #e0e0e0",
					animation: "pulse 1.5s ease-in-out infinite",
				}}
			/>

			<style>
				{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.6;
            }
          }
        `}
			</style>
		</div>
	);
}

/**
 * Compact loading indicator for inline use
 */
export function LoadingSpinner() {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "2rem",
			}}
		>
			<div
				style={{
					width: "40px",
					height: "40px",
					border: "4px solid #e0e0e0",
					borderTop: "4px solid #007bff",
					borderRadius: "50%",
					animation: "spin 1s linear infinite",
				}}
			/>
			<style>
				{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
			</style>
		</div>
	);
}
