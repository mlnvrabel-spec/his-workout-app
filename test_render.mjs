import fs from 'fs';
const data = JSON.parse(fs.readFileSync('src/data/core_protocol.json'));
const protocolData = data.workouts.map(w => {
    return {
        id: w.id,
        exercises: w.exercises.map(exRef => {
            const lib = data.exercise_library[exRef.id];
            return { ...lib, ...exRef };
        })
    };
});
const dOpts = protocolData[0];
dOpts.exercises.forEach((ex, i) => {
    try {
        const liHTML = ex.technique.map((t, idx) => t).join('');
        const xHTML = ex.mistakes.map(m => m).join('');
    } catch (e) {
        console.error("Error at index " + i, e);
    }
});
console.log("Success");
