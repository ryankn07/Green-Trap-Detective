"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shuffled = shuffled;
exports.saboteurCount = saboteurCount;
exports.assignBaseRoles = assignBaseRoles;
exports.selectProjectDeck = selectProjectDeck;
const errors_1 = require("./errors");
function shuffled(values, randomInt) {
    const output = [...values];
    for (let i = output.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        (0, errors_1.rule)(Number.isInteger(j) && j >= 0 && j <= i, "INVALID_SETUP", "randomInt returned out-of-range integer");
        const temp = output[i];
        output[i] = output[j];
        output[j] = temp;
    }
    return output;
}
function saboteurCount(playerCount) {
    (0, errors_1.rule)(Number.isSafeInteger(playerCount) && playerCount >= 3, "INVALID_SETUP", "Need at least 3 players");
    return Math.floor((playerCount - 1) / 2);
}
function assignBaseRoles(participants, randomInt) {
    const numberOfSaboteurs = saboteurCount(participants.length);
    (0, errors_1.rule)(new Set(participants.map(p => p.id)).size === participants.length, "INVALID_SETUP", "Duplicate participant ID");
    const roles = [
        ...Array.from({ length: participants.length - numberOfSaboteurs }, () => "PROTECTOR"),
        ...Array.from({ length: numberOfSaboteurs }, () => "SABOTEUR")
    ];
    const shuffledRoles = shuffled(roles, randomInt);
    return participants.map((p, i) => ({ id: p.id, name: p.name, role: shuffledRoles[i] }));
}
function selectProjectDeck(projects, rounds, randomInt) {
    (0, errors_1.rule)(Number.isInteger(rounds) && rounds > 0 && rounds <= projects.length, "INVALID_SETUP", "Invalid round limit");
    const ids = projects.map(p => p.id);
    (0, errors_1.rule)(new Set(ids).size === ids.length, "INVALID_SETUP", "Duplicate project IDs");
    return shuffled(ids, randomInt).slice(0, rounds);
}
