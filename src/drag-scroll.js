"use strict";

function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}

function getEdgeScrollVelocity(position, start, end, edgeSize, maxSpeed) {
	if (!Number.isFinite(position) || end <= start || edgeSize <= 0 || maxSpeed <= 0) return 0;
	const topDepth = clamp((start + edgeSize - position) / edgeSize, 0, 1);
	if (topDepth > 0) return -maxSpeed * topDepth * topDepth;
	const bottomDepth = clamp((position - (end - edgeSize)) / edgeSize, 0, 1);
	if (bottomDepth > 0) return maxSpeed * bottomDepth * bottomDepth;
	return 0;
}

function getFrameScrollDelta(velocity, deltaMs) {
	const clampedDelta = clamp(Number.isFinite(deltaMs) ? deltaMs : 0, 0, 32);
	return velocity * clampedDelta / 1000;
}

function canScrollElement(element, direction) {
	if (!element || !direction || element.scrollHeight <= element.clientHeight) return false;
	if (direction < 0) return element.scrollTop > 0;
	return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
}

module.exports = {
	canScrollElement,
	getEdgeScrollVelocity,
	getFrameScrollDelta,
};
