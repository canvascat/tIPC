# tipc-electron

[English](README.md) | [简体中文](README.zhCN.md)

一个类型安全的 Electron IPC 通信库，提供类似 tRPC 的 API 设计。

## 功能特性

- 🔒 **完全类型安全** - 基于 TypeScript 的端到端类型推断
- 🚀 **简单易用** - 类似 tRPC 的直观 API 设计
- 📡 **多种通信模式** - 支持请求-响应、事件发送、实时订阅和值获取
- 🌊 **响应式编程** - 基于 RxJS Observable 的订阅机制
- 🔄 **自动化** - 支持订阅的自动管理和清理
- 📦 **轻量级** - 最小化的依赖和打包体积
- 🎯 **上下文支持** - 内置的程序执行上下文系统

## 安装

```bash
npm install tipc-electron
# 或
pnpm add tipc-electron
# 或
yarn add tipc-electron
```

## 基本用法

### 1. 在主进程中定义程序（Procedures）

```typescript
// main/trpc.ts
import { initTIPC } from "tipc-electron/main";

const t = initTIPC.create();
export const procedure = t.procedure;

// main/router/index.ts
import { procedure } from "../trpc";
import { BehaviorSubject } from "rxjs";

// 定义数据状态
const counter$ = new BehaviorSubject(0);

// 定义 API 程序
export const appRouter = {
	// 请求-响应模式：获取用户信息
	user: {
		getInfo: procedure.handle(async (userId: string) => {
			// 模拟异步操作
			return { id: userId, name: "John Doe", email: "john@example.com" };
		}),

		// 获取所有用户
		getAll: procedure.handle(async () => {
			return [
				{ id: "1", name: "John Doe" },
				{ id: "2", name: "Jane Smith" },
			];
		}),
	},

	// 事件发送模式：记录日志
	logger: {
		info: procedure.on((message: string) => {
			console.log(`[INFO] ${message}`);
		}),

		error: procedure.on((error: string) => {
			console.error(`[ERROR] ${error}`);
		}),
	},

	// 订阅模式：实时数据流
	counter: {
		// 订阅计数器变化
		subscribe: procedure.subscription(() => counter$),

		// 增加计数器
		increment: procedure.handle(() => {
			const current = counter$.value;
			counter$.next(current + 1);
			return current + 1;
		}),

		// 重置计数器
		reset: procedure.on(() => {
			counter$.next(0);
		}),
	},

	// 值获取模式：获取当前状态
	state: {
		getCounter: procedure.value(() => counter$.value),
		getTimestamp: procedure.value(() => Date.now()),
	},
};

// main/index.ts
import { createTIPCServer } from "tipc-electron/main";
import { appRouter } from "./router";

// 创建服务器
const dispose = createTIPCServer({ functions: appRouter });

// 应用关闭时清理
app.on("before-quit", () => {
	dispose();
});

export type AppRouter = typeof appRouter;
```

### 2. 在渲染进程中使用客户端

```typescript
// renderer/tipc.ts
import { createTIPCClient } from "tipc-electron/renderer";
import type * as functions from "@main/router";

const tipc = createTIPCClient<typeof functions>(window.ipcRenderer);

export default tipc;

// 使用示例
import tipc from "./tipc";

async function main() {
	// 1. 请求-响应：调用返回 Promise
	const userInfo = await tipc.user.getInfo.invoke("123");
	console.log(userInfo); // { id: '123', name: 'John Doe', email: 'john@example.com' }

	const allUsers = await tipc.user.getAll.invoke();
	console.log(allUsers); // [{ id: '1', name: 'John Doe' }, ...]

	// 2. 事件发送：单向通信
	tipc.logger.info.emit("Application started");
	tipc.logger.error.emit("Something went wrong");

	// 3. 实时订阅：监听数据变化
	const unsubscribe = tipc.counter.subscribe.subscribe((count) => {
		console.log(`Current count: ${count}`);
		document.getElementById("counter")!.textContent = count.toString();
	});

	// 4. 值获取：获取当前状态
	const currentCount = await tipc.state.getCounter.get();
	console.log(`Current count: ${currentCount}`);

	const timestamp = await tipc.state.getTimestamp.get();
	console.log(`Current timestamp: ${timestamp}`);

	// 操作计数器
	await tipc.counter.increment.invoke(); // 计数器 +1
	await tipc.counter.increment.invoke(); // 计数器 +1
	tipc.counter.reset.emit(); // 重置为 0

	// 取消订阅
	setTimeout(() => {
		unsubscribe();
	}, 10000);
}

main();
```

## 高级用法

### 自定义上下文

您可以创建自定义上下文来向程序传递额外的数据：

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
		// 访问上下文信息
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
		user: { id: "current-user", role: "admin" }, // 添加自定义上下文
	}),
});
```

### 窗口管理示例

这是一个管理 Electron 窗口的实用示例：

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

	// 同步获取当前窗口状态
	getState: procedure.value(function () {
		const window = BrowserWindow.fromId(this.senderId);
		return {
			isMaximized: window?.isMaximized() ?? false,
			isMinimized: window?.isMinimized() ?? false,
			isVisible: window?.isVisible() ?? false,
		};
	}),

	// 实时窗口状态订阅
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

## API 参考

### 初始化

#### `initTIPC`

更好的 TypeScript 支持初始化模式：

```typescript
import { initTIPC } from "tipc-electron/main";

// 基本用法
const t = initTIPC.create();
const { procedure } = t;

