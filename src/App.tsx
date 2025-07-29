import { useEffect, useState } from "react";
import "./App.css";
import tipc from "./tipc";

function App() {
	const [count, setCount] = useState(0);
	const [isMaximize, setIsMaximize] = useState(false);

	useEffect(() => {
		return tipc.win.event.maximize.subscribe((state) => {
			setIsMaximize(state);
		});
	}, []);

	return (
		<div className="App">
			<div className="logo-box">
				{isMaximize ? (
					<button onClick={() => tipc.win.unmaximize.emit()}>unmaximize</button>
				) : (
					<button onClick={() => tipc.win.maximize.emit()}>maximize</button>
				)}
			</div>
			<h1>Electron + Vite + React</h1>
			<div className="card">
				<button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">Click on the Electron + Vite logo to learn more</p>
		</div>
	);
}

export default App;
