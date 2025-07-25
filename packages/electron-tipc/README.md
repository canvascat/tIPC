# tipc-electron

[English](README.md) | [简体中文](README.zhCN.md)

A type-safe IPC communication library for Electron with tRPC-like API design.

## Features

- 🔒 **Fully Type-Safe** - End-to-end type inference powered by TypeScript
- 🚀 **Easy to Use** - Intuitive API design similar to tRPC
- 📡 **Multiple Communication Modes** - Support for request-response, event emission, and real-time subscriptions
- 🌊 **Reactive Programming** - Subscription mechanism based on RxJS Observable
- 🔄 **Automated** - Automatic management and cleanup of subscriptions
- 📦 **Lightweight** - Minimal dependencies and bundle size

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
// main.ts
import { createTIPCServer, procedure } from 'tipc-electron/main'
import { BehaviorSubject } from 'rxjs'

// Define data state
const counter$ = new BehaviorSubject(0)

// Define API procedures
const appRouter = {
  // Request-response mode: Get user information
  user: {
    getInfo: procedure.handle(async (userId: string) => {
      // Simulate async operation
      return { id: userId, name: 'John Doe', email: 'john@example.com' }
    }),
    
    // Get all users
    getAll: procedure.handle(async () => {
      return [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Smith' }
      ]
    })
  },

  // Event emission mode: Log messages
  logger: {
    info: procedure.on((message: string) => {
      console.log(`[INFO] ${message}`)
    }),
    
    error: procedure.on((error: string) => {
      console.error(`[ERROR] ${error}`)
    })
  },

  // Subscription mode: Real-time data stream
  counter: {
    // Subscribe to counter changes
    subscribe: procedure.subscription(() => counter$),
    
    // Increment counter
    increment: procedure.handle(() => {
      const current = counter$.value
      counter$.next(current + 1)
      return current + 1
    }),
    
    // Reset counter
    reset: procedure.on(() => {
      counter$.next(0)
    })
  }
}

// Create server
const dispose = createTIPCServer(appRouter)

// Cleanup on app quit
app.on('before-quit', () => {
  dispose()
})

export type AppRouter = typeof appRouter
```

### 2. Use Client in Renderer Process

```typescript
// renderer.ts
import { createTIPCClient } from 'tipc-electron/renderer'
import { ipcRenderer } from 'electron'
import type { AppRouter } from './main'

// Create type-safe client
const tipc = createTIPCClient<AppRouter>(ipcRenderer)

// Use API
async function main() {
  // 1. Request-response: calls return Promise
  const userInfo = await tipc.user.getInfo.invoke('123')
  console.log(userInfo) // { id: '123', name: 'John Doe', email: 'john@example.com' }
  
  const allUsers = await tipc.user.getAll.invoke()
  console.log(allUsers) // [{ id: '1', name: 'John Doe' }, ...]
  
  // 2. Event emission: one-way communication
  tipc.logger.info.emit('Application started')
  tipc.logger.error.emit('Something went wrong')
  
  // 3. Real-time subscription: listen to data changes
  const unsubscribe = tipc.counter.subscribe.subscribe((count) => {
    console.log(`Current count: ${count}`)
    document.getElementById('counter')!.textContent = count.toString()
  })
  
  // Manipulate counter
  await tipc.counter.increment.invoke() // Counter +1
  await tipc.counter.increment.invoke() // Counter +1
  tipc.counter.reset.emit() // Reset to 0
  
  // Unsubscribe
  setTimeout(() => {
    unsubscribe()
  }, 10000)
}

main()
```

## API Reference

### Procedure Types

#### `procedure.handle(fn)`
Creates a request-response type procedure that supports async operations.

```typescript
const getUserById = procedure.handle(async (id: string) => {
  const user = await database.findUser(id)
  return user
})
```

Call in renderer process:
```typescript
const user = await tipc.getUserById.invoke('123')
```

#### `procedure.on(fn)`
Creates an event listener procedure for one-way message sending.

```typescript
const logMessage = procedure.on((level: string, message: string) => {
  console.log(`[${level}] ${message}`)
})
```

Call in renderer process:
```typescript
tipc.logMessage.emit('INFO', 'Hello world')
```

#### `procedure.subscription(fn)`
Creates a subscription procedure that returns an RxJS Observable.

```typescript
import { interval } from 'rxjs'

const timer = procedure.subscription(() => {
  return interval(1000) // Emit every second
})
```

Subscribe in renderer process:
```typescript
const unsubscribe = tipc.timer.subscribe((tick) => {
  console.log(`Timer: ${tick}`)
})

// Unsubscribe
unsubscribe()
```

### Nested Routes

Supports arbitrarily deep nested route structures:

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

Using nested routes:
```typescript
await tipc.auth.user.login.invoke({ username, password })
await tipc.auth.user.profile.update.invoke({ name: 'New Name' })
tipc.auth.user.logout.emit()

const unsubscribe = tipc.data.realtime.subscribe((data) => {
  console.log(data)
})
```

## Best Practices

### 1. Type Sharing
Define router types in a separate file to share between main and renderer processes:

```typescript
// types/api.ts
export type AppRouter = typeof appRouter
```

### 2. Error Handling
Handle errors properly in procedures:

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

### 3. Subscription Cleanup
Ensure subscriptions are cleaned up when components are destroyed:

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

### 4. Performance Optimization
Use RxJS operators for high-frequency subscriptions:

```typescript
import { throttleTime, distinctUntilChanged } from 'rxjs'

const mousePosition = procedure.subscription(() => {
  return mouseMove$.pipe(
    throttleTime(16), // ~60fps
    distinctUntilChanged()
  )
})
```

## Important Notes

1. **Serialization Limitations**: Transmitted data must be serializable (JSON-safe)
2. **Memory Management**: Remember to unsubscribe from unused subscriptions to avoid memory leaks
3. **Error Handling**: Errors in the main process are automatically propagated to the renderer process
4. **Security**: Ensure Node.js integration is disabled in production environment

## License

MIT 