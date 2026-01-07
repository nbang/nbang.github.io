const globals = require("globals");
const pluginJs = require("@eslint/js");
const html = require("@html-eslint/eslint-plugin");
const htmlParser = require("@html-eslint/parser");
const tailwind = require("eslint-plugin-tailwindcss");

const cssOneLineSelectors = {
    meta: {
        type: "layout",
        fixable: "code",
    },
    create(context) {
        return {
            StyleTag(node) {
                if (!node.value || typeof node.value.value !== "string") return;

                const rawCss = node.value.value;
                const blockRegex = /([^{]+)(\{)/g;
                let match;

                while ((match = blockRegex.exec(rawCss)) !== null) {
                    const selectorPart = match[1];

                    // Check for multi-line comma usage
                    if (selectorPart.includes(",") && selectorPart.includes("\n")) {
                        // Collapse newlines after commas
                        const normalized = selectorPart.replace(/,\s*\n\s*/g, ", ");

                        // Only report if change acts on the comma-newline pattern
                        if (normalized !== selectorPart) {
                            const contentStart = node.value.range[0];
                            const startOffset = match.index;
                            const endOffset = match.index + selectorPart.length;
                            const fixRange = [contentStart + startOffset, contentStart + endOffset];

                            context.report({
                                node,
                                loc: {
                                    start: context.sourceCode.getLocFromIndex(fixRange[0]),
                                    end: context.sourceCode.getLocFromIndex(fixRange[1]),
                                },
                                message: "CSS selectors should be on a single line.",
                                fix(fixer) {
                                    return fixer.replaceTextRange(fixRange, normalized);
                                },
                            });
                        }
                    }
                }
            },
        };
    },
};

const localPlugin = {
    rules: {
        "css-one-line-selectors": cssOneLineSelectors,
    },
};

module.exports = [
    {
        files: ["**/*.js"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                L: "readonly",
                DxfParser: "readonly",
                proj4: "readonly",
                tokml: "readonly",
                hcmData: "readonly",
                vietnamData: "readonly",
                promptData: "readonly",
                freeForDevData: "readonly"
            },
        },
    },
    pluginJs.configs.recommended,
    {
        files: ["**/*.js"],
        rules: {
            "max-len": ["warn", { "code": 160, "ignoreComments": true, "ignoreUrls": true, "ignoreStrings": true, "ignoreTemplateLiterals": true }]
        }
    },
    {
        files: ["**/*-data.js"],
        rules: {
            "no-unused-vars": "off",
            "max-len": ["warn", { "code": 160, "ignoreUrls": true, "ignoreStrings": true, "ignoreTemplateLiterals": true }]
        }
    },
    {
        files: ["**/*.html"],
        languageOptions: {
            parser: htmlParser,
        },
        plugins: {
            "html": html,           // Key matches rule prefix 'html/'
            "tailwindcss": tailwind,// Key matches rule prefix 'tailwindcss/'
            "local": localPlugin    // Custom local plugin
        },
        rules: {
            ...html.configs["recommended"].rules,
            ...tailwind.configs["recommended"].rules,
            "html/indent": ["error", 4, { "tagChildrenIndent": { "html": 0 } }],
            "tailwindcss/no-custom-classname": "off",
            "html/require-closing-tags": ["error", { "selfClosing": "always" }],
            "html/no-extra-spacing-attrs": "off",
            "html/attrs-newline": "off", // Disable attribute newline enforcement
            "html/element-newline": "off", // Disable element newline enforcement
            "html/no-script-style-type": "off",
            "html/use-baseline": "off",
            "local/css-one-line-selectors": "error"
        }
    }
];
