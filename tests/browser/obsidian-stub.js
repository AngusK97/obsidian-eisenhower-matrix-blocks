"use strict";

// Only the host APIs are emulated. Task rendering, events, styling and storage
// serialization are imported unchanged from production source.
function createElement(tag, options = {}) {
	const element = document.createElement(tag);
	if (options.cls) element.className = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
	if (options.text !== undefined) element.textContent = options.text;
	if (options.value !== undefined) element.value = options.value;
	for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, value);
	this.appendChild(element);
	return element;
}

for (const [name, method] of Object.entries({
	createEl: createElement,
	createDiv(options) { return createElement.call(this, "div", typeof options === "string" ? { cls: options } : options); },
	createSpan(options) { return createElement.call(this, "span", typeof options === "string" ? { cls: options } : options); },
	empty() { this.replaceChildren(); },
	addClass(...names) { this.classList.add(...names); },
	removeClass(...names) { this.classList.remove(...names); },
	hasClass(name) { return this.classList.contains(name); },
	toggleClass(name, force) { this.classList.toggle(name, force); },
	setText(text) { this.textContent = text; },
	setAttr(name, value) { this.setAttribute(name, value); },
})) Object.defineProperty(Element.prototype, name, { value: method, configurable: true });

class Component {
	constructor() { this.cleanups = []; }
	register(callback) { this.cleanups.push(callback); }
	registerDomEvent(element, event, callback, options) {
		element.addEventListener(event, callback, options);
		this.register(() => element.removeEventListener(event, callback, options));
	}
	registerInterval(id) { this.register(() => window.clearInterval(id)); }
	unload() { this.onunload?.(); this.cleanups.splice(0).forEach((callback) => callback()); }
}
class MarkdownRenderChild extends Component {
	constructor(containerEl) { super(); this.containerEl = containerEl; }
}
class Modal extends Component {
	constructor(app) {
		super();
		this.app = app;
		this.containerEl = document.createElement("div");
		this.containerEl.className = "modal-container";
		this.modalEl = this.containerEl.createDiv({ cls: "modal", attr: { role: "dialog", "aria-modal": "true" } });
		this.titleEl = this.modalEl.createEl("h2", { cls: "modal-title" });
		this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
		this.containerEl.addEventListener("click", (event) => { if (event.target === this.containerEl) this.close(); });
		this.onKey = (event) => {
			if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); this.close(); }
		};
	}
	setTitle(title) { this.titleEl.textContent = title; this.modalEl.setAttribute("aria-label", title); }
	open() {
		this.previousFocus = document.activeElement;
		document.body.append(this.containerEl);
		document.addEventListener("keydown", this.onKey);
		this.onOpen?.();
	}
	close() {
		document.removeEventListener("keydown", this.onKey);
		this.onClose?.();
		this.containerEl.remove();
		this.previousFocus?.focus();
	}
}

class Menu {
	constructor() { this.items = []; }
	addItem(callback) {
		const item = { title: "", disabled: false };
		const builder = {
			setTitle(value) { item.title = value; return builder; },
			setIcon() { return builder; },
			setWarning() { return builder; },
			setDisabled(value) { item.disabled = value; return builder; },
			onClick(value) { item.click = value; return builder; },
		};
		callback(builder); this.items.push(item); return this;
	}
	addSeparator() { this.items.push(null); return this; }
	showAtMouseEvent(event) {
		const menu = document.body.createDiv({ cls: "preview-menu", attr: { role: "menu" } });
		menu.style.left = `${Math.min(event.clientX, window.innerWidth - 230)}px`;
		menu.style.top = `${Math.min(event.clientY, window.innerHeight - 280)}px`;
		for (const item of this.items) {
			if (!item) { menu.createEl("hr"); continue; }
			const button = menu.createEl("button", { text: item.title, attr: { role: "menuitem" } });
			button.disabled = item.disabled;
			button.addEventListener("click", () => { menu.remove(); item.click?.(); });
		}
		setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
	}
}

const iconPaths = {
	plus: "M12 5v14M5 12h14", "chevron-up": "m6 15 6-6 6 6", "chevron-down": "m6 9 6 6 6-6",
	"chevron-left": "m15 6-6 6 6 6", "chevron-right": "m9 6 6 6-6 6",
	"grip-vertical": "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
	"more-horizontal": "M5 12h.01M12 12h.01M19 12h.01",
	pencil: "m16 3 5 5-12 12H4v-5ZM13 6l5 5", "trash-2": "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
	calendar: "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16", "calendar-clock": "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M12 13v4h3",
	"calendar-days": "M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01",
	"alarm-clock": "M7 3 3 7M17 3l4 4M7 20l-2 2M17 20l2 2M12 8v5l3 2M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
	zap: "m13 2-9 12h7l-1 8 10-12h-7Z", archive: "M3 3h18v5H3ZM5 8v13h14V8M10 12h4",
	users: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-4",
	"list-collapse": "M8 6h13M8 12h13M8 18h13M2 6l2-2 2 2M2 18l2 2 2-2",
	"list": "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", x: "m6 6 12 12M18 6 6 18",
	"maximize-2": "M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7",
	"minimize-2": "M4 4l6 6M10 4v6H4M20 20l-6-6M14 20v-6h6",
	"check-circle-2": "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M7 12l3 3 7-7",
	"chevrons-up-down": "m7 8 5-5 5 5m-10 8 5 5 5-5",
	"chevrons-down-up": "m7 3 5 5 5-5m-10 18 5-5 5 5",
};
function setIcon(element, name) {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	for (const [key, value] of Object.entries({ width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, value);
	svg.classList.add("svg-icon");
	const path = document.createElementNS(svg.namespaceURI, "path");
	path.setAttribute("d", iconPaths[name] || "M4 4h16v16H4ZM8 8h8M8 12h8M8 16h4");
	svg.append(path); element.replaceChildren(svg);
}
class Notice { constructor(message) { console.info("Notice:", message); } }
module.exports = {
	MarkdownRenderChild, Modal, Menu, Notice, setIcon,
	Plugin: class extends Component {}, PluginSettingTab: class extends Component {},
	MarkdownView: class {}, Setting: class {}, TFile: class {},
	normalizePath: (value) => value.replaceAll("\\", "/"),
	getLanguage: () => document.documentElement.lang,
};
