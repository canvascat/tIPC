# tipc-electron

一个类型安全的 Electron IPC 通信库，提供类似 tRPC 的 API 设计。

## 功能特性

- 🔒 **完全类型安全** - 基于 TypeScript 的端到端类型推断
- 🚀 **简单易用** - 类似 tRPC 的直观 API 设计
- 📡 **多种通信模式** - 支持请求-响应、事件发送和实时订阅
- 🌊 **响应式编程** - 基于 RxJS Observable 的订阅机制
- 🔄 **自动重连** - 支持订阅的自动管理和清理
- 📦 **轻量级** - 最小化的依赖和打包体积

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
// main.ts
import { createTIPCServer, procedure } from 'tipc-electron/main'
import { BehaviorSubject } from 'rxjs'

// 定义数据状态
const counter$ = new BehaviorSubject(0)

// 定义 API 程序
const appRouter = {
  // 请求-响应模式：获取用户信息
  user: {
    getInfo: procedure.handle(async (userId: string) => {
      // 模拟异步操作
      return { id: userId, name: 'John Doe', email: 'john@example.com' }
    }),
    
    // 获取所有用户
    getAll: procedure.handle(async () => {
      return [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Smith' }
      ]
    })
  },

  // 事件发送模式：记录日志
  logger: {
    info: procedure.on((message: string) => {
      console.log(`[INFO] ${message}`)
    }),
    
    error: procedure.on((error: string) => {
      console.error(`[ERROR] ${error}`)
    })
  },

  // 订阅模式：实时数据流
  counter: {
    // 订阅计数器变化
    subscribe: procedure.subscription(() => counter$),
    
    // 增加计数器
    increment: procedure.handle(() => {
      const current = counter$.value
      counter$.next(current + 1)
      return current + 1
    }),
    
    // 重置计数器
    reset: procedure.on(() => {
      counter$.next(0)
    })
  }
}

// 创建服务器
const dispose = createTIPCServer(appRouter)

// 应用关闭时清理
app.on('before-quit', () => {
  dispose()
})

export type AppRouter = typeof appRouter
```

### 2. 在渲染进程中使用客户端

```typescript
// renderer.ts
import { createTIPCClient } from 'tipc-electron/renderer'
import { ipcRenderer } from 'electron'
import type { AppRouter } from './main'

// 创建类型安全的客户端
const tipc = createTIPCClient<AppRouter>(ipcRenderer)

// 使用 API
async function main() {
  // 1. 请求-响应：调用返回 Promise
  const userInfo = await tipc.user.getInfo.invoke('123')
  console.log(userInfo) // { id: '123', name: 'John Doe', email: 'john@example.com' }
  
  const allUsers = await tipc.user.getAll.invoke()
  console.log(allUsers) // [{ id: '1', name: 'John Doe' }, ...]
  
  // 2. 事件发送：单向通信
  tipc.logger.info.emit('Application started')
  tipc.logger.error.emit('Something went wrong')
  
  // 3. 实时订阅：监听数据变化
  const unsubscribe = tipc.counter.subscribe.subscribe((count) => {
    console.log(`当前计数: ${count}`)
    document.getElementById('counter')!.textContent = count.toString()
  })
  
  // 操作计数器
  await tipc.counter.increment.invoke() // 计数器 +1
  await tipc.counter.increment.invoke() // 计数器 +1
  tipc.counter.reset.emit() // 重置为 0
  
  // 取消订阅
  setTimeout(() => {
    unsubscribe()
  }, 10000)
}

main()
```

## API 参考

### 程序类型（Procedure Types）

#### `procedure.handle(fn)`
创建一个请求-响应类型的程序，支持异步操作。

```typescript
const getUserById = procedure.handle(async (id: string) => {
  const user = await database.findUser(id)
  return user
})
```

在渲染进程中调用：
```typescript
const user = await tipc.getUserById.invoke('123')
```

#### `procedure.on(fn)`
创建一个事件监听程序，用于单向消息发送。

```typescript
const logMessage = procedure.on((level: string, message: string) => {
  console.log(`[${level}] ${message}`)
})
```

在渲染进程中调用：
```typescript
tipc.logMessage.emit('INFO', 'Hello world')
```

#### `procedure.subscription(fn)`
创建一个订阅程序，返回 RxJS Observable。

```typescript
import { interval } from 'rxjs'

const timer = procedure.subscription(() => {
  return interval(1000) // 每秒发送一次
})
```

在渲染进程中订阅：
```typescript
const unsubscribe = tipc.timer.subscribe((tick) => {
  console.log(`Timer: ${tick}`)
})

// 取消订阅
unsubscribe()
```

### 嵌套路由

支持任意深度的嵌套路由结构：

```typescript
const appRouter = {
  auth: {
    user: {
      login: procedure.handle(async (credentials) => { /* ... */ }),
      logout: procedure.on(() => { /* ... */ }),
      profile: {
        get: procedure.handle(async () => { /* ... */ }),
        update: procedure.handle(async (data) => { /* ... */ })
      }
    },
    admin: {
      getUsers: procedure.handle(async () => { /* ... */ }),
      deleteUser: procedure.handle(async (id) => { /* ... */ })
    }
  },
  data: {
    realtime: procedure.subscription(() => { /* ... */ })
  }
}
```

使用嵌套路由：
```typescript
await tipc.auth.user.login.invoke({ username, password })
await tipc.auth.user.profile.update.invoke({ name: 'New Name' })
tipc.auth.user.logout.emit()

const unsubscribe = tipc.data.realtime.subscribe((data) => {
  console.log(data)
})
```

## 最佳实践

### 1. 类型共享
将路由类型定义在单独的文件中，在主进程和渲染进程之间共享：

```typescript
// types/api.ts
export type AppRouter = typeof appRouter
```

### 2. 错误处理
在程序中正确处理错误：

```typescript
const getUser = procedure.handle(async (id: string) => {
  try {
    const user = await database.findUser(id)
    if (!user) {
      throw new Error('User not found')
    }
    return user
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`)
  }
})
```

### 3. 订阅清理
确保在组件销毁时取消订阅：

```typescript
useEffect(() => {
  const unsubscribe = tipc.data.subscribe.subscribe((data) => {
    setData(data)
  })
  
  return () => {
    unsubscribe()
  }
}, [])
```

### 4. 性能优化
对于高频订阅，使用 RxJS 操作符进行优化：

```typescript
import { throttleTime, distinctUntilChanged } from 'rxjs'

const mousePosition = procedure.subscription(() => {
  return mouseMove$.pipe(
    throttleTime(16), // ~60fps
    distinctUntilChanged()
  )
})
```

## 与 tRPC 的区别

| 特性 | tipc-electron | tRPC |
|------|----------------|------|
| 运行环境 | Electron IPC | HTTP/WebSocket |
| 传输协议 | Electron IPC 通道 | HTTP/WebSocket |
| 实时订阅 | RxJS Observable | WebSocket/SSE |
| 类型安全 | ✅ | ✅ |
| 序列化 | 自动处理 | JSON |
| 双向通信 | ✅ | ✅ |

## 注意事项

1. **序列化限制**：传递的数据必须是可序列化的（JSON-safe）
2. **内存管理**：记得取消不再需要的订阅以避免内存泄漏
3. **错误处理**：主进程中的错误会自动传播到渲染进程
4. **安全性**：在生产环境中确保禁用 Node.js 集成

## 许可证

MIT 