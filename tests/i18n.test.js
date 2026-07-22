"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_LANGUAGE, normalizeLanguage, translate } = require("../src/i18n");

test("language normalization defaults to Chinese", () => {
	assert.equal(DEFAULT_LANGUAGE, "zh");
	assert.equal(normalizeLanguage("zh"), "zh");
	assert.equal(normalizeLanguage("en"), "en");
	assert.equal(normalizeLanguage("fr"), "zh");
});

test("translations cover Chinese and English with variables", () => {
	assert.equal(translate("zh", "quadrant.do.description"), "重要且紧急");
	assert.equal(translate("en", "quadrant.do.description"), "Important and urgent");
	assert.equal(translate("zh", "stats.active", { count: 3 }), "3 项进行中");
	assert.equal(translate("en", "stats.active", { count: 3 }), "3 active");
});
