# tipc-electron

[English](README.md) | [简体中文](README.zhCN.md)

A type-safe IPC communication library for Electron with tRPC-like API design.

## Features

- 🔒 **Fully Type-Safe** - End-to-end type inference powered by TypeScript
- 🚀 **Easy to Use** - Intuitive API design similar to tRPC
- 📡 **Multiple Communication Modes** - Support for request-response, event emission, real-time subscriptions, and value retrieval
- 🌊 **Reactive Programming** - Subscription mechanism based on RxJS Observable
- 🔄 **Automated** - Automatic management and cleanup of subscriptions
- 📦 **Lightweight** - Minimal dependencies and bundle size
- 🎯 **Context Support** - Built-in context system for procedure execution

## Installation

```bash
npm install tipc-electron
# or
pnpm add tipc-electron
# or
yarn add tipc-electron
```

## Basic Usage

### 1. Define Procedures in Main Process

```typescript
// main/trpc.ts
import { initTIPC } from "tipc-electron/main";

const t = initTIPC.create();
export const procedure = t.procedure;

// main/router/index.ts
import { procedure } from "../trpc";
import { BehaviorSubject } from "rxjs";

// Define data state
const counter$ = new BehaviorSubject(0);

// Define API procedures
export const appRouter = {
	// Request-response mode: Get user information
	user: {
		getInfo: procedure.handle(async (userId: string) => {
			// Simulate async operation
			return { id: userId, name: "John Doe", email: "john@example.com" };
		}),

		// Get all users
		getAll: procedure.handle(async () => {
			return [
				{ id: "1", name: "John Doe" },
				{ id: "2", name: "Jane Smith" },
			];
		}),
	},

	// Event emission mode: Log messages
	logger: {
		info: procedure.on((message: string) => {
			console.log(`[INFO] ${message}`);
		}),

		error: procedure.on((error: string) => {
			console.error(`[ERROR] ${error}`);
		}),
	},

	// Subscription mode: Real-time data stream
	counter: {
		// Subscribe to counter changes
		subscribe: procedure.subscription(() => counter$),

		// Increment counter
		increment: procedure.handle(() => {
			const current = counter$.value;
			counter$.next(current + 1);
			return current + 1;
		}),

		// Reset counter
		reset: procedure.on(() => {
			counter$.next(0);
		}),
	},

	// Value retrieval mode: Get current state
	state: {
		getCounter: procedure.value(() => counter$.value),
		getTimestamp: procedure.value(() => Date.now()),
	},
};

// main/index.ts
import { createTIPCServer } from "tipc-electron/main";
import { appRouter } from "./router";

// Create server
const dispose = createTIPCServer({ functions: appRouter });

// Cleanup on app quit
app.on("before-quit", () => {
	dispose();
});

export type AppRouter = typeof appRouter;
```

### 2. Use Client in Renderer Process

```typescript
// renderer/tipc.ts
import { createTIPCClient } from "tipc-electron/renderer";
import type * as functions from "@main/router";

const tipc = createTIPCClient<typeof functions>(window.ipcRenderer);

export default tipc;

// Usage example
import tipc from "./tipc";

async function main() {
	// 1. Request-response: calls return Promise
	const userInfo = await tipc.user.getInfo.invoke("123");
	console.log(userInfo); // { id: '123', name: 'John Doe', email: 'john@example.com' }

	const allUsers = await tipc.user.getAll.invoke();
	console.log(allUsers); // [{ id: '1', name: 'John Doe' }, ...]

	// 2. Event emission: one-way communication
	tipc.logger.info.emit("Application started");
	tipc.logger.error.emit("Something went wrong");

	// 3. Real-time subscription: listen to data changes
	const unsubscribe = tipc.counter.subscribe.subscribe((count) => {
		console.log(`Current count: ${count}`);
		document.getElementById("counter")!.textContent = count.toString();
	});

	// 4. Value retrieval: get current state synchronously
	const currentCount = tipc.state.getCounter.get();
	console.log(`Current count: ${currentCount}`);

	const timestamp = tipc.state.getTimestamp.get();
	console.log(`Current timestamp: ${timestamp}`);

	// Manipulate counter
	await tipc.counter.increment.invoke(); // Counter +1
	await tipc.counter.increment.invoke(); // Counter +1
	tipc.counter.reset.emit(); // Reset to 0

	// Unsubscribe
	setTimeout(() => {
		unsubscribe();
	}, 10000);
}

main();
```

## Advanced Usage

### Custom Context

You can create custom contexts to pass additional data to your procedures:

