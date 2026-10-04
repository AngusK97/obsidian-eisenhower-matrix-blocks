"use strict";

const { captureBoardView } = require("./board-view-state");

const MAX_PENDING_MS = 10000;
const SETTLED_MS = 1500;

/** One-shot, pane-local continuity across code-block replacement, never persistent state. */
function createViewHandoff(plugin) {
	const entries = new Set();
	const workspace = plugin.app?.workspace;
	let disposed = false;
	const findView = root => {
		let found = null;
		workspace?.iterateAllLeaves?.(leaf => {
			const pane = leaf.view?.containerEl;
			if (pane?.ownerDocument === root.ownerDocument && pane.contains(root)) found = leaf.view;
		});
		return found;
	};
	const remove = entry => {
		if (!entries.delete(entry)) return;
		clearTimeout(entry.timer);
		if (entry.frame !== null) entry.document.defaultView?.cancelAnimationFrame?.(entry.frame);
		for (const [type, handler, capture] of entry.listeners) entry.pane.removeEventListener(type, handler, capture);
	};
	const expireAfter = (entry, delay) => {
		clearTimeout(entry.timer);
		entry.expiresAt = Date.now() + delay;
		entry.timer = setTimeout(() => remove(entry), delay);
		entry.timer?.unref?.();
	};
	const visibleDistance = (owner, view) => {
		const pane = view.containerEl.getBoundingClientRect();
		const top = Math.max(0, pane.top);
		const bottom = Math.min(view.containerEl.ownerDocument.defaultView?.innerHeight ?? pane.bottom, pane.bottom);
		const board = owner.containerEl.getBoundingClientRect();
		return bottom > top && board.bottom > top && board.top < bottom ? Math.max(0, board.top - top) : Infinity;
	};
	const remember = entry => {
		if (!entry.owner.containerEl.isConnected) return;
		entry.snapshot = captureBoardView(entry.owner.containerEl);
		if (!entry.outerAuthority || !Number.isFinite(visibleDistance(entry.owner, entry.view))) entry.snapshot.outer = [];
		entry.filters = { ...entry.owner.filters };
		entry.isCollapsed = entry.owner.isCollapsed;
		entry.isCompletedScrollable = entry.owner.isCompletedScrollable;
	};
	const scheduleRefresh = entry => {
		if (!entries.has(entry) || entry.frame !== null || !entry.owner.containerEl.isConnected) return;
		const view = entry.document.defaultView;
		if (!view?.requestAnimationFrame) { remember(entry); return; }
		entry.frame = view.requestAnimationFrame(() => {
			entry.frame = null;
			if (entries.has(entry)) remember(entry);
		});
	};
	const pruneNavigation = () => {
		for (const entry of entries) {
			if (Date.now() >= entry.expiresAt || !entry.pane.isConnected || entry.view.containerEl !== entry.pane || entry.view.file?.path !== entry.hostPath) remove(entry);
		}
	};
	const events = ["file-open", "layout-change"].map(name => workspace?.on?.(name, pruneNavigation)).filter(Boolean);

	return {
		armForFile(path) {
			if (disposed) return () => {};
			// A newer write owns the handoff window; older finish callbacks cannot affect it.
			for (const entry of entries) if (entry.path === path) remove(entry);
			const candidates = [...plugin.boardRenderers].filter(renderer => renderer.sourcePath === path && renderer.containerEl.isConnected)
				.map(owner => ({ owner, view: findView(owner.containerEl) })).filter(candidate => candidate.view);
			// Only one visible board may restore a pane; consumption order cannot transfer this authority.
			const eligible = candidates.filter(({ owner, view }) => candidates.filter(candidate => candidate.view === view && candidate.owner.boardId === owner.boardId).length === 1);
			const authorities = new Map();
			for (const candidate of eligible) {
				const distance = visibleDistance(candidate.owner, candidate.view);
				if (distance < (authorities.get(candidate.view)?.distance ?? Infinity)) authorities.set(candidate.view, { owner: candidate.owner, distance });
			}
			const armed = [];
			for (const { owner, view } of eligible) {
				const entry = {
					owner, view, pane: view.containerEl, path, boardId: owner.boardId,
					document: owner.containerEl.ownerDocument, hostPath: view.file?.path,
					createdAt: Date.now(), drafts: owner.quickAddDrafts, listeners: [], frame: null,
					outerAuthority: authorities.get(view)?.owner === owner,
				};
				remember(entry);
				const refresh = () => scheduleRefresh(entry);
				const focusOut = event => {
					const clearFocus = () => {
						if (!entries.has(entry) || !owner.containerEl.isConnected) return;
						entry.snapshot.focus = null;
						refresh();
					};
					// Removal may emit focusout before isConnected flips; do not capture BODY then.
					if (event.relatedTarget) clearFocus();
					else queueMicrotask(clearFocus);
				};
				const intent = () => { if (!owner.containerEl.isConnected) remove(entry); };
				entry.listeners = [
					["scroll", refresh, true], ["input", refresh, false], ["change", refresh, false],
					["focusin", refresh, false], ["focusout", focusOut, false],
					["wheel", intent, true], ["pointerdown", intent, true], ["keydown", intent, true],
				];
				for (const [type, handler, capture] of entry.listeners) entry.pane.addEventListener(type, handler, { capture, passive: true });
				entries.add(entry); armed.push(entry);
				expireAfter(entry, MAX_PENDING_MS);
			}
			let finished = false;
			return () => {
				if (finished) return;
				finished = true;
				for (const entry of armed) {
					if (!entries.has(entry)) continue;
					expireAfter(entry, Math.max(0, Math.min(SETTLED_MS, MAX_PENDING_MS - (Date.now() - entry.createdAt))));
				}
			};
		},
		adopt(renderer) {
			if (disposed || !renderer.containerEl.isConnected) return null;
			pruneNavigation();
			const view = findView(renderer.containerEl);
			if (!view) return null;
			const entry = [...entries].find(item => item.view === view && item.path === renderer.sourcePath && item.boardId === renderer.boardId);
			if (!entry || entry.owner.containerEl.isConnected || entry.document !== renderer.containerEl.ownerDocument) return null;
			const duplicates = [...plugin.boardRenderers].filter(other => other.containerEl.isConnected && other.sourcePath === renderer.sourcePath &&
				other.boardId === renderer.boardId && findView(other.containerEl) === view);
			if (duplicates.some(other => other !== renderer)) { remove(entry); return null; }
			renderer.quickAddDrafts = entry.drafts;
			renderer.filters = { ...entry.filters };
			renderer.isCollapsed = entry.isCollapsed;
			renderer.isCompletedScrollable = entry.isCompletedScrollable;
			remove(entry);
			// The caller renders first, then passes this to restoreBoardView.
			return entry.snapshot;
		},
		dispose() {
			disposed = true;
			for (const entry of entries) remove(entry);
			for (const event of events) workspace?.offref?.(event);
		},
	};
}

module.exports = { createViewHandoff };