// 使用自定义上下文
const t = initTIPC.context<MyContext>().create();
const { procedure } = t;
```

### 程序类型

#### `procedure.handle(fn)`

创建一个支持异步操作的请求-响应类型程序。

```typescript
const getUserById = procedure.handle(async (id: string) => {
	const user = await database.findUser(id);
	return user;
});
```

在渲染进程中调用：

```typescript
const user = await tipc.getUserById.invoke("123");
```

#### `procedure.on(fn)`

创建一个用于单向消息发送的事件监听器程序。

```typescript
const logMessage = procedure.on((level: string, message: string) => {
	console.log(`[${level}] ${message}`);
});
```

在渲染进程中调用：

```typescript
tipc.logMessage.emit("INFO", "Hello world");
```

#### `procedure.subscription(fn)`

创建一个返回 RxJS Observable 的订阅程序。

```typescript
import { interval } from "rxjs";

const timer = procedure.subscription(() => {
	return interval(1000); // 每秒发送一次
});

const watchUser = procedure.subscription((userId: string) => {
	return userEvents$(userId);
});
```

在渲染进程中订阅：

```typescript
const unsubscribe = tipc.timer.subscribe((tick) => {
	console.log(`Timer: ${tick}`);
});

const unsubscribeUser = tipc.watchUser.subscribe(
	"user-1",
	(event) => {
		console.log(event);
	},
	{
		onError(error) {
			console.error("订阅失败", error);
		},
		onComplete() {
			console.log("订阅已完成");
		},
	},
);

// 取消订阅
unsubscribe();
unsubscribeUser();
```

#### `procedure.value(fn)`

创建一个用于轻量值读取的值获取程序。

```typescript
const getCurrentUser = procedure.value(() => {
	return currentUser; // 必须返回非 Promise 值
});
```

在渲染进程中获取值：

```typescript
const user = await tipc.getCurrentUser.get();
```

**注意**：函数必须返回非 Promise 值。对于异步操作，请使用 `procedure.handle`。

### 服务器配置

#### `createTIPCServer(options)`

创建一个 TIPC 服务器，支持以下选项：

```typescript
interface Options<Context> {
	functions: Functions<Context>;
	createContext?: (options: CreateContextOptions) => Context;
}
```

- `functions`：包含所有程序的路由器对象
- `createContext`：可选函数，用于创建自定义上下文

### 客户端创建

#### `createTIPCClient<RemoteFunctions>(ipcRenderer)`

创建一个类型安全的客户端：

```typescript
import { createTIPCClient } from "tipc-electron/renderer";
import type * as functions from "@main/router";

const tipc = createTIPCClient<typeof functions>(window.ipcRenderer);
```

### 嵌套路由

支持任意深度的嵌套路由结构：

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

使用嵌套路由：

```typescript
await tipc.auth.user.login.invoke({ username, password });
await tipc.auth.user.profile.update.invoke({ name: "New Name" });
tipc.auth.user.logout.emit();

const unsubscribe = tipc.data.realtime.subscribe((data) => {
	console.log(data);
});

const currentData = await tipc.data.current.get();
```

## 类型系统

### 函数类型推断

库会自动根据使用的程序推断正确的函数类型：

```typescript
// 这些类型会自动推断
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
			subscribe: (
				listener: (data: any) => void,
				options?: {
					onError?: (error: Error) => void;
					onComplete?: () => void;
				},
			) => () => void;
		};
		state: {
			get: () => Promise<{ isLoggedIn: boolean; lastLogin: Date }>;
		};
	};
};
```

### 上下文类型

自定义上下文类型完全类型化：

```typescript
interface AppContext {
	senderId: number;
	user?: { id: string; role: string };
	timestamp: number;
}

const t = initTIPC.context<AppContext>().create();
const { procedure } = t;

// 在所有程序中上下文都正确类型化
const getUser = procedure.handle(function (id: string) {
	console.log(this.senderId); // number
	console.log(this.user?.role); // string | undefined
	console.log(this.timestamp); // number
});
```

## 最佳实践

### 1. 类型共享

在单独的文件中定义路由器类型，以便在主进程和渲染进程之间共享：

```typescript
// main/router/index.ts
export type AppRouter = typeof appRouter;
```

### 2. 错误处理

在程序中正确处理错误：

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

### 3. 订阅清理

确保在组件销毁时清理订阅：

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

### 4. 性能优化

对高频订阅使用 RxJS 操作符：

```typescript
import { throttleTime, distinctUntilChanged } from "rxjs";

const mousePosition = procedure.subscription(() => {
	return mouseMove$.pipe(
		throttleTime(16), // ~60fps
		distinctUntilChanged(),
	);
});
```

### 5. 上下文使用

利用上下文系统更好地组织程序：

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

为您的用例选择正确的程序类型：

```typescript
// 对同步、非异步操作使用 procedure.value
const getConfig = procedure.value(() => appConfig);

// 对异步操作使用 procedure.handle
const fetchData = procedure.handle(async () => {
	const data = await api.fetchData();
	return data;
});

// 对单向通信使用 procedure.on
const logEvent = procedure.on((event: string) => {
	console.log(event);
});

// 对实时数据使用 procedure.subscription
const dataStream = procedure.subscription(() => dataSubject$);
```

## 重要注意事项

1. **序列化限制**：传输的数据必须是可序列化的（JSON 安全）
2. **内存管理**：记住取消未使用的订阅以避免内存泄漏
3. **错误处理**：主进程中的错误会自动传播到渲染进程
4. **安全性**：确保在生产环境中禁用 Node.js 集成
5. **上下文访问**：在程序中使用 `this` 关键字访问上下文
6. **窗口管理**：使用 `BrowserWindow.fromId(this.senderId)` 访问调用窗口
7. **值程序**：`procedure.value` 函数必须返回非 Promise 值并同步执行
8. **类型安全**：所有程序类型都会自动推断，确保最大类型安全性

## 许可证

MIT
