const fs = require('fs');

async function test() {
    try {
        const data = JSON.parse(fs.readFileSync('src/data/core_protocol.json', 'utf8'));
        const protocolData = data.workouts.map(w => {
            return {
                id: w.id,
                title: w.title,
                subtitle: w.subtitle,
                exercises: w.exercises.map(ex => {
                    const lib = data.exercise_library[ex.id];
                    return {
                        name: lib.name,
                        sets: ex.sets,
                        rir: ex.rir,
                        rirClass: ex.rir == "0" ? "0" : "1",
                        rest: (lib.garmin.cat === "SQUAT" || lib.garmin.cat === "DEADLIFT") ? "3m" : "90s",
                        technique: lib.technique,
                        mistakes: lib.mistakes,
                        visualization: lib.visualization.split(':')[0],
                        vizText: lib.visualization.split(':')[1] ? lib.visualization.split(':')[1].trim() : '',
                        proTip: lib.proTip
                    };
                })
            };
        });
        console.log("Success! Length:", protocolData.length);
    } catch(err) {
        console.error("Mapping error:", err);
    }
}
test();