```typescript
// types/context.ts
export interface AppContext {
	senderId: number;
	type: "invoke" | "emit" | "subscribe" | "get";
	path: string[];
	args: any[];
	user?: { id: string; role: string };
}

// main/trpc.ts
import { initTIPC } from "tipc-electron/main";
import type { AppContext } from "../types/context";

const t = initTIPC.context<AppContext>().create();
export const procedure = t.procedure;

// main/router/user.ts
export const user = {
	getProfile: procedure.handle(async function (userId: string) {
		// Access context information
		console.log(`Request from sender: ${this.senderId}`);
		console.log(`Current user: ${this.user?.id}`);

		return { id: userId, name: "John Doe" };
	}),
};

// main/index.ts
import { createTIPCServer } from "tipc-electron/main";
import { user } from "./router/user";

const dispose = createTIPCServer({
	functions: { user },
	createContext: (options) => ({
		...options,
		user: { id: "current-user", role: "admin" }, // Add custom context
	}),
});
```

### Window Management Example

Here's a practical example of managing Electron windows:

```typescript
// main/router/win.ts
import { BrowserWindow } from "electron";
import { fromEvent, merge } from "rxjs";
import { procedure } from "../trpc";

export const win = {
	maximize: procedure.on(function () {
		const senderId = this.senderId;
		BrowserWindow.fromId(senderId)?.maximize();
	}),

	unmaximize: procedure.on(function () {
		BrowserWindow.fromId(this.senderId)?.unmaximize();
	}),

	getBounds: procedure.handle(function () {
		const window = BrowserWindow.fromId(this.senderId);
		return window?.getBounds();
	}),

	// Get current window state synchronously
	getState: procedure.value(function () {
		const window = BrowserWindow.fromId(this.senderId);
		return {
			isMaximized: window?.isMaximized() ?? false,
			isMinimized: window?.isMinimized() ?? false,
			isVisible: window?.isVisible() ?? false,
		};
	}),

	// Real-time window state subscription
	event: {
		maximize: procedure.subscription(function () {
			const win = BrowserWindow.fromId(this.senderId);
			if (!win) throw new Error("Window not found");
			return merge(
				fromEvent(win, "maximize", () => true),
				fromEvent(win, "unmaximize", () => false),
			);
		}),
	},
};
```

## API Reference

### Initialization

#### `initTIPC`

Better TypeScript support initialization pattern:

```typescript
import { initTIPC } from "tipc-electron/main";

// Basic usage
const t = initTIPC.create();
const { procedure } = t;

// With custom context
const t = initTIPC.context<MyContext>().create();
const { procedure } = t;
```

### Procedure Types

#### `procedure.handle(fn)`

Creates a request-response type procedure that supports async operations.

```typescript
const getUserById = procedure.handle(async (id: string) => {
	const user = await database.findUser(id);
	return user;
});
```

Call in renderer process:

```typescript
const user = await tipc.getUserById.invoke("123");
```

#### `procedure.on(fn)`

Creates an event listener procedure for one-way message sending.

```typescript
const logMessage = procedure.on((level: string, message: string) => {
	console.log(`[${level}] ${message}`);
});
```

Call in renderer process:

```typescript
tipc.logMessage.emit("INFO", "Hello world");
```

#### `procedure.subscription(fn)`

Creates a subscription procedure that returns an RxJS Observable.

```typescript
import { interval } from "rxjs";

const timer = procedure.subscription(() => {
	return interval(1000); // Emit every second
});
```

Subscribe in renderer process:

```typescript
const unsubscribe = tipc.timer.subscribe((tick) => {
	console.log(`Timer: ${tick}`);
});

// Unsubscribe
unsubscribe();
```

#### `procedure.value(fn)`

Creates a value retrieval procedure that returns data synchronously.

```typescript
const getCurrentUser = procedure.value(() => {
	return currentUser; // Must return non-Promise value
});
```

Get value in renderer process:

```typescript
const user = tipc.getCurrentUser.get(); // Synchronous call
```

**Note**: The function must return a non-Promise value. For async operations, use `procedure.handle` instead.

### Server Configuration

#### `createTIPCServer(options)`

Creates a TIPC server with the following options:

```typescript
interface Options<Context> {
	functions: Functions<Context>;
	createContext?: (options: CreateContextOptions) => Context;
}
```

- `functions`: Your router object containing all procedures
- `createContext`: Optional function to create custom context

### Client Creation

#### `createTIPCClient<RemoteFunctions>(ipcRenderer)`

Creates a type-safe client:

```typescript
import { createTIPCClient } from "tipc-electron/renderer";
import type * as functions from "@main/router";

const tipc = createTIPCClient<typeof functions>(window.ipcRenderer);
```

### Nested Routes

Supports arbitrarily deep nested route structures:

