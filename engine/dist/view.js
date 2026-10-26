"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectForPlayer = projectForPlayer;
const errors_1 = require("./errors");
const engine_1 = require("./engine");
/** Server must derive viewerId from the authenticated session, never from untrusted client payload. */
function projectForPlayer(state, viewerId) {
    const me = state.players.find(p => p.id === viewerId);
    (0, errors_1.rule)(me, "UNKNOWN_PLAYER", "Viewer is not a player in this room");
    const current = (0, engine_1.currentProject)(state);
    const revealed = state.phase === "REVEAL" || state.phase === "GAME_OVER";
    const scores = (0, engine_1.approvals)(state);
    const result = {
        gameId: state.gameId,
        phase: state.phase, round: state.round, roundLimit: state.roundLimit,
        myPlayer: {
            id: me.id, name: me.name, role: me.role, coins: me.coins,
            isAlive: me.isAlive, eliminatedReason: me.eliminatedReason,
            lockedAction: state.lockedActions[viewerId] ? {
                invest: state.lockedActions[viewerId].invest,
                bankAction: { ...state.lockedActions[viewerId].bankAction }
            } : null,
            inspections: (state.inspections[viewerId] ?? []).map(i => ({ ...i }))
        },
        players: state.players.map(p => ({ id: p.id, name: p.name, isAlive: p.isAlive,
            hasStatement: Object.prototype.hasOwnProperty.call(state.statements, p.id), hasLockedAction: Object.prototype.hasOwnProperty.call(state.lockedActions, p.id),
            ...(state.phase === "GAME_OVER" ? { role: p.role } : {})
        })),
        project: {
            id: current.id, title: current.title, description: current.description, glossary: [...current.glossary],
            ...(revealed ? { alignment: current.alignment, verdictLabel: current.verdictLabel, explanation: current.explanation } : {})
        },
        currentStatements: Object.values(state.statements).map(s => ({ ...s })),
        history: state.history.map(h => ({ ...h,
            statements: h.statements.map(s => ({ ...s })),
            newlyEliminatedIds: [...h.newlyEliminatedIds] })),
        approvedProtectorCount: scores.protector,
        approvedSaboteurCount: scores.saboteur,
        outcome: state.outcome ? { ...state.outcome } : null
    };
    return result;
}
