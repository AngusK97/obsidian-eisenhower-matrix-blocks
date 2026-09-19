"use strict";

// Development-only host: serves the real renderer with an emulated Obsidian shell.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const fixtures = path.join(root, "tests/browser");
const port = Number(process.env.PORT || 4173);

async function bundle() {
	const result = await esbuild.build({
		entryPoints: [path.join(fixtures, "preview.js")],
		bundle: true,
		write: false,
		platform: "browser",
		format: "iife",
		target: "es2020",
		plugins: [{
			name: "preview-obsidian-shell",
			setup(build) {
				build.onResolve({ filter: /^obsidian$/ }, () => ({ path: path.join(fixtures, "obsidian-stub.js") }));
				build.onLoad({ filter: /[\\/]src[\\/]main\.js$/ }, async (args) => ({
					contents: (await fs.readFile(args.path, "utf8")).replace(
						/module\.exports = EisenhowerMatrixBlocksPlugin;\s*$/,
						"module.exports = { MatrixBoardRenderChild, EisenhowerMatrixBlocksPlugin };",
					),
					loader: "js",
				}));
			},
		}],
	});
	return result.outputFiles[0].text;
}

const files = new Map([
	["/", ["text/html; charset=utf-8", path.join(fixtures, "index.html")]],
	["/shell.css", ["text/css; charset=utf-8", path.join(fixtures, "shell.css")]],
	["/styles.css", ["text/css; charset=utf-8", path.join(root, "styles.css")]],
]);

http.createServer(async (request, response) => {
	try {
		const pathname = new URL(request.url, "http://localhost").pathname;
		response.setHeader("Cache-Control", "no-store");
		if (pathname === "/preview.js") {
			response.setHeader("Content-Type", "text/javascript; charset=utf-8");
			response.end(await bundle());
			return;
		}
		if (pathname === "/favicon.ico") { response.writeHead(204).end(); return; }
		const file = files.get(pathname);
		if (!file) { response.writeHead(404).end("Not found"); return; }
		response.setHeader("Content-Type", file[0]);
		response.end(await fs.readFile(file[1]));
	} catch (error) {
		console.error(error);
		response.writeHead(500).end("Preview build failed. See terminal.");
	}
}).listen(port, "127.0.0.1", () => {
	console.log(`Actual renderer preview: http://127.0.0.1:${port}/`);
	console.log("Use ?theme=dark&lang=zh or ?theme=light&lang=en. In-memory fixture only; no Vault writes.");
});
