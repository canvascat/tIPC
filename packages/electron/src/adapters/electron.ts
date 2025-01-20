// @trpc/server
import type { AnyRouter } from '@trpc/server'
import type { BaseHandlerOptions } from '@trpc/server/unstable-core-do-not-import'
import type { IpcMain } from 'electron'
import { run } from '@trpc/server/unstable-core-do-not-import'
// import type {  NodeHTTPCreateContextFnOptions,} from './node-http'
// import { ipcMain, IpcMainInvokeEvent, ipcRenderer } from 'electron'
// import { createURL, internal_exceptionHandler } from './node-http'

type ConnectMiddleware<
  TRequest extends Record<string, unknown>,
> = (req: TRequest, next: (err?: any) => any) => void

export type CreateHTTPHandlerOptions<TRouter extends AnyRouter, TRequest extends Record<string, unknown> = Record<string, any>> =
  BaseHandlerOptions<TRouter, TRequest> & {
    middleware?: ConnectMiddleware<TRequest>
  }

export type NodeHTTPRequestHandlerOptions<
  TRouter extends AnyRouter,
  TRequest extends Record<string, unknown>,
> = {
  req: TRequest
  path: string
} & CreateHTTPHandlerOptions<TRouter>

// export type CreateHTTPContextOptions = NodeHTTPCreateContextFnOptions<
//   http.IncomingMessage,
//   http.ServerResponse
// >

export async function nodeHTTPRequestHandler<
  TRouter extends AnyRouter,
  TRequest extends Record<string, unknown>,
>(opts: NodeHTTPRequestHandlerOptions<TRouter, TRequest>) {
  return new Promise<void>((resolve) => {
    const handleViaMiddleware
      = opts.middleware ?? ((_req, next) => next())

    return handleViaMiddleware(opts.req, (err: unknown) => {
      run(async () => {
        const request = incomingMessageToRequest(opts.req)
        // opts.router.

        // Build tRPC dependencies
        const createContext: ResolveHTTPRequestOptionsContextFn<
          TRouter
        > = async (innerOpts) => {
          return await opts.createContext?.({
            ...opts,
            ...innerOpts,
          })
        }

        // opts.router._def._config.$types

        const response = await resolveResponse({
          ...opts,
          req: request,
          error: err ? getTRPCErrorFromUnknown(err) : null,
          createContext,
          onError(o) {
            opts?.onError?.({
              ...o,
              req: opts.req,
            })
          },
        })

        await writeResponse({
          request,
          response,
          rawResponse: opts.res,
        })
      }).catch(internal_exceptionHandler(opts))
    })
  })
}

/**
 * @internal
 */
export function createIPCHandler<TRouter extends AnyRouter>(
  opts: CreateHTTPHandlerOptions<TRouter>,
): Parameters<IpcMain['handle']>[1] {
  return (_event, req) => {
    let path = ''
    run(async () => {
      const url = createURL(req)

      // get procedure path and remove the leading slash
      // /procedure -> procedure
      path = url.pathname.slice(1)
      await nodeHTTPRequestHandler({
        ...(opts as any),
        req,
        path,
      })
    }).catch(
      internal_exceptionHandler({
        req,

        path,
        ...opts,
      }),
    )
  }
}

// ipcMain.handle('trpc',  createIPCHandler({ }))
