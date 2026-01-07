const globals = require("globals");
const pluginJs = require("@eslint/js");
const html = require("@html-eslint/eslint-plugin");
const htmlParser = require("@html-eslint/parser");
const tailwind = require("eslint-plugin-tailwindcss");

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
            "tailwindcss": tailwind // Key matches rule prefix 'tailwindcss/'
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
            "html/use-baseline": "off"
        }
    }
];
