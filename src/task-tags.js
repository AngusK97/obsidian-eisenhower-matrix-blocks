"use strict";

function isValidTags(value) {
	return Array.isArray(value) && value.every((tag) => typeof tag === "string");
}

function normalizeTag(value) {
	return value.trim().replace(/^#+/, "").trim().normalize("NFC");
}

function normalizeTags(value) {
	if (!isValidTags(value)) return [];
	return [...new Set(value.map(normalizeTag).filter(Boolean))];
}

// FNV-1a over normalized UTF-16 code units: stable on every supported device.
function getTagColorIndex(value) {
	const tag = typeof value === "string" ? normalizeTag(value) : "";
	let hash = 0x811c9dc5;
	for (let index = 0; index < tag.length; index += 1) {
		hash = Math.imul(hash ^ tag.charCodeAt(index), 0x01000193) >>> 0;
	}
	return hash % 8;
}

module.exports = { getTagColorIndex, isValidTags, normalizeTags };
