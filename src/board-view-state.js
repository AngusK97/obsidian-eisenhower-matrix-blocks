"use strict";

function listKey(list) {
	return list.closest("[data-quadrant]")?.getAttribute("data-quadrant") || "completed";
}

function captureBoardView(root) {
	const document = root.ownerDocument;
	const view = document?.defaultView;
	const lists = [...root.querySelectorAll(".qt-task-list, .qt-completed-list")].map(list => {
		const bounds = list.getBoundingClientRect();
		const rows = [...list.querySelectorAll("[data-task-id]")];
		// Rows are vertically ordered. Avoid measuring every card on long lists.
		let low = 0, high = rows.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (rows[middle].getBoundingClientRect().bottom <= bounds.top) low = middle + 1;
			else high = middle;
		}
		const anchors = rows.slice(low, low + 3).map(row => ({
			id: row.getAttribute("data-task-id"), offset: row.getBoundingClientRect().top - bounds.top,
		}));
		return { key: listKey(list), top: list.scrollTop || 0, anchors };
	});
	const outer = [];
	for (let node = root.parentElement; node; node = node.parentElement) {
		if (node.scrollHeight > node.clientHeight && /auto|scroll|overlay/.test(view?.getComputedStyle(node).overflowY || "")) {
			outer.push({ node, top: node.scrollTop, left: node.scrollLeft });
		}
	}
	const page = document?.scrollingElement;
	if (page && !outer.some(item => item.node === page)) outer.push({ node: page, top: page.scrollTop, left: page.scrollLeft });
	// A section near the viewport is more stable than the root when earlier sections shrink.
	const visibleTop = outer[0]?.node === page ? 0 : outer[0]?.node.getBoundingClientRect().top || 0;
	const visibleBottom = outer[0]?.node === page ? view?.innerHeight ?? Infinity
		: outer[0]?.node.getBoundingClientRect().bottom ?? Infinity;
	const rootBounds = root.getBoundingClientRect();
	// An offscreen board must not pull the containing note toward its own sections.
	if (rootBounds.bottom <= visibleTop || rootBounds.top >= visibleBottom) outer.length = 0;
	const sections = [...root.querySelectorAll("[data-quadrant], .qt-completed-section")];
	const section = sections.find(node => node.getBoundingClientRect().bottom > visibleTop) || root;
	const focus = document?.activeElement;
	const focusState = focus && root.contains(focus) ? {
		node: focus,
		quadrant: focus.closest("[data-quadrant]")?.getAttribute("data-quadrant"),
		taskId: focus.closest("[data-task-id]")?.getAttribute("data-task-id"),
		label: focus.getAttribute("aria-label"),
		className: focus.className,
		start: focus.selectionStart, end: focus.selectionEnd,
	} : null;
	return {
		lists, outer, focus: focusState,
		x: root.querySelector(".qt-matrix-viewport")?.scrollLeft || 0,
		sectionKey: section === root ? "root" : section.getAttribute("data-quadrant") || "completed",
		sectionTop: section.getBoundingClientRect().top,
	};
}

function restoreBoardView(root, state, { focus = true, outer = true } = {}) {
	if (!state) return;
	for (const list of root.querySelectorAll(".qt-task-list, .qt-completed-list")) {
		const saved = state.lists.find(item => item.key === listKey(list));
		if (!saved) continue;
		list.scrollTop = saved.top;
		if (saved.top <= 0) continue;
		const rows = new Map([...list.querySelectorAll("[data-task-id]")].map(row => [row.getAttribute("data-task-id"), row]));
		const anchor = saved.anchors.find(item => rows.has(item.id));
		if (anchor) list.scrollTop += rows.get(anchor.id).getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset;
	}
	const viewport = root.querySelector(".qt-matrix-viewport");
	if (viewport) viewport.scrollLeft = state.x;
	if (focus && state.focus) {
		const document = root.ownerDocument;
		const active = document?.activeElement;
		// Never steal focus from another live control (including an editor modal).
		if (active === state.focus.node || !active || active === document?.body) {
			let target = state.focus.node;
			if (!root.contains(target)) {
				let scope = root;
				if (state.focus.taskId) scope = [...root.querySelectorAll("[data-task-id]")].find(node => node.getAttribute("data-task-id") === state.focus.taskId);
				else if (state.focus.quadrant) scope = [...root.querySelectorAll("[data-quadrant]")].find(node => node.getAttribute("data-quadrant") === state.focus.quadrant);
				target = [...(scope?.querySelectorAll("input, textarea, button, select") || [])].find(node =>
					node.className === state.focus.className && (state.focus.taskId || node.getAttribute("aria-label") === state.focus.label));
			}
			if (target && !target.disabled && target !== active) {
				target.focus({ preventScroll: true });
				if (typeof state.focus.start === "number") target.setSelectionRange?.(state.focus.start, state.focus.end);
			}
		}
	}
	if (outer) {
		for (const item of state.outer) {
			if (item.node.isConnected === false) continue;
			item.node.scrollTop = item.top;
			item.node.scrollLeft = item.left;
		}
		const section = state.sectionKey === "root" ? root : state.sectionKey === "completed"
			? root.querySelector(".qt-completed-section")
			: [...root.querySelectorAll("[data-quadrant]")].find(node => node.getAttribute("data-quadrant") === state.sectionKey);
		const scroller = state.outer[0]?.node;
		if (section && scroller?.isConnected) scroller.scrollTop += section.getBoundingClientRect().top - state.sectionTop;
	}
}

module.exports = { captureBoardView, restoreBoardView };
