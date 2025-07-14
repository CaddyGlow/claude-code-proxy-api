import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { server } from './test-utils/mocks/server';

// Setup DOM environment if not available
if (typeof document === 'undefined') {
	const { JSDOM } = await import('jsdom');
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
		url: 'http://localhost',
		pretendToBeVisual: true,
		resources: 'usable'
	});
	
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		navigator: dom.window.navigator,
		HTMLElement: dom.window.HTMLElement,
		Node: dom.window.Node
	});
}

beforeAll(() => {
	server.listen();
});

afterEach(() => {
	server.resetHandlers();
	vi.clearAllMocks();
	vi.clearAllTimers();
});

afterAll(() => {
	server.close();
});

// Mock EventSource for SSE testing
(globalThis as any).EventSource = vi.fn().mockImplementation(() => ({
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	dispatchEvent: vi.fn(),
	readyState: 1,
	CONNECTING: 0,
	OPEN: 1,
	CLOSED: 2,
	url: '',
	withCredentials: false,
	onopen: null,
	onmessage: null,
	onerror: null,
}));

// Mock IntersectionObserver
(globalThis as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Suppress console warnings in tests unless explicitly needed
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
	if (
		typeof args[0] === 'string' &&
		(args[0].includes('LayerChart') || args[0].includes('D3'))
	) {
		return;
	}
	originalConsoleWarn(...args);
};
