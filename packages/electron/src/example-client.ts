import type { AppRouter } from './example-server'
import { createTRPCClient, loggerLink, splitLink } from '@trpc/client'
// import { ipcRenderer } from 'electron'
import { invokeLink } from './links/invokeLink'
import { subscriptionLink } from './links/subscriptionLink'

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink(),
    splitLink({
      condition: op => op.type === 'subscription',
      // true: subscriptionLink({ ipcRenderer }),
      // false: invokeLink({ ipcRenderer }),
      true: subscriptionLink({}),
      false: invokeLink({}),
    }),
  ],
})

trpcClient.greeting.hello.query({ name: 'John' })
  .then((res) => {
    console.log(res)
  })

export default trpcClient