```typescript
const appRouter = {
	auth: {
		user: {
			login: procedure.handle(async (credentials) => {
				/* ... */
			}),
			logout: procedure.on(() => {
				/* ... */
			}),
			profile: {
				get: procedure.handle(async () => {
					/* ... */
				}),
				update: procedure.handle(async (data) => {
					/* ... */
				}),
			},
		},
		admin: {
			getUsers: procedure.handle(async () => {
				/* ... */
			}),
			deleteUser: procedure.handle(async (id) => {
				/* ... */
			}),
		},
	},
	data: {
		realtime: procedure.subscription(() => {
			/* ... */
		}),
		current: procedure.value(() => {
			/* ... */
		}),
	},
};
```

Using nested routes:

```typescript
await tipc.auth.user.login.invoke({ username, password });
await tipc.auth.user.profile.update.invoke({ name: "New Name" });
tipc.auth.user.logout.emit();

const unsubscribe = tipc.data.realtime.subscribe((data) => {
	console.log(data);
});

const currentData = tipc.data.current.get();
```

## Type System

### Function Type Inference

The library automatically infers the correct function type based on the procedure used:

```typescript
// These types are automatically inferred
type UserFunctions = {
	user: {
		getInfo: {
			invoke: (
				userId: string,
			) => Promise<{ id: string; name: string; email: string }>;
		};
		logout: {
			emit: () => void;
		};
		subscribe: {
			subscribe: (listener: (data: any) => void) => () => void;
		};
		state: {
			get: () => { isLoggedIn: boolean; lastLogin: Date };
		};
	};
};
```

### Context Types

Custom context types are fully typed:

```typescript
interface AppContext {
	senderId: number;
	user?: { id: string; role: string };
	timestamp: number;
}

const t = initTIPC.context<AppContext>().create();
const { procedure } = t;

// Context is properly typed in all procedures
const getUser = procedure.handle(function (id: string) {
	console.log(this.senderId); // number
	console.log(this.user?.role); // string | undefined
	console.log(this.timestamp); // number
});
```

## Best Practices

### 1. Type Sharing

Define router types in a separate file to share between main and renderer processes:

```typescript
// main/router/index.ts
export type AppRouter = typeof appRouter;
```

### 2. Error Handling

Handle errors properly in procedures:

```typescript
const getUser = procedure.handle(async (id: string) => {
	try {
		const user = await database.findUser(id);
		if (!user) {
			throw new Error("User not found");
		}
		return user;
	} catch (error) {
		throw new Error(`Failed to get user: ${error.message}`);
	}
});
```

### 3. Subscription Cleanup

Ensure subscriptions are cleaned up when components are destroyed:

```typescript
useEffect(() => {
	const unsubscribe = tipc.data.subscribe.subscribe((data) => {
		setData(data);
	});

	return () => {
		unsubscribe();
	};
}, []);
```

### 4. Performance Optimization

Use RxJS operators for high-frequency subscriptions:

```typescript
import { throttleTime, distinctUntilChanged } from "rxjs";

const mousePosition = procedure.subscription(() => {
	return mouseMove$.pipe(
		throttleTime(16), // ~60fps
		distinctUntilChanged(),
	);
});
```

### 5. Context Usage

Leverage the context system for better procedure organization:

```typescript
const appRouter = {
	window: {
		close: procedure.on(function () {
			const window = BrowserWindow.fromId(this.senderId);
			window?.close();
		}),

		getInfo: procedure.handle(function () {
			const window = BrowserWindow.fromId(this.senderId);
			return {
				id: this.senderId,
				bounds: window?.getBounds(),
				isMaximized: window?.isMaximized(),
			};
		}),

		getState: procedure.value(function () {
			const window = BrowserWindow.fromId(this.senderId);
			return {
				isMaximized: window?.isMaximized() ?? false,
				isMinimized: window?.isMinimized() ?? false,
			};
		}),
	},
};
```

### 6. Value vs Handle

Choose the right procedure type for your use case:

```typescript
// Use procedure.value for synchronous, non-async operations
const getConfig = procedure.value(() => appConfig);

// Use procedure.handle for async operations
const fetchData = procedure.handle(async () => {
	const data = await api.fetchData();
	return data;
});

// Use procedure.on for one-way communication
const logEvent = procedure.on((event: string) => {
	console.log(event);
});

// Use procedure.subscription for real-time data
const dataStream = procedure.subscription(() => dataSubject$);
```

## Important Notes

1. **Serialization Limitations**: Transmitted data must be serializable (JSON-safe)
2. **Memory Management**: Remember to unsubscribe from unused subscriptions to avoid memory leaks
3. **Error Handling**: Errors in the main process are automatically propagated to the renderer process
4. **Security**: Ensure Node.js integration is disabled in production environment
5. **Context Access**: Use `this` keyword to access context within procedures
6. **Window Management**: Use `BrowserWindow.fromId(this.senderId)` to access the calling window
7. **Value Procedures**: `procedure.value` functions must return non-Promise values and are executed synchronously
8. **Type Safety**: All procedure types are automatically inferred for maximum type safety

## License

MIT
