"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameError = void 0;
exports.rule = rule;
class GameError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "GameError";
    }
}
exports.GameError = GameError;
function rule(condition, code, message) {
    if (!condition)
        throw new GameError(code, message);
}
