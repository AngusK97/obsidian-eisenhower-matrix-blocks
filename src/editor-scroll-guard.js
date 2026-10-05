"use strict";

const GUARD_MS = 750;
const MAX_CORRECTIONS = 4;
const TOLERANCE = 1;

/** Short-lived compensation for host editor scrolling, without focus or private CM access. */
function createEditorScrollGuards() {
	const active = new Map();
	let disposed = false;
	const supportsEvents = target => typeof target?.addEventListener === "function" && typeof target?.removeEventListener === "function";

	return {
		arm(view, expectedAfter) {
			active.get(view)?.();
			const noop = () => {};
			if (disposed || typeof expectedAfter !== "string") return noop;
			const root = view?.containerEl, editor = view?.editor;
			const document = root?.ownerDocument, window = document?.defaultView;
			if (![root, document, window].every(supportsEvents) || !window.requestAnimationFrame || !window.cancelAnimationFrame ||
				typeof editor?.getScrollInfo !== "function" || typeof editor?.scrollTo !== "function" ||
				typeof editor?.getValue !== "function" || typeof view?.getMode !== "function") return noop;
			const visible = () => {
				if (!root.isConnected || document.hidden || window.closed) return false;
				const rect = root.getBoundingClientRect?.();
				if (rect && (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight)) return false;
				return window.getComputedStyle?.(root).visibility !== "hidden";
			};
			let position, path, mode;
			try {
				path = view.file?.path; mode = view.getMode();
				if (!path || mode !== "source" || !visible()) return noop;
				const current = editor.getScrollInfo();
				if (!Number.isFinite(current.top) || !Number.isFinite(current.left)) return noop;
				position = { top: current.top, left: current.left };
			} catch { return noop; }
			const deadline = Date.now() + GUARD_MS;
			const listeners = [];
			let frame = null, timer = null, stopped = false, corrections = 0;
			const cancel = () => {
				if (stopped) return;
				stopped = true;
				if (frame !== null) window.cancelAnimationFrame(frame);
				clearTimeout(timer);
				for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, true);
				if (active.get(view) === cancel) active.delete(view);
			};
			const valid = checkContent => !stopped && Date.now() < deadline && visible() && view.containerEl === root &&
				view.editor === editor && view.file?.path === path && view.getMode() === mode &&
				(!checkContent || editor.getValue() === expectedAfter);
			const drifted = () => {
				const current = editor.getScrollInfo();
				return Number.isFinite(current.top) && Number.isFinite(current.left) &&
					(Math.abs(current.top - position.top) > TOLERANCE || Math.abs(current.left - position.left) > TOLERANCE);
			};
			const schedule = () => {
				if (stopped || frame !== null) return;
				frame = window.requestAnimationFrame(() => {
					frame = null;
					try {
						if (!valid(true)) { cancel(); return; }
						if (!drifted()) return;
						corrections++;
						editor.scrollTo(position.left, position.top);
						if (corrections >= MAX_CORRECTIONS) cancel();
					} catch { cancel(); }
				});
			};
			const onScroll = () => {
				try {
					if (stopped || Date.now() >= deadline) { cancel(); return; }
					// Nested task-list scrolling does not change the editor's own scroll position.
					if (!drifted()) return;
					if (!valid(false)) { cancel(); return; }
					schedule();
				} catch { cancel(); }
			};
			const listen = (target, type, handler) => {
				if (!supportsEvents(target)) return;
				target.addEventListener(type, handler, { capture: true, passive: true });
				listeners.push([target, type, handler]);
			};
			active.set(view, cancel);
			listen(root, "scroll", onScroll);
			for (const target of [document, window]) {
				for (const type of ["pointerdown", "touchstart", "wheel", "keydown", "beforeinput", "compositionstart"]) listen(target, type, cancel);
			}
			listen(document, "visibilitychange", () => { if (document.hidden) cancel(); });
			// Captured control blur (for example a removed checkbox) is not window deactivation.
			listen(window, "blur", event => { if (event.target === window) cancel(); });
			for (const type of ["pagehide", "resize"]) listen(window, type, cancel);
			listen(window.visualViewport, "resize", cancel);
			timer = setTimeout(cancel, GUARD_MS); timer?.unref?.();
			schedule();
			return cancel;
		},
		dispose() {
			disposed = true;
			for (const cancel of active.values()) cancel();
		},
	};
}

module.exports = { createEditorScrollGuards };
