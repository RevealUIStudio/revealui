/**
 * File storage mocks
 *
 * Provides mocks for file upload, retrieval, deletion, and listing operations
 */

export interface MockFile {
	id: string;
	filename: string;
	url: string;
	size: number;
	mimeType: string;
	createdAt: Date;
}

const mockFiles: Map<string, MockFile> = new Map();

/**
 * Mock file upload
 */
export async function mockFileUpload(file: {
	filename: string;
	buffer: Buffer;
	mimeType: string;
}): Promise<MockFile> {
	const id = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	const mockFile: MockFile = {
		id,
		filename: file.filename,
		url: `https://mock-storage.example.com/files/${id}`,
		size: file.buffer.length,
		mimeType: file.mimeType,
		createdAt: new Date(),
	};

	mockFiles.set(id, mockFile);
	return mockFile;
}

/**
 * Mock file retrieval
 */
export async function mockFileRetrieve(id: string): Promise<MockFile | null> {
	return mockFiles.get(id) || null;
}

/**
 * Mock file deletion
 */
export async function mockFileDelete(id: string): Promise<boolean> {
	return mockFiles.delete(id);
}

/**
 * Mock file listing
 */
export async function mockFileList(options?: {
	limit?: number;
	offset?: number;
}): Promise<MockFile[]> {
	const files = Array.from(mockFiles.values());
	const offset = options?.offset || 0;
	const limit = options?.limit || files.length;

	return files.slice(offset, offset + limit);
}

/**
 * Clear all mock files
 */
export function clearMockFiles(): void {
	mockFiles.clear();
}

/**
 * Create mock file storage client
 */
export function createMockFileStorage() {
	return {
		upload: mockFileUpload,
		retrieve: mockFileRetrieve,
		delete: mockFileDelete,
		list: mockFileList,
		clear: clearMockFiles,
	};
}
