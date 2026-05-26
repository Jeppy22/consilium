"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_MODEL = void 0;
exports.getAnthropicClient = getAnthropicClient;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
exports.CLAUDE_MODEL = 'claude-sonnet-4-6';
let cachedClient = null;
function getAnthropicClient() {
    if (cachedClient)
        return cachedClient;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set. For local dev add it to functions/local.settings.json. ' +
            'In Azure, wire it as a Key Vault reference on the function app settings.');
    }
    cachedClient = new sdk_1.default({ apiKey });
    return cachedClient;
}
//# sourceMappingURL=anthropic.js.map