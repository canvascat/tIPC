import { webContents } from "electron";
import { Observable } from "rxjs";
import { channel } from "./const";
import { Procedure, TIPCMessage } from "./type";

/**
 * 将 AsyncIterable 转换为 RxJS Observable
 * @param asyncIterable - 要转换的 AsyncIterable
 * @returns RxJS Observable
 */
function asyncIterableToObservable<T>(asyncIterable: AsyncIterable<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    let iterator: AsyncIterator<T> | null = null;

    const processNext = async () => {
      try {
        if (!iterator) {
          iterator = asyncIterable[Symbol.asyncIterator]();
        }

        const result = await iterator.next();

        if (result.done) {
          subscriber.complete();
          return;
        }

        subscriber.next(result.value);
        // 继续处理下一个值
        processNext();
      } catch (error) {
        subscriber.error(error);
      }
    };

    processNext();

    // 清理函数
    return () => {
      if (iterator && typeof iterator.return === 'function') {
        iterator.return();
      }
    };
  });
}

/**
 * 检查值是否为 AsyncIterable
 */
function isAsyncIterable(value: any): value is AsyncIterable<any> {
  return value && typeof value[Symbol.asyncIterator] === 'function';
}

function toObservable<T>(value: AsyncIterable<T> | Observable<T>): Observable<T> {
  if (isAsyncIterable(value)) return asyncIterableToObservable<T>(value)

  return value as unknown as Observable<T>
}


export class SubscriptionManager {
  private cache = new Map<string, {
    ids: Set<string>
    unsubscribe: () => void
  }>()

  private id2webContent = new Map<string, number>()

  constructor(private procedure: Record<string, ReturnType<Procedure['subscription']>>) {

  }

  onUnsubscribe(_event: Electron.IpcMainEvent, message: TIPCMessage) {
    const item = this.cache.get(message.path)
    if (!item) return;
    item.ids.delete(message.args[0])
    this.id2webContent.delete(message.args[0])
    if (item.ids.size) return;
    item.unsubscribe()
    this.cache.delete(message.path)
  }

  onSubscription(event: Electron.IpcMainEvent, message: TIPCMessage) {
    const { path, args } = message
    const procedure = this.procedure[path]
    if (!procedure) return;
    let item = this.cache.get(message.path)
    const subscriptionId = args[0]
    this.id2webContent.set(subscriptionId, event.sender.id)
    if (!item) {
      const { unsubscribe } = toObservable(procedure()).subscribe((data) => {
        const subscriptionIds = this.cache.get(message.path)?.ids;
        if (!subscriptionIds?.size) return
        for (const subscriptionId of subscriptionIds) {
          const webContentId = this.id2webContent.get(subscriptionId)
          if (!webContentId) continue
          const webContent = webContents.fromId(webContentId)
          if (!webContent) continue
          webContent.send(channel.message, {
            type: 'subscription.message',
            subscriptionId,
            args: [data]
          })
        }
      })
      item = {
        ids: new Set(),
        unsubscribe
      }
      this.cache.set(message.path, item)
    }

    item.ids.add(subscriptionId)
  }
}
