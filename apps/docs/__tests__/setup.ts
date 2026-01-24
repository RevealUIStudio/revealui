/**
 * Vitest setup file
 */

import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
	cleanup();
});
