import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'

const t = initTRPC.context ().create()

const publicProcedure = t.procedure
const router = t.router

declare const createInput: <T>() => {
  create: (input: any) => T
}

const greetingRouter = router({
  hello: publicProcedure
    .input(createInput<{ name: string }>())
    .query(({ input }) => `Hello, ${input.name}!`),
})

const postRouter = router({
  createPost: publicProcedure
    .input(createInput<{ title: string, text: string }>(),

    )
    .mutation(({ input }) => {
      // imagine db call here
      return {
        id: `${Math.random()}`,
        ...input,
      }
    }),
  randomNumber: publicProcedure.subscription(() => {
    return observable<{ randomNumber: number }>((emit) => {
      const timer = setInterval(() => {
        // emits a number every second
        emit.next({ randomNumber: Math.random() })
      }, 200)

      return () => {
        clearInterval(timer)
      }
    })
  }),
})

// Merge routers together
export const appRouter = router({
  greeting: greetingRouter,
  post: postRouter,
})

export type AppRouter = typeof appRouter
