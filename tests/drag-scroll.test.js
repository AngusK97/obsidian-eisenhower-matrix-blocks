"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	canScrollElement,
	getEdgeScrollVelocity,
	getFrameScrollDelta,
} = require("../src/drag-scroll");

test("drag auto-scroll stays still outside an edge zone", () => {
	assert.equal(getEdgeScrollVelocity(200, 0, 400, 48, 720), 0);
});

test("drag auto-scroll accelerates toward either edge and remains bounded", () => {
	const nearTop = getEdgeScrollVelocity(24, 0, 400, 48, 720);
	const atTop = getEdgeScrollVelocity(0, 0, 400, 48, 720);
	const nearBottom = getEdgeScrollVelocity(376, 0, 400, 48, 720);
	const atBottom = getEdgeScrollVelocity(400, 0, 400, 48, 720);

	assert.ok(nearTop < 0 && nearTop > -720);
	assert.equal(atTop, -720);
	assert.ok(nearBottom > 0 && nearBottom < 720);
	assert.equal(atBottom, 720);
});

test("drag auto-scroll clamps delayed animation frames", () => {
	assert.equal(getFrameScrollDelta(1000, 16), 16);
	assert.equal(getFrameScrollDelta(1000, 100), 32);
	assert.equal(getFrameScrollDelta(1000, -1), 0);
});

test("scrollability respects both ends of a scroll container", () => {
	const element = { scrollHeight: 500, clientHeight: 200, scrollTop: 0 };
	assert.equal(canScrollElement(element, -1), false);
	assert.equal(canScrollElement(element, 1), true);

	element.scrollTop = 150;
	assert.equal(canScrollElement(element, -1), true);
	assert.equal(canScrollElement(element, 1), true);

	element.scrollTop = 300;
	assert.equal(canScrollElement(element, -1), true);
	assert.equal(canScrollElement(element, 1), false);
});
