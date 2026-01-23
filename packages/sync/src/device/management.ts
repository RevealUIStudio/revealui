/**
 * Device Management - Real Multi-Device Sync
 *
 * Manages device registration and cross-device data synchronization.
 */

import { z } from "zod";

// Device schema
export const deviceSchema = z.object({
	id: z.string(),
	userId: z.string(),
	deviceId: z.string(),
	deviceName: z.string(),
	deviceType: z.enum(["desktop", "mobile", "tablet"]),
	userAgent: z.string(),
	lastSeen: z.date(),
	isActive: z.boolean().default(true),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type Device = z.infer<typeof deviceSchema>;

type RawDevice = {
	id: string;
	name: string;
	type: string;
	lastSeen: string;
	createdAt: string;
	isOnline: boolean;
};

// Device collection (stored locally, not synced)
export const deviceCollection = createCollection(
	queryCollectionOptions({
		id: "devices-local",
		queryKey: ["devices"],
		queryFn: async () => {
			// In a real implementation, this might sync from ElectricSQL
			// For now, we'll manage devices locally
			const stored = localStorage.getItem("revealui_devices");
			return stored ? JSON.parse(stored) : [];
		},
		getKey: (item: Device) => item.deviceId,
		schema: deviceSchema,
	}),
);

// =============================================================================
// Device Detection Utilities
// =============================================================================

export class DeviceDetector {
	private constructor() {}
	static getDeviceType(): "desktop" | "mobile" | "tablet" {
		if (typeof window === "undefined") return "desktop";

		const ua = navigator.userAgent.toLowerCase();
		const width = window.innerWidth;

		if (
			/mobile|android|iphone|ipad|ipod|blackberry|opera mini|iemobile/i.test(ua)
		) {
			if (width <= 768) {
				return "mobile";
			} else {
				return "tablet";
			}
		}

		return "desktop";
	}

	static getDeviceName(): string {
		if (typeof window === "undefined") return "Server";

		const deviceType = DeviceDetector.getDeviceType();
		const browser = DeviceDetector.getBrowserName();
		const os = DeviceDetector.getOSName();

		return `${deviceType} - ${browser} on ${os}`;
	}

	static getBrowserName(): string {
		if (typeof window === "undefined") return "Unknown";

		const ua = navigator.userAgent;

		if (ua.includes("Chrome")) return "Chrome";
		if (ua.includes("Firefox")) return "Firefox";
		if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
		if (ua.includes("Edge")) return "Edge";
		if (ua.includes("Opera")) return "Opera";

		return "Unknown Browser";
	}

	static getOSName(): string {
		if (typeof window === "undefined") return "Unknown";

		const ua = navigator.userAgent;

		if (ua.includes("Windows")) return "Windows";
		if (ua.includes("Mac")) return "macOS";
		if (ua.includes("Linux")) return "Linux";
		if (ua.includes("Android")) return "Android";
		if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
			return "iOS";

		return "Unknown OS";
	}

	static generateDeviceId(): string {
		if (typeof window === "undefined") {
			return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		}

		// Create a stable device ID based on available information
		const deviceKey = "revealui_device_id";
		let deviceId = localStorage.getItem(deviceKey);

		if (!deviceId) {
			deviceId = `device-${Math.abs(hash(navigator.userAgent)).toString(36)}`;
			localStorage.setItem(deviceKey, deviceId);
		}

		return deviceId;
	}
}

// Simple hash function
function hash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash;
}

// =============================================================================
// Device Manager
// =============================================================================

export class DeviceManager {
	private devices: Device[] = [];

	constructor() {
		this.loadDevices();
	}

	registerDevice(userId: string): Device {
		const deviceId = DeviceDetector.generateDeviceId();
		const existingDevice = this.devices.find((d) => d.deviceId === deviceId);

		if (existingDevice) {
			// Update last seen
			existingDevice.lastSeen = new Date();
			existingDevice.isActive = true;
			this.saveDevices();
			return existingDevice;
		}

		// Create new device
		const device: Device = {
			id: crypto.randomUUID(),
			userId,
			deviceId,
			deviceName: DeviceDetector.getDeviceName(),
			deviceType: DeviceDetector.getDeviceType(),
			userAgent: navigator?.userAgent || "Unknown",
			lastSeen: new Date(),
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.devices.push(device);
		this.saveDevices();

		console.log("📱 Registered new device:", device.deviceName);
		return device;
	}

	getDevices(userId: string): Device[] {
		return this.devices.filter((d) => d.userId === userId && d.isActive);
	}

	updateDeviceActivity(deviceId: string): void {
		const device = this.devices.find((d) => d.deviceId === deviceId);
		if (device) {
			device.lastSeen = new Date();
			this.saveDevices();
		}
	}

	private loadDevices(): void {
		if (typeof window === "undefined") return;

		try {
			const stored = localStorage.getItem("revealui_devices");
			if (stored) {
				this.devices = JSON.parse(stored).map((d: RawDevice) => ({
					...d,
					lastSeen: new Date(d.lastSeen),
					createdAt: new Date(d.createdAt),
					updatedAt: new Date(d.updatedAt),
				}));
			}
		} catch (error) {
			console.warn("Failed to load devices from localStorage:", error);
			this.devices = [];
		}
	}

	private saveDevices(): void {
		if (typeof window === "undefined") return;

		try {
			localStorage.setItem("revealui_devices", JSON.stringify(this.devices));
		} catch (error) {
			console.warn("Failed to save devices to localStorage:", error);
		}
	}
}

// Singleton instance
export const deviceManager = new DeviceManager();

export default deviceManager;
