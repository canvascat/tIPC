import type { Observable } from "rxjs";

export function create<Context>() {
	type AnyFunction<R = any> = (this: Context, ...args: any[]) => R;

	function handle<T extends AnyFunction>(listener: T) {
		async function _listener(
			this: Context,
			...args: Parameters<T>
		): Promise<Awaited<ReturnType<T>>> {
			return listener.apply(this, args);
		}
		_listener.type = "invoke" as const;
		return _listener;
	}

	function value<T>(
		listener: (this: Context) => T extends Promise<any> ? never : T,
	) {
		function _listener(this: Context): T extends Promise<any> ? never : T {
			return listener.apply(this);
		}
		_listener.type = "get" as const;
		return _listener;
	}

	function on<T extends AnyFunction>(listener: T) {
		function _listener(this: Context, ...args: Parameters<T>): void {
			listener.apply(this, args);
		}
		_listener.type = "emit" as const;
		return _listener;
	}

	function subscription<V>(listener: AnyFunction<Observable<V>>) {
		function _listener(this: Context) {
			return listener.apply(this);
		}
		_listener.type = "subscribe" as const;
		return _listener;
	}

	return { handle, on, subscription, value };
}

type ObjectValue<T> = T[keyof T];

export type FunctionType = ReturnType<
	ObjectValue<ReturnType<typeof create>>
>["type"];
