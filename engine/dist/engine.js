"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activePlayers = void 0;
exports.currentProject = currentProject;
exports.createGame = createGame;
exports.submitStatement = submitStatement;
exports.discussionSkipStatus = discussionSkipStatus;
exports.skipDiscussion = skipDiscussion;
exports.openBlindPhase = openBlindPhase;
exports.actionCost = actionCost;
exports.lockAction = lockAction;
exports.approvals = approvals;
exports.resolveRound = resolveRound;
exports.nextRound = nextRound;
exports.removePlayer = removePlayer;
const errors_1 = require("./errors");
const faction = (value) => value === "PROTECTOR" || value === "SABOTEUR";
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const activePlayers = (state) => state.players.filter(p => p.isAlive);
exports.activePlayers = activePlayers;
const projectById = (state, id) => {
    const result = state.projects.find(p => p.id === id);
    (0, errors_1.rule)(result, "INVALID_SETUP", `Project ${id} not found`);
    return result;
};
function currentProject(state) {
    return projectById(state, state.deckIds[state.round - 1]);
}
function ensurePhase(state, phase) {
    (0, errors_1.rule)(state.phase !== "GAME_OVER", "GAME_OVER", "Game already finished");
    (0, errors_1.rule)(state.phase === phase, "INVALID_PHASE", `Expected phase ${phase}, got ${state.phase}`);
}
function activeActor(state, id) {
    const p = state.players.find(player => player.id === id);
    (0, errors_1.rule)(p, "UNKNOWN_PLAYER", `Unknown player ${id}`);
    (0, errors_1.rule)(p.isAlive, "PLAYER_ELIMINATED", `${id} is eliminated`);
    return p;
}
function createGame({ gameId, players, projects, deckIds, roundLimit = 10 }) {
    (0, errors_1.rule)(typeof gameId === "string" && gameId.trim().length > 0, "INVALID_SETUP", "Missing game ID");
    (0, errors_1.rule)(players.length >= 3, "INVALID_SETUP", "Requires at least 3 players");
    (0, errors_1.rule)(new Set(players.map(p => p.id)).size === players.length, "INVALID_SETUP", "Duplicate player IDs");
    (0, errors_1.rule)(players.every(p => typeof p.id === "string" && p.id.trim() && !["__proto__", "constructor", "prototype"].includes(p.id) && typeof p.name === "string" && p.name.trim() && faction(p.role)), "INVALID_SETUP", "Invalid player record");
    const defenders = players.filter(p => p.role === "PROTECTOR").length;
    const saboteurs = players.length - defenders;
    (0, errors_1.rule)(defenders >= 2 && saboteurs >= 1 && defenders > saboteurs, "INVALID_SETUP", "Invalid team distribution");
    (0, errors_1.rule)(projects.length > 0 && new Set(projects.map(p => p.id)).size === projects.length, "INVALID_SETUP", "Duplicate/empty project data");
    (0, errors_1.rule)(projects.every(p => typeof p.id === "string" && p.id.trim() && p.title.trim() && p.description.trim() && faction(p.alignment) && typeof p.explanation === "string" && p.explanation.trim() && Array.isArray(p.glossary)), "INVALID_SETUP", "Invalid project field");
    (0, errors_1.rule)(Number.isInteger(roundLimit) && roundLimit >= 1 && roundLimit <= projects.length, "INVALID_SETUP", "Invalid round count");
    (0, errors_1.rule)(deckIds.length === roundLimit && new Set(deckIds).size === deckIds.length, "INVALID_SETUP", "Deck must have unique cards for all rounds");
    (0, errors_1.rule)(deckIds.every(id => projects.some(p => p.id === id)), "INVALID_SETUP", "Deck has unknown projects");
    return {
        version: 1, gameId, round: 1, roundLimit, phase: "DEBATE",
        projects: projects.map(p => ({ ...p, glossary: [...p.glossary] })), deckIds: [...deckIds],
        players: players.map(p => ({ ...p, coins: 2, isAlive: true, eliminatedReason: null })),
        statements: {}, lockedActions: {}, inspections: {}, history: [], outcome: null,
        discussionSkipVotes: [], discussionSkipped: false
    };
}
function submitStatement(state, actorId, text, stance) {
    ensurePhase(state, "DEBATE");
    activeActor(state, actorId);
    (0, errors_1.rule)(!hasOwn(state.statements, actorId), "STATEMENT_ALREADY_SUBMITTED", "Already submitted a reason this round");
    (0, errors_1.rule)(typeof text === "string" && text.trim().length >= 1 && text.trim().length <= 500, "INVALID_STATEMENT", "Reason must have 1–500 characters");
    (0, errors_1.rule)(stance === undefined || stance === "SUPPORT" || stance === "OPPOSE" || stance === "UNSURE", "INVALID_STATEMENT", "Invalid public stance");
    const entry = { playerId: actorId, text: text.trim(), ...(stance ? { stance } : {}) };
    return { ...state, statements: { ...state.statements, [actorId]: entry } };
}
function openBlindPhase(state) {
    ensurePhase(state, "DEBATE");
    (0, errors_1.rule)((0, exports.activePlayers)(state).every(p => hasOwn(state.statements, p.id)), "STATEMENTS_PENDING", "Each living player must give a reason");
    return { ...state, phase: "BLIND_ACTION" };
}
/** Skip consent is public progress, independent from submitting a statement. */
function discussionSkipStatus(state, viewerId) {
    const eligible = (0, exports.activePlayers)(state);
    const votes = new Set(state.discussionSkipVotes ?? []);
    const count = eligible.filter(p => votes.has(p.id)).length;
    return { count, required: eligible.length, voted: eligible.some(p => p.id === viewerId && votes.has(p.id)),
        complete: Boolean(state.discussionSkipped) };
}
function completeDiscussionSkip(state) {
    if (state.phase !== 'DEBATE') return state;
    const progress = discussionSkipStatus(state);
    if (!progress.required || progress.count !== progress.required) return state;
    let next = state;
    for (const player of (0, exports.activePlayers)(next)) {
        if (!hasOwn(next.statements, player.id)) next = submitStatement(next, player.id, 'Không gửi ý kiến.', 'UNSURE');
    }
    return { ...openBlindPhase(next), discussionSkipped: true };
}
function skipDiscussion(state, actorId) {
    ensurePhase(state, 'DEBATE');
    activeActor(state, actorId);
    if ((state.discussionSkipVotes ?? []).includes(actorId)) return state;
    return completeDiscussionSkip({ ...state, discussionSkipVotes: [...(state.discussionSkipVotes ?? []), actorId] });
}
function actionCost(action) {
    let cost = action.invest ? 1 : 0;
    if (action.bankAction.type === "INSPECT")
        cost += 3;
    if (action.bankAction.type === "EXPEL")
        cost += action.bankAction.amount;
    return cost;
}
function validateAction(state, player, action) {
    (0, errors_1.rule)(action !== null && typeof action === "object" && typeof action.invest === "boolean", "INVALID_ACTION", "Invalid investment flag");
    const bank = action.bankAction;
    (0, errors_1.rule)(bank && typeof bank === "object", "INVALID_ACTION", "Missing bank action");
    (0, errors_1.rule)(bank.type === "NONE" || bank.type === "INSPECT" || bank.type === "EXPEL", "INVALID_ACTION", "Unknown bank action");
    if (bank.type !== "NONE") {
        (0, errors_1.rule)(typeof bank.targetId === "string" && bank.targetId !== player.id, "INVALID_TARGET", "Cannot target yourself");
        (0, errors_1.rule)((0, exports.activePlayers)(state).some(p => p.id === bank.targetId), "INVALID_TARGET", "Target must be another living player");
    }
    if (bank.type === "EXPEL") {
        (0, errors_1.rule)(Number.isInteger(bank.amount) && bank.amount >= 1 && bank.amount <= 5, "INVALID_ACTION", "EXPEL contribution must be an integer 1–5");
    }
    (0, errors_1.rule)(actionCost(action) <= player.coins, "INSUFFICIENT_COINS", "Not enough coins for entire action");
}
/** This is a FINAL LOCK (not a draft): subsequent changes are rejected. */
function lockAction(state, actorId, action) {
    ensurePhase(state, "BLIND_ACTION");
    const p = activeActor(state, actorId);
    (0, errors_1.rule)(!hasOwn(state.lockedActions, actorId), "ACTION_ALREADY_LOCKED", "Action already locked");
    validateAction(state, p, action);
    // Copy target/value, never retain the caller's mutable object.
    const bank = action.bankAction;
    const safeBank = bank.type === "NONE" ? { type: "NONE" } :
        bank.type === "INSPECT" ? { type: "INSPECT", targetId: bank.targetId } :
            { type: "EXPEL", targetId: bank.targetId, amount: bank.amount };
    const copy = { invest: action.invest, bankAction: safeBank };
    return { ...state, lockedActions: { ...state.lockedActions, [actorId]: copy } };
}
function approvals(state) {
    return state.history.reduce((counts, turn) => {
        if (turn.approved) {
            if (turn.alignment === "PROTECTOR")
                counts.protector++;
            else
                counts.saboteur++;
        }
        return counts;
    }, { protector: 0, saboteur: 0 });
}
function finalOutcome(state, includeRoundLimit = true) {
    const prot = state.players.filter(p => p.isAlive && p.role === "PROTECTOR").length;
    const sab = state.players.filter(p => p.isAlive && p.role === "SABOTEUR").length;
    if (!prot && !sab)
        return { winner: "DRAW", reason: "MUTUAL_ELIMINATION" };
    if (!sab)
        return { winner: "PROTECTOR", reason: "FACTION_ELIMINATED" };
    if (!prot)
        return { winner: "SABOTEUR", reason: "FACTION_ELIMINATED" };
    if (includeRoundLimit && state.round === state.roundLimit) {
        const scores = approvals(state);
        return {
            winner: scores.protector === scores.saboteur ? "DRAW" : scores.protector > scores.saboteur ? "PROTECTOR" : "SABOTEUR",
            reason: "TEN_ROUNDS"
        };
    }
    return null;
}
/** Administrative removal retains records and finalized history, but stops future actions. */
function removePlayer(state, playerId) {
    (0, errors_1.rule)(state.phase !== 'GAME_OVER', 'GAME_OVER', 'Game already finished');
    (0, errors_1.rule)(state.players.some(p => p.id === playerId), 'UNKNOWN_PLAYER', 'Unknown player');
    const next = { ...state, players: state.players.map(p => p.id === playerId && p.isAlive ?
        { ...p, isAlive: false, eliminatedReason: 'REMOVED_BY_HOST' } : p) };
    const outcome = finalOutcome(next, false);
    return outcome ? { ...next, phase: 'GAME_OVER', outcome } : completeDiscussionSkip(next);
}
/** Resolve all locked commands atomically. No individual bank targets or investments are published. */
function resolveRound(state, { fastForward = false } = {}) {
    ensurePhase(state, "BLIND_ACTION");
    const eligible = (0, exports.activePlayers)(state);
    (0, errors_1.rule)(eligible.every(p => hasOwn(state.lockedActions, p.id)), "ACTIONS_PENDING", "All living players must lock an action");
    const project = currentProject(state);
    const investorCount = eligible.filter(p => state.lockedActions[p.id].invest).length;
    const requiredVotes = Math.ceil(eligible.length / 2);
    // upfront deduction then payoff. Investment pays even if NOT approved (original rule #4).
    let players = state.players.map(p => {
        if (!p.isAlive)
            return p;
        const action = state.lockedActions[p.id];
        const payout = action.invest && p.role === project.alignment ? 2 : 0;
        return { ...p, coins: p.coins - actionCost(action) + payout };
    });
    const inspections = { ...state.inspections };
    const pooled = {};
    const expellers = new Map();
    for (const p of eligible) {
        const bank = state.lockedActions[p.id].bankAction;
        if (bank.type === "INSPECT") {
            const target = state.players.find(pl => pl.id === bank.targetId);
            inspections[p.id] = [...(inspections[p.id] ?? []), { round: state.round, targetId: bank.targetId, revealedRole: target.role }];
        }
        if (bank.type === "EXPEL") {
            pooled[bank.targetId] = (pooled[bank.targetId] ?? 0) + bank.amount;
            if (!expellers.has(bank.targetId)) expellers.set(bank.targetId, []);
            expellers.get(bank.targetId).push(p.id);
        }
    }
    const expelIds = new Set(Object.keys(pooled).filter(id => pooled[id] >= 5));
    // EXPULSION takes precedence if target both spent final coin and was expelled.
    players = players.map(p => p.isAlive && expelIds.has(p.id) ? { ...p, isAlive: false, eliminatedReason: "EXPELLED", eliminatedByPlayerIds: expellers.get(p.id).slice() } : p);
    players = players.map(p => p.isAlive && p.coins === 0 ? { ...p, isAlive: false, eliminatedReason: "BANKRUPT" } : p);
    const newlyEliminatedIds = players.filter(p => !p.isAlive && eligible.some(start => start.id === p.id)).map(p => p.id);
    const summary = {
        round: state.round,
        projectId: project.id, projectTitle: project.title,
        approved: investorCount >= requiredVotes,
        investorCount, eligibleCount: eligible.length, requiredVotes,
        alignment: project.alignment, verdictLabel: project.verdictLabel,
        ...(fastForward ? { fastForward: true } : {}),
        explanation: project.explanation, newlyEliminatedIds,
        statements: eligible.map(p => ({ ...state.statements[p.id] }))
    };
    const next = { ...state, players, inspections, history: [...state.history, summary], phase: "REVEAL" };
    const outcome = finalOutcome(next);
    return outcome ? { ...next, phase: "GAME_OVER", outcome } : next;
}
/** Advance after players have read the result; this does NOT alter past public history. */
function nextRound(state) {
    ensurePhase(state, "REVEAL");
    (0, errors_1.rule)(state.round < state.roundLimit, "GAME_OVER", "No more rounds");
    return { ...state, round: state.round + 1, phase: "DEBATE", statements: {}, lockedActions: {}, discussionSkipVotes: [], discussionSkipped: false };
}
