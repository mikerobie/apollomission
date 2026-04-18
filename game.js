// ============================================================
// Apollo Mission — Game Engine
// ============================================================
//
// HOW TO USE THESE COMMENTS
// --------------------------
// Every major section has a tag you can use when asking Claude for help.
// Just say "in [TAG] I want to change X" and Claude will know exactly
// where to look. Tags follow this naming convention:
//
//   [CFG:NAME]   — Configuration constants (data that drives the game)
//   [STATE:NAME] — Game state (the live data that changes as you play)
//   [3D:NAME]    — Three.js scene-building (spacecraft, planets, stars, pad)
//   [LOOP:NAME]  — The animation loop (runs 60× per second, moves everything)
//   [GAME:NAME]  — Core game logic (phase transitions, ticks, events, failure)
//   [UI:NAME]    — HTML/DOM rendering (gauges, log, buttons, DSKY display)
//
// WHAT IS THREE.JS?
// -----------------
// Three.js is a JavaScript library that draws 3D graphics in the browser
// using WebGL. The main objects you'll see throughout this file are:
//   • THREE.Scene       — the "world" container that holds everything
//   • THREE.Mesh        — a visible 3D object (geometry shape + material/color)
//   • THREE.Group       — an invisible container that holds multiple Meshes
//   • THREE.Camera      — the "eye" that looks at the scene
//   • THREE.Renderer    — draws the scene onto the HTML <canvas> element
//
// ============================================================


// ============================================================
// [CFG:IDENTITY] — Game title constants
// ============================================================
// Plain string constants used in log messages and the overlay screen.
// Change MISSION_NAME here to rename the mission everywhere at once.

const GAME_TITLE   = 'Apollo Mission';
const MISSION_NAME = 'Apollo 11';


// ============================================================
// [CFG:PHASES] — Mission phase sequence
// ============================================================
// An ordered array of all mission phases from launch to splashdown.
// Think of this like a chapter list for a book — the game steps through
// these one at a time, left to right.
//
// PHASES[0] = first phase (pre-launch)
// PHASES[PHASES.length - 1] = last phase (mission complete)
//
// You can add new phases here (and a matching entry in PHASE_CONFIG below),
// and the game will automatically include them in the sequence.

const PHASES = [
    'PRE_LAUNCH',       // 0 — On the pad, no resources draining yet
    'LAUNCH',           // 1 — Saturn V ignition → Earth orbit
    'TRANSIT_TO_MOON',  // 2 — Translunar coast, ~384,400 km
    'LUNAR_ORBIT',      // 3 — Circling the Moon before descent
    'LANDING',          // 4 — Powered descent to the surface
    'LUNAR_SURFACE',    // 5 — EVA & surface operations
    'ASCENT',           // 6 — Lunar Module lifts off to rendezvous
    'TRANSIT_TO_EARTH', // 7 — Transearth coast, ~384,400 km
    'RE_ENTRY',         // 8 — CM re-entry and splashdown (auto-completes)
    'MISSION_COMPLETE'  // 9 — Win state
];


// ============================================================
// [CFG:PHASE_CONFIG] — Per-phase settings
// ============================================================
// Each phase has three key pieces of data:
//
//   label       — Human-readable name shown in the HUD phase display
//   distance    — How many km must be traveled before the phase completes.
//                 Zero means the phase is time-based, not distance-based.
//   consumption — How much of each resource drains per game tick (every 500 ms).
//                 Divide by 10 to get the drain per second.
//   code        — The DSKY verb/noun command the player types to advance
//                 to the next phase once this one is complete.
//                 null means the phase auto-completes (like RE_ENTRY).
//
// To make a phase harder, increase its consumption values.
// To make it easier, reduce them or add more distance so resources drain longer.

const PHASE_CONFIG = {
    'PRE_LAUNCH':       { label: 'Pre-Launch Checkout',       distance: 0,      consumption: {},                                       code: 'V37 N01' },
    'LAUNCH':           { label: 'Launch Sequence',           distance: 400,    consumption: { fuel: 1.5, battery: 0.4 },              code: 'V37 N02' },
    'TRANSIT_TO_MOON':  { label: 'Translunar Injection',      distance: 384400, consumption: { fuel: 0.5, oxygen: 0.5, battery: 0.3 }, code: 'V63 N01' },
    'LUNAR_ORBIT':      { label: 'Lunar Orbit Insertion',     distance: 1800,   consumption: { fuel: 0.8, battery: 0.35 },             code: 'V63 N02' },
    'LANDING':          { label: 'Powered Descent Init',      distance: 185,    consumption: { fuel: 1.8, battery: 0.5 },              code: 'V16 N45' },
    'LUNAR_SURFACE':    { label: 'Lunar Surface Operations',  distance: 0,      consumption: { oxygen: 0.6, battery: 0.4 },            code: 'V37 N05' },
    'ASCENT':           { label: 'Lunar Ascent',              distance: 200,    consumption: { fuel: 1.4, battery: 0.45 },             code: 'V37 N06' },
    'TRANSIT_TO_EARTH': { label: 'Transearth Injection',      distance: 384400, consumption: { fuel: 0.5, oxygen: 0.5, battery: 0.3 }, code: 'V37 N07' },
    'RE_ENTRY':         { label: 'Re-entry & Splashdown',     distance: 400,    consumption: { integrity: 1.8, battery: 0.5 },         code: null },
    'MISSION_COMPLETE': { label: 'Splashdown Successful',     distance: 0,      consumption: {} },
    'MISSION_FAILED':   { label: 'Mission Aborted',           distance: 0,      consumption: {} },
};


// ============================================================
// [CFG:SUPPLIES] — Supply allocation screen configuration
// ============================================================
// This powers the Oregon Trail-style supply screen shown before launch.
// Each resource has:
//   base     — Starting percentage before any supply units are added.
//              Set to 100 so all gauges start full.
//   perUnit  — Extra % gained per supply unit allocated. Currently 0 (all at max).
//   max      — Maximum number of supply units you can assign to this category.
//   label    — Name shown on the supply screen.
//   icon     — Emoji icon shown next to the label.
//   tip      — Tooltip text explaining the resource.
//
// To restore the supply-allocation gameplay, lower the `base` values
// (e.g. fuel: 50) and raise `perUnit` (e.g. 6) so the player must
// spend units to top up their tanks before launch.

const SUPPLY_CONFIG = {
    fuel:      { label: 'Propellant Supplement', unit: 'Tanks',     icon: '⛽', base: 100, perUnit: 0, max: 5,
                 tip: 'Powers all main engine burns — LAUNCH, LANDING, and ASCENT drain heavily.' },
    oxygen:    { label: 'O₂ Backup Canisters',   unit: 'Canisters', icon: '💨', base: 100, perUnit: 0, max: 5,
                 tip: 'Crew must breathe. Surface ops drain O₂ fast if you linger.' },
    battery:   { label: 'EPS Battery Packs',      unit: 'Packs',    icon: '🔋', base: 100, perUnit: 0, max: 5,
                 tip: 'Powers ALL ship systems. No battery = no guidance, no comms, no life support.' },
    integrity: { label: 'Hull Repair Kits',       unit: 'Kits',     icon: '🛡', base: 100, perUnit: 0, max: 5,
                 tip: 'Absorbs micrometeorite strikes and re-entry heating. Already near max — spend wisely.' },
};

// Total number of supply units the player can distribute across all categories.
const TOTAL_SUPPLY_UNITS = 10;

// Tracks how many supply units the player has allocated to each category.
// Starts at zero before they interact with the supply screen.
let supplyAllocation = { fuel: 0, oxygen: 0, battery: 0, integrity: 0 };


// ============================================================
// [STATE:INIT] — Initial game state factory
// ============================================================
// This function creates a fresh state object representing everything
// that changes during a playthrough:
//
//   phase            — Which mission phase is currently active (string key into PHASE_CONFIG)
//   resources        — Current % levels for fuel, oxygen, battery, integrity
//   distanceTraveled — How far the spacecraft has traveled in the current phase (km)
//   totalDistance    — Total distance needed to complete the current phase (km)
//   day              — Mission elapsed time in days (increments every tick)
//   log              — Array of mission log strings shown in the bottom-left panel
//   isPaused         — Whether the game tick is currently frozen
//   isDecisionPending — Whether a decision modal is blocking the tick
//
// Calling getInitialState() again (on restart) resets everything cleanly.
// The resources are built from SUPPLY_CONFIG so supply choices take effect.

function getInitialState() {
    // Build starting resource levels from base values + whatever
    // the player allocated on the supply screen (perUnit × units).
    // Math.min(100, ...) ensures nothing exceeds 100%.
    const resources = {};
    Object.entries(SUPPLY_CONFIG).forEach(([key, cfg]) => {
        resources[key] = Math.min(100, cfg.base + supplyAllocation[key] * cfg.perUnit);
    });

    return {
        phase: 'PRE_LAUNCH',
        resources,
        distanceTraveled: 0,
        totalDistance: 0,
        day: 1,
        log: [
            `◈ ${MISSION_NAME} — ALL SYSTEMS NOMINAL.`,
            `◈ AGC INITIALIZED — DSKY ONLINE.`,
            `◈ ENTER V37 N01 TO INITIATE LAUNCH SEQUENCE.`
        ],
        isPaused: true,        // Game starts paused on the pad
        isDecisionPending: false
    };
}

// The live state object. Everything in the game reads from and writes to this.
let state = getInitialState();


// ============================================================
// [GAME:DSKY] — Apollo Guidance Computer (DSKY) interface
// ============================================================
// The DSKY (Display and Keyboard) is the real Apollo computer interface.
// In our game it's the main input device — the player types Verb/Noun
// codes to advance phases.
//
// How it works:
//   1. Player presses V, then two digits → sets the Verb
//   2. Player presses N, then two digits → sets the Noun
//   3. Player presses ENT → executes the command
//
// If the combined "V## N##" string matches the expected code for the
// current phase (from PHASE_CONFIG), the game advances to the next phase.
// Otherwise it shows an error light.
//
// PRO (Proceed) button = pause/resume toggle.
// CLR (Clear) button   = resets the current input.

const dsky = {
    verb: '',           // Currently entered verb digits (up to 2 characters)
    noun: '',           // Currently entered noun digits (up to 2 characters)
    inputMode: 'V',     // Whether the next digit goes to Verb or Noun

    // Called every time a keypad button is clicked.
    // `key` is the button label: '0'-'9', 'V', 'N', 'ENT', 'PRO', 'CLR'
    press(key) {
        if (key === 'CLR') {
            // Clear both registers and reset to Verb mode
            this.verb = '';
            this.noun = '';
            this.inputMode = 'V';
        } else if (key === 'V') {
            // Switch to Verb input mode and clear the verb register
            this.inputMode = 'V';
            this.verb = '';
        } else if (key === 'N') {
            // Switch to Noun input mode and clear the noun register
            this.inputMode = 'N';
            this.noun = '';
        } else if (key === 'ENT') {
            // Execute the currently entered verb+noun command
            this.execute();
        } else if (key === 'PRO') {
            // PRO = "Proceed" — used here as a pause/resume toggle
            game.handleAction('continue');
        } else if (!isNaN(key)) {
            // Digit 0–9: append to whichever register is active (max 2 digits each)
            if (this.inputMode === 'V' && this.verb.length < 2) {
                this.verb += key;
            } else if (this.inputMode === 'N' && this.noun.length < 2) {
                this.noun += key;
            }
        }
        this.updateDisplay();   // Refresh the on-screen digits
        this.flashActivity();   // Briefly light the Activity warning light
    },

    // Pushes the current verb/noun values into the DSKY display elements in the HTML.
    // padStart(2, '0') pads single digits with a leading zero, e.g. '7' → '07'.
    updateDisplay() {
        const vEl = document.getElementById('dsky-verb');
        const nEl = document.getElementById('dsky-noun');
        const pEl = document.getElementById('dsky-prog');
        if (vEl) vEl.innerText = this.verb.padStart(2, '0');
        if (nEl) nEl.innerText = this.noun.padStart(2, '0');
        if (pEl) {
            // Program number = the index of the current phase in the PHASES array
            const idx = PHASES.indexOf(state.phase);
            pEl.innerText = (idx >= 0 ? idx : 0).toString().padStart(2, '0');
        }
    },

    // Briefly illuminates the ACTY (Activity) warning light for 200 ms.
    // This mimics the real DSKY behaviour of flickering on every keypress.
    flashActivity() {
        const led = document.getElementById('wl-acty');
        if (led) {
            led.classList.add('wl-on');
            setTimeout(() => led.classList.remove('wl-on'), 200);
        }
    },

    // Turns a DSKY warning light on or off.
    // `id`  — the HTML element id (e.g. 'wl-temp', 'wl-uplink')
    // `on`  — true to illuminate, false to extinguish
    setWarningLight(id, on) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('wl-on', on);
    },

    // Validates the entered verb+noun against the expected code for the current phase.
    // On success: flashes the PROG light and calls game.advancePhase().
    // On failure: flashes the OPR ERR light and logs the mismatch.
    execute() {
        // Build the full code string, e.g. "V37 N01"
        const code = `V${this.verb.padStart(2, '0')} N${this.noun.padStart(2, '0')}`;
        const expectedCode = PHASE_CONFIG[state.phase]?.code;

        // Some phases have no code (e.g. RE_ENTRY auto-completes)
        if (!expectedCode) {
            game.addLog(`◌ DSKY: NO COMMAND REQUIRED — PHASE AUTO-COMPLETES.`);
            return;
        }

        if (expectedCode === code) {
            // Correct code → brief green flash, then advance
            this.setWarningLight('wl-prog', true);
            setTimeout(() => this.setWarningLight('wl-prog', false), 800);
            game.advancePhase();
        } else {
            // Wrong code → brief red flash and error message
            this.setWarningLight('wl-opr', true);
            setTimeout(() => this.setWarningLight('wl-opr', false), 1200);
            game.addLog(`◌ DSKY ERR: INVALID SEQUENCE ${code} — VERB/NOUN MISMATCH.`);
        }
    }
};


// ============================================================
// [CFG:RANDOM_EVENTS] — Automatic background events
// ============================================================
// These fire randomly during any active flight phase (~0.8% chance per tick).
// Each has:
//   id      — Unique string identifier (not currently used for deduplication)
//   msg     — Text that appears in the mission log
//   impact  — A function that modifies the resources object directly.
//              `r` is a reference to state.resources, so changes are immediate.
//
// To add a new random event, copy one of these objects and add it to the array.
// To change event frequency, find `Math.random() < 0.008` in [GAME:TICK].

const RANDOM_EVENTS = [
    {
        id: 'solar_flare',
        msg: '⚠ SOLAR FLARE: Particle storm detected. Battery −8%, Integrity −3%.',
        impact: (r) => { r.battery = Math.max(0, r.battery - 8); r.integrity = Math.max(0, r.integrity - 3); }
    },
    {
        id: 'oxygen_leak',
        msg: '⚠ O₂ MICRO-LEAK: Seal hairline crack in life support. Oxygen −10%.',
        impact: (r) => { r.oxygen = Math.max(0, r.oxygen - 10); }
    },
    {
        id: 'hull_strike',
        msg: '⚠ MICROMETEORITE IMPACT: Structural integrity −6%.',
        impact: (r) => { r.integrity = Math.max(0, r.integrity - 6); }
    },
    {
        id: 'fuel_efficiency',
        msg: '◈ OPTIMAL TRAJECTORY: Gravity-assist saves propellant. Fuel +5%.',
        impact: (r) => { r.fuel = Math.min(100, r.fuel + 5); }
    },
    {
        id: 'battery_fault',
        msg: '⚠ FUEL CELL ANOMALY: Cell B output slightly reduced. Battery −8%.',
        impact: (r) => { r.battery = Math.max(0, r.battery - 8); }
    },
    {
        id: 'oxygen_recovery',
        msg: '◈ SCRUBBER OPTIMIZED: CO₂ removal efficiency improved. O₂ +6%.',
        impact: (r) => { r.oxygen = Math.min(100, r.oxygen + 6); }
    },
    {
        id: 'battery_boost',
        msg: '◈ POWER MANAGEMENT: Load-shedding protocol saves energy. Battery +5%.',
        impact: (r) => { r.battery = Math.min(100, r.battery + 5); }
    },
];


// ============================================================
// [CFG:INTERACTIVE_EVENTS] — Player decision events
// ============================================================
// These pop up a modal forcing the player to make a choice (~1% chance per tick
// during active flight phases 1–8). Each event has:
//
//   id          — Unique identifier used when the player clicks an option button
//   title       — Bold header in the decision modal
//   description — Paragraph explaining the situation
//   options     — Array of choices. Each option has:
//                   label  — Button text
//                   desc   — Small subtitle describing the tradeoff
//                   action — Function called when player chooses this option.
//                            `s` is the full state object (so you can modify
//                            s.resources, push to s.log, etc.)
//
// To add a new event: copy one of these blocks, change the id, title,
// description, and options, then add it to the array.
// Frequency is set in [GAME:TICK] with `Math.random() < 0.01`.

const INTERACTIVE_EVENTS = [
    {
        id: 'asteroid_field',
        title: 'Micro-Asteroid Cluster',
        description: 'Long-range radar detects a dense cluster of micro-asteroids on your trajectory. Mission Control recommends an evasive burn, but it will cost propellant.',
        options: [
            {
                label: 'Evasive Burn',
                desc: 'Safe route. Fuel −15%.',
                action: (s) => {
                    s.resources.fuel = Math.max(0, s.resources.fuel - 15);
                    s.log.push('◈ DECISION: Evasive burn executed. Asteroid field cleared. Fuel consumed.');
                }
            },
            {
                label: 'Maintain Course',
                desc: 'Risk hull damage to save fuel.',
                action: (s) => {
                    // Random damage between 8% and 28%
                    const dmg = Math.round(Math.random() * 20 + 8);
                    s.resources.integrity = Math.max(0, s.resources.integrity - dmg);
                    s.log.push(`⚠ DECISION: Hull sustained ${dmg}% impact damage from asteroid debris.`);
                }
            }
        ]
    },
    {
        id: 'power_surge',
        title: 'Electrical Surge — Service Module',
        description: 'A voltage spike is detected in the SM power bus. You can safely vent the excess, or attempt to capture it in the backup batteries — risky but potentially rewarding.',
        options: [
            {
                label: 'Vent Safely',
                desc: 'No resource change. Safe.',
                action: (s) => {
                    s.log.push('◈ DECISION: Excess energy vented. Systems nominal.');
                }
            },
            {
                label: 'Capture Energy',
                desc: '60% chance: Battery +25%. 40% chance: Integrity −15%.',
                action: (s) => {
                    // Math.random() returns a float between 0 and 1.
                    // > 0.4 means there's a 60% chance of success.
                    if (Math.random() > 0.4) {
                        s.resources.battery = Math.min(100, s.resources.battery + 25);
                        s.log.push('◈ DECISION: Energy capture successful. Backup batteries +25%.');
                    } else {
                        s.resources.integrity = Math.max(0, s.resources.integrity - 15);
                        s.log.push('⚠ DECISION: Capacitor overload! Surge damaged the power bus. Integrity −15%.');
                    }
                }
            }
        ]
    },
    {
        id: 'crew_fatigue',
        title: 'Crew Fatigue Alert',
        description: 'Flight surgeon reports crew showing signs of acute fatigue. Cognitive performance is impaired. Do you authorize a mandatory rest period?',
        options: [
            {
                label: 'Authorize Rest',
                desc: 'Oxygen −10%, Battery −5%. Crew sharp.',
                action: (s) => {
                    s.resources.oxygen  = Math.max(0, s.resources.oxygen  - 10);
                    s.resources.battery = Math.max(0, s.resources.battery - 5);
                    s.log.push('◈ DECISION: Crew rest authorized. Morale restored. Resources consumed.');
                }
            },
            {
                label: 'Push Forward',
                desc: 'Save resources, but risk navigation error.',
                action: (s) => {
                    if (Math.random() > 0.5) {
                        // 50% chance: no consequence
                        s.log.push('◈ DECISION: Crew performed under pressure. Schedule maintained.');
                    } else {
                        // 50% chance: navigation error wastes fuel
                        s.resources.fuel = Math.max(0, s.resources.fuel - 12);
                        s.log.push('⚠ DECISION: Navigation error due to crew fatigue. Corrective burn wasted fuel −12%.');
                    }
                }
            }
        ]
    },
    {
        id: 'thruster_misfire',
        title: 'RCS Thruster Misfire',
        description: 'One of your reaction control thrusters fired unexpectedly, putting the spacecraft into a slow roll. You must use attitude control to correct it.',
        options: [
            {
                label: 'Manual Correction',
                desc: 'Uses battery, saves fuel.',
                action: (s) => {
                    s.resources.battery = Math.max(0, s.resources.battery - 8);
                    s.log.push('◈ DECISION: Manual correction successful using FDAI. Battery −8%.');
                }
            },
            {
                label: 'Thruster Correction',
                desc: 'Quick fix. Fuel −8%.',
                action: (s) => {
                    s.resources.fuel = Math.max(0, s.resources.fuel - 8);
                    s.log.push('◈ DECISION: RCS burst correction complete. Attitude nominal. Fuel −8%.');
                }
            }
        ]
    }
];


// ============================================================
// [3D:GLOBALS] — Three.js scene variable declarations
// ============================================================
// These are declared at the top level (outside any function) so that
// every function in the file can read and modify them. In JavaScript,
// variables declared with `let` at the top level are accessible everywhere.
//
//   scene      — The Three.js world container. Everything 3D gets added here.
//   camera     — The "eye" that sees the scene. We move it per phase to frame the action.
//   renderer   — Handles drawing the 3D scene onto the HTML canvas element.
//   spacecraft — The main CSM/LM model (the craft the player controls).
//   earth      — The Earth sphere mesh.
//   moon       — The Moon sphere mesh.
//   exhaustMesh— The engine exhaust cone (visible only when thrusting).
//   engineLight— A point light that flickers at the engine nozzle.
//   lmGroup    — The Lunar Module sub-group of the spacecraft stack.
//   lesGroup   — Launch Escape System — the tower on top of the CM.
//   saturnGroup— The Saturn V rocket body (visible only during LAUNCH).
//   launchPadGroup — The 3D launch pad structure (currently hidden; photo replaces it).
//   orbitAngle — Tracks how far the camera has rotated around the spacecraft.
//   starPoints — Array holding the two star-field Point meshes (for fade control).
//   launchpadBgEl — Reference to the HTML div that shows the launch photo background.

let scene, camera, renderer;
let spacecraft, earth, moon, earthAtmosphere;
let exhaustMesh, engineLight;
let lmGroup, lesGroup, saturnGroup, launchPadGroup;
const textureLoader = new THREE.TextureLoader(); // Reusable loader for image textures
let orbitAngle = 0;
let starPoints = [];
let launchpadBgEl = null;


// ============================================================
// [3D:SPACECRAFT] — Build the spacecraft stack (CSM + LM)
// ============================================================
// Assembles the main 3D spacecraft model from scratch using Three.js
// primitive shapes (cylinders, cones, boxes, spheres).
//
// The stack is built bottom-to-top:
//   LM (Lunar Module)             y ≈ -1.15
//   SLA Adapter                   y ≈ -0.65
//   SM (Service Module)           y ≈  0.25
//   CM (Command Module)           y ≈  0.955
//   LES (Launch Escape System)    y ≈  1.94
//
// All parts are added to `spacecraft` (a THREE.Group), so moving or
// rotating `spacecraft` moves the entire stack as one unit.
//
// THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
// THREE.ConeGeometry(radius, height, segments)
// THREE.BoxGeometry(width, height, depth)
// THREE.MeshStandardMaterial({ color, metalness, roughness })
//   color     — hex color, e.g. 0xff0000 = red
//   metalness — 0 = plastic/matte, 1 = fully metallic
//   roughness — 0 = mirror smooth, 1 = fully rough/matte

function buildSpacecraft() {
    // A THREE.Group is an invisible container — it has no geometry of its own
    // but lets you move/rotate/scale everything inside it together.
    spacecraft = new THREE.Group();

    // ---- [3D:SPACECRAFT:LES] Launch Escape System ----
    // The tall thin tower on top of the CM. Jettisoned after LAUNCH.
    // In a real emergency it would fire a motor to pull the CM away from
    // a failing rocket. Visible in PRE_LAUNCH and LAUNCH, hidden after.
    lesGroup = new THREE.Group();

    const lesTower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 })
    );
    lesTower.position.y = 0.45;
    lesGroup.add(lesTower);

    const lesMotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 })
    );
    lesMotor.position.y = 0.0;
    lesGroup.add(lesMotor);

    // 3 small stabilizing fins around the LES motor
    for (let i = 0; i < 3; i++) {
        // Evenly space fins at 120° intervals around the motor
        const angle = (i * Math.PI * 2) / 3; // Math.PI * 2 = 360° in radians
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.18, 0.12),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        // Math.cos / Math.sin convert an angle to x/z coordinates on a circle
        fin.position.set(Math.cos(angle) * 0.09, -0.1, Math.sin(angle) * 0.09);
        fin.rotation.y = angle;
        lesGroup.add(fin);
    }

    lesGroup.position.y = 1.94; // Sits at the very top of the stack
    spacecraft.add(lesGroup);

    // ---- [3D:SPACECRAFT:CM] Command Module ----
    // The cone-shaped capsule that houses the crew. The only part that
    // returns to Earth. Silver-grey with small windows.
    const cmGroup = new THREE.Group();

    // Main cone body
    const cmCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.52, 0.85, 16),
        new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.65, roughness: 0.35 })
    );
    cmCone.position.y = 0.42;
    cmGroup.add(cmCone);

    // Brown heat shield base — faces down during re-entry
    const cmBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x3a2000, metalness: 0.2, roughness: 0.95 })
    );
    cmBase.position.y = -0.04;
    cmGroup.add(cmBase);

    // 3 small windows (semi-transparent blue discs)
    for (let i = 0; i < 3; i++) {
        const wAngle = (i / 3) * Math.PI * 2; // 120° apart
        const win = new THREE.Mesh(
            new THREE.CircleGeometry(0.065, 8),
            new THREE.MeshStandardMaterial({
                color: 0x88aaff,
                metalness: 0.1,
                roughness: 0.0,
                transparent: true,   // Allows opacity < 1
                opacity: 0.75,
                emissive: 0x223366, // Emissive = color the material glows on its own
                emissiveIntensity: 0.5
            })
        );
        const r = 0.38; // Radius of the circle the windows sit on
        win.position.set(Math.cos(wAngle) * r, 0.5, Math.sin(wAngle) * r);
        // lookAt makes the window face outward from the CM center
        win.lookAt(win.position.clone().multiplyScalar(3));
        cmGroup.add(win);
    }

    // 4 RCS (Reaction Control System) thruster blocks around the CM equator
    // These small boxes represent the attitude-control thruster quads
    for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI / 2) + Math.PI / 4; // 90° apart, offset by 45°
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.06, 0.09),
            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.6 })
        );
        block.position.set(Math.cos(a) * 0.48, 0.2, Math.sin(a) * 0.48);
        cmGroup.add(block);
    }

    cmGroup.position.y = 0.955;
    spacecraft.add(cmGroup);

    // ---- [3D:SPACECRAFT:SM] Service Module ----
    // The cylindrical module below the CM. Contains the main SPS engine,
    // fuel cells, oxygen tanks, and the high-gain antenna. Jettisoned
    // just before re-entry.
    const smGroup = new THREE.Group();

    const smBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 1.25, 16),
        new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.55, roughness: 0.45 })
    );
    smGroup.add(smBody);

    // 6 equipment bay / radiator panels running lengthwise (like orange peel slices)
    const panelColors = [0xddddff, 0xffeecc, 0xddddff, 0xeeeedd, 0xddddff, 0xffeecc];
    for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI / 3); // 60° apart
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 1.1, 0.03),
            new THREE.MeshStandardMaterial({ color: panelColors[i], metalness: 0.85, roughness: 0.12 })
        );
        panel.position.set(Math.cos(a) * 0.54, 0, Math.sin(a) * 0.54);
        panel.rotation.y = a;
        smGroup.add(panel);
    }

    // SPS (Service Propulsion System) engine bell — open cone (side: BackSide renders inside)
    const engBell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.34, 0.52, 14, 1, true), // open-ended cylinder
        new THREE.MeshStandardMaterial({
            color: 0x553300,
            metalness: 0.7,
            roughness: 0.3,
            side: THREE.BackSide // Render the inside surface of the bell
        })
    );
    engBell.position.y = -0.88;
    smGroup.add(engBell);

    // Engine nozzle collar
    const engNozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.22, 14),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.2 })
    );
    engNozzle.position.y = -0.73;
    smGroup.add(engNozzle);

    // 4 RCS thruster quad blocks around the SM aft (near the engine end)
    for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2); // 90° apart
        const rcs = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.11, 0.11),
            new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.5 })
        );
        rcs.position.set(Math.cos(a) * 0.62, -0.35, Math.sin(a) * 0.62);
        smGroup.add(rcs);

        // Two small nozzle cylinders per RCS quad
        for (let j = 0; j < 2; j++) {
            const noz = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6),
                new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            noz.position.set(Math.cos(a) * 0.67, -0.33 + j * 0.06, Math.sin(a) * 0.67);
            noz.rotation.z = Math.PI / 2; // Rotate 90° so it points outward
            smGroup.add(noz);
        }
    }

    // High-Gain Antenna (HGA) — dish-shaped antenna for communication with Earth
    const hgaArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.38, 5),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
    );
    hgaArm.position.set(0.62, 0.25, 0);
    hgaArm.rotation.z = Math.PI / 2; // Rotate so it extends horizontally
    smGroup.add(hgaArm);

    const hgaDish = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.1, 10, 1, true), // open cone = dish shape
        new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.85, side: THREE.DoubleSide, roughness: 0.15 })
    );
    hgaDish.position.set(0.93, 0.25, 0);
    hgaDish.rotation.z = Math.PI / 2;
    smGroup.add(hgaDish);

    smGroup.position.y = 0.25;
    spacecraft.add(smGroup);

    // ---- [3D:SPACECRAFT:SLA] Spacecraft/LM Adapter ----
    // The tapered skirt connecting the SM to the wider LM below.
    const sla = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.70, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.2, roughness: 0.8 })
    );
    sla.position.y = -0.65;
    spacecraft.add(sla);

    // ---- [3D:SPACECRAFT:LM] Lunar Module ----
    // The spider-legged lander that separates to descend to the Moon.
    // Has a descent stage (bottom, gold foil, 4 legs) and an ascent stage
    // (top, boxy, with windows). Visible until after ASCENT phase.
    lmGroup = new THREE.Group();

    // Descent stage — octagonal drum shape, golden thermal protection
    const lmDS = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: 0xd4a000, metalness: 0.3, roughness: 0.8 })
    );
    lmGroup.add(lmDS);

    // Gold foil thermal blanket panels around the descent stage
    for (let i = 0; i < 8; i++) {
        const a = i * (Math.PI / 4); // 8 panels at 45° intervals
        const foil = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.4, 0.03),
            new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.4 })
        );
        foil.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
        foil.rotation.y = a;
        lmGroup.add(foil);
    }

    // Descent engine bell (open cone, rendered from inside)
    const lmEngBell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.25, 0.35, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, side: THREE.BackSide })
    );
    lmEngBell.position.y = -0.38;
    lmGroup.add(lmEngBell);

    // 4 landing legs + footpads
    for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI / 2) + Math.PI / 4; // 4 legs at 90° intervals, offset 45°
        const legMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.5, roughness: 0.5 });

        // Main leg strut (angled outward using rotation.z and .x)
        const legMain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 5), legMat);
        legMain.position.set(Math.cos(a) * 0.52, -0.42, Math.sin(a) * 0.52);
        legMain.rotation.z =  Math.cos(a) * 0.65; // Tilt outward in X
        legMain.rotation.x = -Math.sin(a) * 0.65; // Tilt outward in Z
        lmGroup.add(legMain);

        // Circular footpad at the end of each leg
        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.025, 8),
            new THREE.MeshStandardMaterial({ color: 0x999999 })
        );
        pad.position.set(Math.cos(a) * 0.82, -0.73, Math.sin(a) * 0.82);
        lmGroup.add(pad);
    }

    // Ascent stage — boxy upper section that lifts off the Moon
    const lmAS = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.52, 0.68),
        new THREE.MeshStandardMaterial({ color: 0xbbaa22, metalness: 0.4, roughness: 0.65 })
    );
    lmAS.position.y = 0.48;
    lmGroup.add(lmAS);

    // Rendezvous radar antenna on top of the ascent stage
    const asAnt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    asAnt.position.set(0, 0.9, 0);
    lmGroup.add(asAnt);

    // Two small forward-facing windows on the ascent stage
    for (let i = 0; i < 2; i++) {
        const aw = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.1, 0.01),
            new THREE.MeshStandardMaterial({ color: 0x88aaff, transparent: true, opacity: 0.7, emissive: 0x223366, emissiveIntensity: 0.4 })
        );
        aw.position.set((i === 0 ? 0.14 : -0.14), 0.52, 0.345);
        lmGroup.add(aw);
    }

    lmGroup.position.y = -1.15; // LM hangs below the SLA
    spacecraft.add(lmGroup);

    // ---- [3D:SPACECRAFT:ENGINE_FX] Engine glow and exhaust effects ----
    // These are only visible when isThrusting is true (see [LOOP:ENGINE_FX]).

    // Point light — glows orange at the engine, lights surrounding geometry
    engineLight = new THREE.PointLight(0xff6600, 0, 10);
    engineLight.position.y = -2.5;
    spacecraft.add(engineLight);

    // Exhaust cone — a translucent orange cone rendered with additive blending
    // (additive blending makes overlapping transparent objects brighter, like real fire)
    const exhaustGeo = new THREE.ConeGeometry(0.45, 2.8, 12);
    exhaustMesh = new THREE.Mesh(exhaustGeo, new THREE.MeshBasicMaterial({
        color: 0xff8822,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending, // Adds color on top of whatever is behind it
        depthWrite: false,                // Don't write to the depth buffer (transparency trick)
        side: THREE.BackSide              // Render the inside of the cone so it looks volumetric
    }));
    exhaustMesh.position.y = -12.2; // Positioned far below, at the Saturn V F-1 engines on launch
    exhaustMesh.rotation.x = Math.PI; // Flip upside-down so the cone points downward
    exhaustMesh.visible = false;      // Hidden by default; shown in [LOOP:ENGINE_FX]
    spacecraft.add(exhaustMesh);

    // Small glow sphere at the engine nozzle opening
    const glowSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshBasicMaterial({
            color: 0xff9900,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    glowSphere.position.y = -2.2;
    glowSphere.visible = false;
    spacecraft.add(glowSphere);
    // userData is a plain object you can attach to any Three.js object
    // for storing custom data — here we save a reference for easy access later
    spacecraft.userData.glowSphere = glowSphere;

    // Add the fully assembled spacecraft stack to the 3D scene
    scene.add(spacecraft);
}


// ============================================================
// [3D:EARTH] — Build the Earth sphere
// ============================================================
// Creates a large textured sphere for Earth plus a slightly larger
// transparent sphere on top to simulate the atmosphere glow.
// The texture is loaded from the Three.js CDN (public domain NASA imagery).
//
// earth.position is updated every frame by [LOOP:SCENE_POSITIONS]
// depending on which phase the mission is in.

function buildEarth() {
    const earthTex = textureLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'
    );

    earth = new THREE.Mesh(
        new THREE.SphereGeometry(8, 64, 64), // radius 8, 64 horizontal/vertical segments (smooth)
        new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.8, metalness: 0.0 })
    );

    // Atmosphere halo — a slightly larger sphere rendered from the inside,
    // with additive blending to create a soft blue glow at the edges
    earthAtmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(8.55, 32, 32),
        new THREE.MeshBasicMaterial({
            color: 0x2244ff,
            transparent: true,
            opacity: 0.13,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,  // Render inside of sphere, seen from outside
            depthWrite: false
        })
    );
    // Adding earthAtmosphere as a child of earth means it automatically
    // moves/rotates with Earth — no separate position management needed
    earth.add(earthAtmosphere);

    earth.position.set(0, -12, -8); // Default position (near-Earth view)
    scene.add(earth);
}


// ============================================================
// [3D:MOON] — Build the Moon sphere
// ============================================================
// Creates a textured grey sphere for the Moon.
// Much smaller than Earth (radius 2.2 vs 8).
// Position is updated per-phase in [LOOP:SCENE_POSITIONS].

function buildMoon() {
    const moonTex = textureLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg'
    );

    moon = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 32, 32),
        new THREE.MeshStandardMaterial({ map: moonTex, roughness: 0.95, metalness: 0.0 })
    );
    moon.position.set(22, 12, -55); // Initial position — far upper-right
    scene.add(moon);
}


// ============================================================
// [3D:STARS] — Build the star field
// ============================================================
// Creates two layers of stars using THREE.Points — a fast way to render
// thousands of dots without creating individual mesh objects.
//
// Each layer is a BufferGeometry (an efficient array of vertex positions)
// with a PointsMaterial (renders each vertex as a square dot).
//
//   count  — number of stars in this layer
//   size   — visual size of each dot (pixels)
//   spread — how far from center the stars are scattered (2400 = very far)
//
// Both layers are stored in starPoints[] so [LOOP:BACKGROUND] can fade
// them in/out during the launch sequence.

function buildStarField() {
    [
        { count: 10000, size: 0.55, spread: 2400 }, // Dense layer of small stars
        { count: 1200,  size: 1.4,  spread: 2000 }, // Sparse layer of brighter stars
    ].forEach(({ count, size, spread }) => {
        const geo   = new THREE.BufferGeometry();
        const verts = [];

        // Generate random (x, y, z) positions within a cube of side `spread`
        for (let i = 0; i < count; i++) {
            verts.push(
                THREE.MathUtils.randFloatSpread(spread), // random float between -spread/2 and +spread/2
                THREE.MathUtils.randFloatSpread(spread),
                THREE.MathUtils.randFloatSpread(spread)
            );
        }

        // Float32BufferAttribute packs the flat array into a typed buffer
        // that the GPU can read directly — 3 values per vertex (x, y, z)
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

        const pts = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: 0xffffff,
                size,
                sizeAttenuation: true, // Stars appear smaller when far from camera
                transparent: true      // Allows opacity changes for fade-in effect
            })
        );
        scene.add(pts);
        starPoints.push(pts); // Store reference for fade control in [LOOP:BACKGROUND]
    });
}


// ============================================================
// [3D:LAUNCHPAD] — Build the Saturn V rocket and launch pad
// ============================================================
// Assembles the Saturn V rocket (three stages + engine bells + fins)
// and the ground launch pad structure (Mobile Launcher Platform,
// support pedestals, flame trench, LUT tower, swing arms).
//
// NOTE: The launchPadGroup (ground structures) is currently always hidden
// because the real NASA photo (assets/launchpad.jpg) replaces it during
// PRE_LAUNCH. If you want to see the 3D pad, change `launchPadGroup.visible`
// to true in [LOOP:SCENE_POSITIONS].
//
// The Saturn V (saturnGroup) is only visible during LAUNCH — it rises with
// the spacecraft and disappears when the spacecraft enters orbit.
//
// Rocket stage layout (bottom to top):
//   S-IC  (1st stage) — 5× F-1 engines, 4 fins, widest
//   S-II  (2nd stage) — 5× J-2 engines, narrower
//   S-IVB (3rd stage) — 1× J-2 engine, narrowest
//   [spacecraft stack connects here]

function buildLaunchPadScene() {

    // ---- Saturn V Rocket Body ----
    // Sits below the spacecraft stack; top attaches at SLA bottom (world y ≈ -0.925)
    saturnGroup = new THREE.Group();

    // Shared materials — defined once, reused across many meshes to save memory
    const whiteMat  = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, metalness: 0.15, roughness: 0.75 });
    const blackMat  = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2,  roughness: 0.8  });
    const steelMat  = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6,  roughness: 0.5  });

    // — S-IVB (3rd stage) — connects directly to SLA bottom
    const sivb = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 2.0, 16), whiteMat);
    sivb.position.y = -1.925; // center = SLA-bottom(-0.925) - half-height(1.0)
    saturnGroup.add(sivb);

    // S-IVB black instrument unit band at top (electronics ring)
    const iuBand = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 16), blackMat);
    iuBand.position.y = -1.025;
    saturnGroup.add(iuBand);

    // S-IVB black retro-rocket band at bottom
    const retroBand = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 16), blackMat);
    retroBand.position.y = -2.75;
    saturnGroup.add(retroBand);

    // S-IVB single J-2 engine bell (open cone)
    const j2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.26, 0.46, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.85, side: THREE.BackSide })
    );
    j2.position.y = -3.13;
    saturnGroup.add(j2);

    // — Interstage S-IVB / S-II (tapered connector ring between stages) —
    const is23 = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.88, 0.65, 16), whiteMat);
    is23.position.y = -3.57;
    saturnGroup.add(is23);

    // — S-II (2nd stage) —
    const sii = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 2.9, 16), whiteMat);
    sii.position.y = -5.32;
    saturnGroup.add(sii);

    // S-II black LOX (liquid oxygen) tank band
    const siiBlack = new THREE.Mesh(new THREE.CylinderGeometry(0.90, 0.90, 0.22, 16), blackMat);
    siiBlack.position.y = -4.5;
    saturnGroup.add(siiBlack);

    // S-II five J-2 engine bells: 4 outer (90° apart) + 1 center
    for (let i = 0; i < 5; i++) {
        const angle  = i < 4 ? i * (Math.PI / 2) : 0; // 4 outer at 90° each, center at 0
        const radius = i < 4 ? 0.48 : 0;               // Outer engines offset from center
        const bell   = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.17, 0.38, 10, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, side: THREE.BackSide })
        );
        bell.position.set(Math.cos(angle) * radius, -6.97, Math.sin(angle) * radius);
        saturnGroup.add(bell);
    }

    // — Interstage S-II / S-IC (black separation band) —
    const is12 = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.65, 16), blackMat);
    is12.position.y = -7.45;
    saturnGroup.add(is12);

    // — S-IC (1st stage — widest, most powerful) —
    const sic = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 3.8, 16), whiteMat);
    sic.position.y = -9.57;
    saturnGroup.add(sic);

    // S-IC black LOX/RP-1 tank band stripes (two bands)
    [-8.2, -9.8].forEach(y => {
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.90, 0.90, 0.22, 16), blackMat);
        stripe.position.y = y;
        saturnGroup.add(stripe);
    });

    // 4 large aerodynamic fins at the base of S-IC
    for (let i = 0; i < 4; i++) {
        const angle = i * (Math.PI / 2); // 90° apart
        const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 1.8, 0.07),
            new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.8 })
        );
        fin.position.set(Math.cos(angle) * 0.95, -10.6, Math.sin(angle) * 0.95);
        fin.rotation.y = angle + Math.PI / 4; // Rotate 45° so fins face diagonally
        saturnGroup.add(fin);
    }

    // 5 massive F-1 engine bells at the base of S-IC (4 outer + 1 center)
    for (let i = 0; i < 5; i++) {
        const angle  = i < 4 ? i * (Math.PI / 2) : 0;
        const radius = i < 4 ? 0.52 : 0;
        const f1 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.24, 0.5, 12, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x2a1800, metalness: 0.8, roughness: 0.3, side: THREE.BackSide })
        );
        f1.position.set(Math.cos(angle) * radius, -11.58, Math.sin(angle) * radius);
        saturnGroup.add(f1);
    }

    scene.add(saturnGroup);

    // ---- Launch Pad Structure ----
    // This group holds all the ground structures at LC-39.
    // Currently hidden (launchPadGroup.visible = false in [LOOP:SCENE_POSITIONS])
    // because the photo background replaces it.
    launchPadGroup = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x666655, roughness: 0.97, metalness: 0.0 });
    const metalMat    = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6,  metalness: 0.5 });

    // Mobile Launcher Platform (MLP) — the large flat deck the rocket stands on
    const mlp = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 7), concreteMat);
    mlp.position.y = -12.15;
    launchPadGroup.add(mlp);

    // 4 support pedestals under the MLP corners
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI / 2) + Math.PI / 4;
        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.5, 0.9), concreteMat);
        pedestal.position.set(Math.cos(angle) * 2.8, -13.8, Math.sin(angle) * 2.8);
        launchPadGroup.add(pedestal);
    }

    // Flame trench — the dark pit below the engines that channels exhaust
    const trench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    trench.position.y = -12.45;
    launchPadGroup.add(trench);

    // Large circular ground disc (the crawlerway apron)
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x2e2e22, roughness: 1.0 }));
    ground.position.y = -15.2;
    launchPadGroup.add(ground);

    // Flat green Florida scrubland terrain plane (200×200 units wide)
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x1a2a12, roughness: 1.0 }));
    terrain.rotation.x = -Math.PI / 2; // Lay flat (planes are vertical by default)
    terrain.position.y = -15.4;
    launchPadGroup.add(terrain);

    // Launch Umbilical Tower (LUT) — the tall service tower next to the rocket
    // Two vertical steel columns side by side
    const lutCore = new THREE.Mesh(new THREE.BoxGeometry(0.55, 14, 0.55), metalMat);
    lutCore.position.set(-3.8, -5.5, 0.3);
    launchPadGroup.add(lutCore);

    const lutCore2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 14, 0.55), metalMat);
    lutCore2.position.set(-3.8, -5.5, -0.3);
    launchPadGroup.add(lutCore2);

    // LUT horizontal cross-beams (7 levels of scaffolding)
    for (let i = 0; i < 7; i++) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 0.08), steelMat);
        beam.position.set(-1.9, -11.5 + i * 2.0, 0.3); // Each beam 2 units higher than the last
        launchPadGroup.add(beam);

        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.65), steelMat);
        brace.position.set(-3.8, -11.5 + i * 2.0, 0);
        launchPadGroup.add(brace);
    }

    // 3 swing arms at different heights — the arms that connect the tower to the rocket
    [[0, -2.0], [0, -5.5], [0, -8.5]].forEach(([z, y]) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.1), steelMat);
        arm.position.set(-2.1, y, z);
        launchPadGroup.add(arm);
        // Small bracket at the tip where the arm meets the rocket
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), metalMat);
        tip.position.set(-0.3, y, z);
        launchPadGroup.add(tip);
    });

    // Water deluge pipes — horizontal pipes that spray water during ignition
    for (let i = 0; i < 3; i++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5, 6), metalMat);
        pipe.rotation.z = Math.PI / 2; // Rotate to horizontal
        pipe.position.set(0, -11.9, -1.5 + i * 1.5);
        launchPadGroup.add(pipe);
    }

    scene.add(launchPadGroup);
}


// ============================================================
// [3D:INIT] — Initialize the Three.js scene
// ============================================================
// Called once on page load. Creates the scene, camera, renderer,
// sets up lighting, then builds all 3D objects by calling the
// build functions above.
//
// After this runs, the scene is populated and ready for animate()
// to start drawing frames.

function initThree() {
    // The Scene holds everything — lights, meshes, cameras
    scene = new THREE.Scene();

    // PerspectiveCamera(fov, aspectRatio, nearClip, farClip)
    //   fov        — Field of view in degrees (60 = natural-looking)
    //   aspectRatio— Width/height of the canvas
    //   nearClip   — Anything closer than 0.1 units is invisible (prevents z-fighting)
    //   farClip    — Anything farther than 3000 units is invisible (performance)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);

    // WebGLRenderer draws the scene using the GPU via WebGL
    // alpha: true — allows the canvas background to be transparent
    // antialias: true — smooths jagged edges
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // Transparent clear color (second arg = alpha)
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2× for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap; // Soft shadow edges
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Grab the HTML div that holds the launch photo, for opacity control in [LOOP:BACKGROUND]
    launchpadBgEl = document.getElementById('launchpad-bg');

    // ---- Lighting ----
    // AmbientLight(color, intensity) — fills all surfaces equally, no shadows.
    // The blue-grey tint gives everything a space-like cool tone.
    scene.add(new THREE.AmbientLight(0x223355, 0.6));

    // DirectionalLight — like sunlight, parallel rays casting shadows.
    // Positioned upper-right-front to light the spacecraft face-on.
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(8, 5, 6);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Dim blue fill light from the opposite side to prevent pure-black shadows
    const fillLight = new THREE.DirectionalLight(0x3344aa, 0.25);
    fillLight.position.set(-5, -2, -4);
    scene.add(fillLight);

    // Build all the 3D objects and add them to the scene
    buildSpacecraft();
    buildEarth();
    buildMoon();
    buildStarField();
    buildLaunchPadScene();

    // Starting camera position (will be overridden immediately by [LOOP:CAMERA])
    camera.position.set(0, -3, 10);
    camera.lookAt(0, 0, 0);
}


// ============================================================
// [LOOP:ANIMATE] — Main animation loop (runs ~60× per second)
// ============================================================
// requestAnimationFrame(animate) tells the browser to call animate()
// again on the next screen refresh — this creates an infinite loop
// that drives the entire 3D animation.
//
// Every frame this function:
//   1. [LOOP:BACKGROUND]   — Controls photo opacity, star fade, sky color
//   2. [LOOP:SPACECRAFT]   — Rotates and pitches the spacecraft
//   3. [LOOP:CAMERA]       — Moves the camera based on phase
//   4. [LOOP:ENGINE_FX]    — Shows/hides exhaust, glow, and engine light
//   5. [LOOP:VISIBILITY]   — Shows/hides LES, LM based on phase
//   6. [LOOP:SCENE_POSITIONS] — Moves Earth, Moon, Saturn V
//   7. Renders the frame   — renderer.render(scene, camera)

function animate() {
    requestAnimationFrame(animate); // Schedule the next frame
    const time = Date.now() * 0.001; // Current time in seconds (used for oscillation math)

    // ---- [LOOP:BACKGROUND] Photo, Stars, and Sky Color ----
    // This block controls three layered background elements:
    //   A) The HTML photo div (assets/launchpad.jpg) — shows during PRE_LAUNCH
    //   B) The star field (starPoints[]) — fades in as rocket leaves atmosphere
    //   C) scene.background color — transparent → sky blue → space black during LAUNCH
    {
        const isPreLaunch = state.phase === 'PRE_LAUNCH';
        const isLaunching = state.phase === 'LAUNCH';

        // launchProg: 0 at ignition, 1 when LAUNCH phase distance is complete
        const launchProg  = isLaunching
            ? Math.min(1, state.distanceTraveled / Math.max(1, state.totalDistance))
            : 0;

        // A) Photo background — fades from fully opaque to fully transparent as rocket climbs.
        // Math.max(0, ...) clamps to 0 (never negative opacity).
        // Multiplying by 1.6 makes it disappear before launchProg reaches 1.
        if (launchpadBgEl) {
            const photoOpacity = isPreLaunch ? 1 : (isLaunching ? Math.max(0, 1 - launchProg * 1.6) : 0);
            launchpadBgEl.style.opacity = photoOpacity;
        }

        // B) Stars — hidden while photo is showing, fade in once above the atmosphere.
        // They start appearing at 65% through the launch and are fully visible at 100%.
        const starOpacity = isPreLaunch ? 0 : (isLaunching ? Math.max(0, (launchProg - 0.65) / 0.35) : 1);
        starPoints.forEach(p => {
            p.visible = starOpacity > 0; // Completely hide if opacity would be 0 (saves draw calls)
            if (p.material) p.material.opacity = starOpacity;
        });

        // C) Scene background color:
        //   PRE_LAUNCH / very early launch → null (transparent, photo div shows through)
        //   Mid launch (progress 0.18–0.90) → lerp from sky blue to space black
        //   All other phases → near-black space color
        //
        // THREE.Color.lerp(target, t) blends `this` color toward `target` by factor t.
        // t=0 returns the original color, t=1 returns the target color.
        if (isPreLaunch || (isLaunching && launchProg < 0.18)) {
            scene.background = null; // Transparent — photo div shows through canvas
        } else if (isLaunching) {
            const skyBlue    = new THREE.Color(0x72b8e8); // Atmospheric blue
            const spaceBlack = new THREE.Color(0x000008); // Near-black space
            const t = Math.min(1, (launchProg - 0.18) / 0.72); // Maps 0.18→0.90 progress to 0→1
            scene.background = skyBlue.lerp(spaceBlack, t);
        } else {
            scene.background = new THREE.Color(0x000005); // Deep space black
        }

        // Hide all 3D objects during PRE_LAUNCH — the photo IS the scene at this point.
        // They become visible again as soon as LAUNCH begins.
        if (spacecraft) spacecraft.visible = !isPreLaunch;
        if (earth)      earth.visible      = !isPreLaunch;
        if (moon)       moon.visible       = !isPreLaunch;
    }

    // ---- [LOOP:SPACECRAFT] Spacecraft rotation and orientation ----
    if (spacecraft) {
        // Slow spin around the vertical axis (y) — looks like passive thermal control
        spacecraft.rotation.y += 0.0025;

        // Pitch (rotation.x) to horizontal during transit, vertical during burn phases.
        // += (target - current) * factor is a "lerp" — moves toward the target a little
        // each frame. Factor 0.03 = 3% of the remaining gap per frame → smooth transition.
        const horizontalPhases = ['TRANSIT_TO_MOON', 'TRANSIT_TO_EARTH'];
        const targetPitch = horizontalPhases.includes(state.phase) ? Math.PI / 2 : 0;
        spacecraft.rotation.x += (targetPitch - spacecraft.rotation.x) * 0.03;

        // Vibration during engine burns — a tiny oscillating x/z offset
        // Math.sin(time * frequency) * amplitude creates a sine-wave oscillation
        if (['LAUNCH', 'RE_ENTRY'].includes(state.phase) && !state.isPaused) {
            spacecraft.position.x = Math.sin(time * 14) * 0.04;
            spacecraft.position.z = Math.cos(time * 11) * 0.03;
        } else {
            // Damp the vibration back to zero by multiplying by 0.9 each frame
            spacecraft.position.x *= 0.9;
            spacecraft.position.z *= 0.9;
        }
    }

    // ---- [LOOP:CAMERA] Phase-specific camera behaviour ----
    // The camera is repositioned every frame to frame the action appropriately
    // for the current phase. isNavView is the top-down trajectory map mode.
    if (!game.isNavView && spacecraft) {

        if (state.phase === 'PRE_LAUNCH') {
            // Slow low-angle orbit around the launch pad, looking up toward where
            // the rocket will be. The photo provides the actual visual backdrop.
            orbitAngle += 0.0018;
            const padCamR = 14; // Camera orbit radius
            camera.position.set(
                Math.sin(orbitAngle) * padCamR,
                -5,                              // Low camera height (ground-level perspective)
                Math.cos(orbitAngle) * padCamR
            );
            camera.lookAt(0, -2, 0); // Look slightly downward at pad center

        } else if (state.phase === 'LAUNCH') {
            // Camera rises with the rocket — starts at ground level, climbs to orbit view.
            // THREE.MathUtils.lerp(a, b, t) linearly interpolates between a and b.
            // At progress=0 we get `a`, at progress=1 we get `b`.
            orbitAngle += 0.003;
            const progress = Math.min(1, state.distanceTraveled / Math.max(1, state.totalDistance));
            const camY     = THREE.MathUtils.lerp(-4, 3, progress);   // Rise from y=-4 to y=3
            const camR     = THREE.MathUtils.lerp(14, 9, progress);   // Pull in from radius 14 to 9
            const lookY    = THREE.MathUtils.lerp(-2, 1, progress);   // Tilt gaze upward
            camera.position.set(
                Math.sin(orbitAngle) * camR,
                camY,
                Math.cos(orbitAngle) * camR
            );
            camera.lookAt(0, lookY, 0);

        } else {
            // Standard slow orbit for all other phases.
            // A sine-wave `inclination` gently rocks the camera up and down over time,
            // giving the orbit a slightly varied angle (not perfectly equatorial).
            orbitAngle += 0.0032;
            const inclination = Math.sin(time * 0.07) * 0.32; // Slow oscillation ±18°
            const camR = 7.5;
            camera.position.set(
                Math.sin(orbitAngle) * camR * Math.cos(inclination),
                1.5 + Math.sin(inclination) * camR * 0.5,
                Math.cos(orbitAngle) * camR * Math.cos(inclination)
            );
            camera.lookAt(spacecraft.position);
        }
    }

    // ---- [LOOP:ENGINE_FX] Engine exhaust and glow effects ----
    // Exhaust and engine light are only active when thrusting.
    // The exhaust cone is bigger during Saturn V launch than during later burns.
    const isThrusting = ['LAUNCH', 'LANDING', 'ASCENT', 'RE_ENTRY'].includes(state.phase) && !state.isPaused;
    const isLaunch    = state.phase === 'LAUNCH';

    if (exhaustMesh) {
        exhaustMesh.visible = isThrusting;
        if (isThrusting) {
            // Animate plume size with a sine wave to simulate flickering thrust
            const plumeSz = isLaunch
                ? (1.8 + Math.sin(time * 18) * 0.25)  // Large Saturn V plume
                : (0.5 + Math.sin(time * 18) * 0.08); // Smaller SM/LM plume
            exhaustMesh.scale.setScalar(plumeSz); // Scale uniformly in all 3 axes

            // Position the exhaust below the correct engine:
            //   During LAUNCH → below Saturn V F-1 engines at y=-12.2
            //   Otherwise     → below the SM SPS engine at y=-2.5
            exhaustMesh.position.y = isLaunch ? -12.2 : -2.5;

            // Flicker opacity with a sine wave
            exhaustMesh.material.opacity = isLaunch
                ? 0.5  + Math.sin(time * 20) * 0.12
                : 0.3  + Math.sin(time * 18) * 0.08;
        }
    }

    // Move the engine glow sphere to the right nozzle position
    if (spacecraft?.userData.glowSphere) {
        spacecraft.userData.glowSphere.visible = isThrusting;
        spacecraft.userData.glowSphere.position.y = isLaunch ? -11.5 : -1.8;
    }

    // Animate the engine point light — it flickers and fades smoothly on/off
    if (engineLight) {
        engineLight.intensity = isThrusting
            ? 2.5 + Math.sin(time * 22) * 1.1   // Flickering orange glow while thrusting
            : Math.max(0, engineLight.intensity - 0.08); // Smooth fade-out when not thrusting
        engineLight.position.y = isLaunch ? -11.5 : -1.8;
    }

    // ---- [LOOP:VISIBILITY] Phase-dependent component visibility ----

    // LES (Launch Escape System) tower: visible on pad and during launch only.
    // After LAUNCH it's jettisoned — the game hides it automatically.
    if (lesGroup) {
        const jettisoned = !['PRE_LAUNCH', 'LAUNCH'].includes(state.phase);
        lesGroup.visible = !jettisoned;
    }

    // LM (Lunar Module): visible until after ASCENT. Once the LM has rendezvoused
    // with the CM and the crew has transferred, it's no longer needed.
    if (lmGroup) {
        const lmPhases = ['LAUNCH', 'TRANSIT_TO_MOON', 'LUNAR_ORBIT', 'LANDING', 'LUNAR_SURFACE'];
        lmGroup.visible = lmPhases.includes(state.phase);
    }

    // Slowly rotate Earth and Moon on their own axes (cosmetic only)
    if (earth) earth.rotation.y += 0.00035; // Earth rotates faster
    if (moon)  moon.rotation.y  += 0.0007;  // Moon rotates slower (tidally locked IRL, but looks nice)

    // Run the position/visibility update logic, then draw the frame
    updateScenePositions(time);
    renderer.render(scene, camera); // Draw everything to the canvas
}


// ============================================================
// [LOOP:SCENE_POSITIONS] — Move Earth, Moon, and Saturn V
// ============================================================
// Called every frame from animate(). Moves celestial bodies and the
// Saturn V to the correct positions for the current phase.
//
// position.lerp(target, factor) smoothly slides an object toward
// `target`. Factor 0.04 moves 4% of the remaining distance each frame,
// giving a smooth glide rather than an instant jump.
//
// In the NAV view (top-down trajectory map), everything is repositioned
// to show a top-down diagram of the Earth–Moon system.

function updateScenePositions(time) {
    // Group phases by where the camera should be focused
    const isNearEarth = ['PRE_LAUNCH', 'LAUNCH', 'RE_ENTRY', 'MISSION_COMPLETE'].includes(state.phase);
    const isNearMoon  = ['LUNAR_ORBIT', 'LANDING', 'LUNAR_SURFACE', 'ASCENT'].includes(state.phase);

    // ---- Saturn V & launch pad visibility ----
    // launchPadGroup stays hidden — the NASA photo replaces it during PRE_LAUNCH.
    // saturnGroup only appears during LAUNCH (it rises with the rocket, then disappears).
    const onPad    = state.phase === 'PRE_LAUNCH';
    const launching = state.phase === 'LAUNCH';
    if (saturnGroup)    saturnGroup.visible    = launching;
    if (launchPadGroup) launchPadGroup.visible = false;

    // During LAUNCH: lift the entire Saturn V + spacecraft upward as it climbs.
    // liftTarget lerps from 0 (ground) to 22 (high altitude) as progress goes 0→1.
    if (launching && spacecraft) {
        const progress   = Math.min(1, state.distanceTraveled / Math.max(1, state.totalDistance));
        const liftTarget = THREE.MathUtils.lerp(0, 22, progress);
        // Move spacecraft toward liftTarget by 2% per frame
        spacecraft.position.y += (liftTarget - spacecraft.position.y) * 0.02;
        if (saturnGroup) {
            saturnGroup.position.y = spacecraft.position.y; // Keep Saturn V locked to spacecraft
        }
    } else if (!launching && spacecraft) {
        // Gently reset spacecraft y back to 0 when not launching
        spacecraft.position.y += (0 - spacecraft.position.y) * 0.04;
        if (saturnGroup) saturnGroup.position.y = 0;
    }

    // ---- Celestial body positions ----
    if (game.isNavView) {
        // TOP-DOWN NAVIGATION MAP VIEW
        // Camera looks straight down, Earth is to the left, Moon to the right.
        // The spacecraft moves horizontally across the gap based on phase index.
        camera.position.lerp(new THREE.Vector3(0, 120, 5), 0.04);
        camera.lookAt(0, 0, 0);
        earth.position.lerp(new THREE.Vector3(-55, 0, 0), 0.04);
        moon.position.lerp(new THREE.Vector3(55, 0, 0), 0.04);
        // Spacecraft x position maps from Earth (-55) to Moon (+55) based on phase progress
        spacecraft.position.x += (THREE.MathUtils.lerp(-55, 55, PHASES.indexOf(state.phase) / (PHASES.length - 1)) - spacecraft.position.x) * 0.04;
        spacecraft.position.z += (0 - spacecraft.position.z) * 0.04;

    } else {
        // NORMAL 3D VIEW — positions vary by phase

        if (isNearEarth && state.phase !== 'LAUNCH') {
            // Post-launch near-Earth phases (RE_ENTRY, MISSION_COMPLETE):
            // Earth fills the lower background, Moon is a distant object upper-right
            earth.position.lerp(new THREE.Vector3(0, -12, -8), 0.04);
            moon.position.lerp(new THREE.Vector3(22, 12, -55), 0.04);

        } else if (state.phase === 'PRE_LAUNCH') {
            // PRE_LAUNCH — Earth just at the horizon (partially hidden by photo anyway)
            earth.position.lerp(new THREE.Vector3(12, -18, -30), 0.04);
            moon.position.lerp(new THREE.Vector3(22, 12, -55), 0.04);

        } else if (isNearMoon) {
            // Lunar phases (LUNAR_ORBIT, LANDING, LUNAR_SURFACE, ASCENT):
            // Moon dominates the lower foreground, Earth is tiny and far away
            earth.position.lerp(new THREE.Vector3(-8, -50, -120), 0.04);
            moon.position.lerp(new THREE.Vector3(0, -6, -3), 0.04);

        } else if (state.phase === 'TRANSIT_TO_MOON') {
            // Deep space outbound leg: Moon is a growing sphere ahead,
            // Earth recedes as a small dot far behind and below.
            // (Both are far away — z=-55 and z=-130 — creating a true deep-space feel.)
            moon.position.lerp(new THREE.Vector3(0, -4, -55), 0.03);
            earth.position.lerp(new THREE.Vector3(-5, -22, -130), 0.03);

        } else if (state.phase === 'TRANSIT_TO_EARTH') {
            // Deep space return leg: Earth grows ahead as home approaches,
            // Moon diminishes as a small dot far behind.
            earth.position.lerp(new THREE.Vector3(0, -7, -50), 0.03);
            moon.position.lerp(new THREE.Vector3(6, -18, -130), 0.03);

        } else {
            // Fallback for any phase not explicitly handled above
            earth.position.lerp(new THREE.Vector3(-8, -50, -120), 0.04);
            moon.position.lerp(new THREE.Vector3(0, -6, -3), 0.04);
        }

        // Keep spacecraft at x=0, z=0 (y is handled by the LAUNCH lift code above)
        spacecraft.position.x += (0 - spacecraft.position.x) * 0.06;
        spacecraft.position.z += (0 - spacecraft.position.z) * 0.06;
    }
}


// ============================================================
// [UI:GAUGES] — Segmented gauge renderer
// ============================================================
// Renders one of the four instrument panel gauges (Fuel, O₂, Battery,
// Integrity) as a row of 20 colored segments, similar to a real
// instrument panel bar display.
//
// Parameters:
//   gaugeId — id of the <div> that holds the segment cells
//   panelId — id of the outer panel <div> (gets 'panel-critical' class if low)
//   ledId   — id of the LED dot (changes color green→amber→red)
//   textId  — id of the text readout showing the percentage
//   value   — current resource level (0–100)
//
// Each segment is a small colored <div>:
//   seg-g = green (> 50%)
//   seg-a = amber (25–50%)
//   seg-r = red   (≤ 25%)
//   seg-d = dark  (unlit / empty segment)

function renderGauge(gaugeId, panelId, ledId, textId, value) {
    const TOTAL = 20; // Total number of segments in the bar

    // How many segments should be lit? Round value/5 to get a count from 0 to 20.
    const lit = Math.max(0, Math.min(TOTAL, Math.round(value / 5)));

    // Pick the color class based on current level
    let segCls;
    if (value > 50)      segCls = 'seg-g'; // Green — healthy
    else if (value > 25) segCls = 'seg-a'; // Amber — caution
    else                 segCls = 'seg-r'; // Red — critical

    // Build the row of 20 <div> cells. Array.from({length: 20}) creates an
    // array of 20 items, then .map() turns each into an HTML string.
    const gauge = document.getElementById(gaugeId);
    if (gauge) {
        gauge.innerHTML = Array.from({ length: TOTAL }, (_, i) =>
            `<div class="seg ${i < lit ? segCls : 'seg-d'}"></div>` // lit or dark
        ).join('');
    }

    // Update the LED indicator color
    const led = document.getElementById(ledId);
    if (led) {
        led.className = `ip-led ${value <= 15 ? 'led-crit' : value <= 30 ? 'led-warn' : 'led-ok'}`;
    }

    // Add/remove the panel-critical class (flashes the panel border red)
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle('panel-critical', value <= 15);

    // Update the numeric readout (e.g. "73.4%")
    const txt = document.getElementById(textId);
    if (txt) txt.innerText = value.toFixed(1) + '%';
}


// ============================================================
// [UI:HUD] — Full HUD and mission log update
// ============================================================
// Called after every game tick and phase transition to sync the HTML
// interface with the current game state. Updates:
//   — All four gauges (via renderGauge)
//   — Day counter, phase label, distance traveled
//   — Mission log (the scrolling terminal in the bottom-left)
//   — DSKY warning lights (TEMP for hull, UPLINK for running state)
//   — DSKY digit display
//   — Action buttons (see updateActions below)

function updateUI() {
    // Render all four resource gauges
    renderGauge('fuel-gauge',      'fuel-panel',      'fuel-led',      'fuel-text',      state.resources.fuel);
    renderGauge('oxygen-gauge',    'oxygen-panel',    'oxygen-led',    'oxygen-text',    state.resources.oxygen);
    renderGauge('battery-gauge',   'battery-panel',   'battery-led',   'battery-text',   state.resources.battery);
    renderGauge('integrity-gauge', 'integrity-panel', 'integrity-led', 'integrity-text', state.resources.integrity);

    // Update the mission info bar (day / phase / distance)
    const dayDisp   = document.getElementById('day-display');
    const phaseDisp = document.getElementById('phase-display');
    const distDisp  = document.getElementById('dist-display');
    if (dayDisp)   dayDisp.innerText   = Math.floor(state.day);
    if (phaseDisp) phaseDisp.innerText = PHASE_CONFIG[state.phase]?.label ?? state.phase;
    // toLocaleString() adds thousands separators, e.g. 384400 → "384,400"
    if (distDisp)  distDisp.innerText  = Math.floor(state.distanceTraveled).toLocaleString();

    // Rebuild the mission log from the state.log array.
    // Each entry gets colored by its prefix character:
    //   ⚠ = warning (red)
    //   ◈ = info (yellow)
    //   anything else = normal (green)
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.innerHTML = state.log.map((entry, i) => {
            const isWarn  = entry.startsWith('⚠');
            const isInfo  = entry.startsWith('◈');
            const color   = isWarn ? 'text-red-400' : isInfo ? 'text-yellow-300' : 'text-green-400/90';
            return `<div class="text-xs font-mono ${color} leading-relaxed mb-2">
                <span class="text-white/25 mr-1">[${i.toString().padStart(3,'0')}]</span>${entry}
            </div>`;
        }).join('');
        // Auto-scroll to the bottom so the newest entry is always visible
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // DSKY warning light: TEMP lights up when hull integrity is critically low
    dsky.setWarningLight('wl-temp',   state.resources.integrity < 30);
    // UPLINK lights up when the game is actively running (not paused or awaiting a decision)
    dsky.setWarningLight('wl-uplink', !state.isPaused && !state.isDecisionPending);

    dsky.updateDisplay();
    updateActions(); // Rebuild the action button row
}


// ============================================================
// [UI:ACTIONS] — Bottom-right action button builder
// ============================================================
// Dynamically generates the action buttons shown in the bottom-right corner.
// After mission end (success or failure), shows a "New Mission" button.
// During a normal mission, shows a "Pause / Resume" toggle.
//
// lucide.createIcons() scans the DOM for <i data-lucide="..."> elements
// and replaces them with SVG icon markup.

function updateActions() {
    const menu = document.getElementById('action-menu');
    if (!menu) return;

    let actions = [];
    if (state.phase === 'MISSION_COMPLETE' || state.phase === 'MISSION_FAILED') {
        // End of game — only option is to restart
        actions = [{ id: 'restart', label: 'New Mission', icon: 'rotate-ccw' }];
    } else {
        // During mission — pause/resume toggle; label and icon change based on current state
        actions = [
            { id: 'continue', label: state.isPaused ? 'Resume' : 'Pause', icon: state.isPaused ? 'play' : 'pause' }
        ];
    }

    // Inject the buttons as HTML strings using a template literal
    menu.innerHTML = actions.map(a => `
        <button onclick="game.handleAction('${a.id}')"
            class="bg-[#2a2a2a] border-b-4 border-r-4 border-[#1a1a1a] p-3 rounded-sm
                   text-white/60 hover:text-white transition-all shadow-lg
                   flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <i data-lucide="${a.icon}" class="w-4 h-4"></i>${a.label}
        </button>
    `).join('');
    lucide.createIcons(); // Replace <i data-lucide="..."> with SVG
}


// ============================================================
// [UI:SUPPLY_SCREEN] — Supply allocation screen logic
// ============================================================
// The supply screen lets the player distribute TOTAL_SUPPLY_UNITS (10)
// across the four resource categories before launch, like Oregon Trail.
//
// adjustSupply() is called by the +/- buttons on the supply screen.
//   key   — resource name ('fuel', 'oxygen', etc.)
//   delta — +1 or -1 (whether to add or remove a unit)
//
// updateSupplyScreen() refreshes all the bars and numbers on screen
// to match the current supplyAllocation values.

function adjustSupply(key, delta) {
    const cfg    = SUPPLY_CONFIG[key];
    const spent  = Object.values(supplyAllocation).reduce((a, b) => a + b, 0); // Total units used
    const newVal = supplyAllocation[key] + delta;

    // Prevent going below 0 or above the per-category max
    if (newVal < 0 || newVal > cfg.max) return;
    // Prevent allocating more than the total budget
    if (delta > 0 && spent >= TOTAL_SUPPLY_UNITS) return;

    supplyAllocation[key] = newVal;
    updateSupplyScreen();
}

function updateSupplyScreen() {
    const spent     = Object.values(supplyAllocation).reduce((a, b) => a + b, 0);
    const remaining = TOTAL_SUPPLY_UNITS - spent;

    // Update the "X units remaining" display
    const remEl = document.getElementById('supply-remaining');
    if (remEl) remEl.innerText = remaining;

    // Update the overall budget progress bar color
    const budgetBar = document.getElementById('supply-budget-bar');
    if (budgetBar) {
        budgetBar.style.width = `${(remaining / TOTAL_SUPPLY_UNITS) * 100}%`;
        budgetBar.className = `h-full rounded-full transition-all duration-300 ${
            remaining === 0 ? 'bg-red-500' : remaining <= 3 ? 'bg-yellow-400' : 'bg-green-400'
        }`;
    }

    // Update each resource row: unit count, total %, progress bar, +/- button states
    Object.entries(SUPPLY_CONFIG).forEach(([key, cfg]) => {
        const units = supplyAllocation[key];
        const total = Math.min(100, cfg.base + units * cfg.perUnit);

        const unitEl  = document.getElementById(`supply-${key}-units`);
        const totalEl = document.getElementById(`supply-${key}-pct`);
        const barEl   = document.getElementById(`supply-${key}-bar`);
        const plusEl  = document.getElementById(`supply-${key}-plus`);
        const minusEl = document.getElementById(`supply-${key}-minus`);

        if (unitEl)  unitEl.innerText  = units;
        if (totalEl) totalEl.innerText = `${total}%`;
        if (barEl) {
            barEl.style.width = `${total}%`;
            barEl.className = `supply-fill h-full rounded-sm transition-all duration-300 ${
                total >= 70 ? 'bg-green-400' : total >= 45 ? 'bg-yellow-400' : 'bg-red-500'
            }`;
        }
        // Disable + button if category is maxed out or budget is spent
        if (plusEl)  plusEl.disabled  = (units >= cfg.max || remaining <= 0);
        // Disable − button if category is already at 0
        if (minusEl) minusEl.disabled = (units <= 0);
    });
}


// ============================================================
// [GAME:CORE] — Core game object
// ============================================================
// The `game` object is the central controller for all game logic.
// Its methods are called by:
//   — UI buttons (onclick="game.handleAction(...)")
//   — The DSKY (game.advancePhase())
//   — The game tick interval (game.tick())
//
// Key methods:
//   advancePhase()    — moves to the next entry in PHASES[]
//   launch()          — "Begin Mission" button → supply screen
//   confirmSupplies() — supply screen "Confirm" → start game
//   restart()         — resets state and goes back to supply screen
//   handleAction()    — routes button clicks (pause/resume/restart)
//   addLog()          — pushes a message to state.log and refreshes UI
//   tick()            — the core game simulation, called every 500 ms
//   triggerDecision() — shows a random interactive event modal
//   makeDecision()    — applies the chosen option and hides the modal
//   showOverlay()     — displays the win/loss screen

const game = {
    isNavView: false, // Whether the NAV map view is currently active

    // Toggle between the normal 3D view and the top-down NAV trajectory map
    toggleNav() {
        this.isNavView = !this.isNavView;
        this.addLog(this.isNavView
            ? '◈ SWITCHING TO NAVIGATION VIEW — TRAJECTORY PLOT ACTIVE.'
            : '◈ RETURNING TO EXTERNAL VIEW.');
    },

    // [GAME:ADVANCE_PHASE] Move to the next mission phase
    // Called by dsky.execute() when the player enters the correct code.
    advancePhase() {
        const idx = PHASES.indexOf(state.phase);
        if (idx < 0 || idx >= PHASES.length - 1) return; // Already at last phase

        // Advance to the next phase and reset distance progress
        state.phase           = PHASES[idx + 1];
        state.distanceTraveled = 0;
        state.totalDistance   = PHASE_CONFIG[state.phase]?.distance ?? 0;
        state.isPaused        = false; // Unpause on phase advance

        this.addLog(`◈ PHASE TRANSITION: ${(PHASE_CONFIG[state.phase]?.label ?? '').toUpperCase()}`);

        // Special handling for the win state
        if (state.phase === 'MISSION_COMPLETE') {
            state.isPaused = true;
            this.addLog(`◈ SPLASHDOWN CONFIRMED. RECOVERY FORCES DEPLOYED.`);
            this.addLog(`◈ ${MISSION_NAME} MISSION SUCCESSFUL — 8 DAYS 3 HOURS 18 MINUTES.`);
            this.showOverlay('Mission Success',
                `${MISSION_NAME} splashdown confirmed.\nRecovery ship USS Hornet on station.\nWelcome home, crew.`);
            return;
        }

        // Tell the player what DSKY code to enter to leave the new phase
        const newCode = PHASE_CONFIG[state.phase]?.code;
        if (newCode) {
            this.addLog(`◈ STANDBY CODE: ${newCode} — ENTER TO PROCEED WHEN PHASE IS COMPLETE.`);
        } else {
            this.addLog(`◈ PHASE WILL AUTO-COMPLETE — MONITOR RESOURCES.`);
        }

        updateUI();
    },

    // Called by the "Begin Mission" button on the start screen.
    // Hides the start screen and shows the supply allocation screen.
    launch() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('supply-screen').classList.remove('hidden');
        updateSupplyScreen();
    },

    // Called by the "Confirm Supplies" button on the supply screen.
    // Resets state (incorporating supply choices) and starts the PRE_LAUNCH phase.
    confirmSupplies() {
        document.getElementById('supply-screen').classList.add('hidden');
        state = getInitialState(); // Rebuild state with current supplyAllocation
        dsky.verb = '';
        dsky.noun = '';
        dsky.inputMode = 'V';
        dsky.updateDisplay();
        this.addLog(`◈ MISSION CONTROL: T-0 HOLD RELEASED.`);
        this.addLog(`◈ ALL STATIONS CONFIRM GO/NO-GO.`);
        this.addLog(`◈ ENTER V37 N01 ON DSKY TO INITIATE LAUNCH SEQUENCE.`);
        updateUI();
    },

    // Called by the "New Mission" button after success or failure.
    // Resets supply allocation and returns to the supply screen.
    restart() {
        supplyAllocation = { fuel: 0, oxygen: 0, battery: 0, integrity: 0 };
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('decision-modal').classList.add('hidden');
        document.getElementById('supply-screen').classList.remove('hidden');
        dsky.verb = '';
        dsky.noun = '';
        dsky.inputMode = 'V';
        dsky.updateDisplay();
        updateSupplyScreen();
    },

    // Routes button clicks from the action menu.
    // Currently handles 'restart' and 'continue' (pause toggle).
    handleAction(id) {
        if (id === 'restart') { this.restart(); return; }
        if (id === 'continue') {
            state.isPaused = !state.isPaused;
            this.addLog(state.isPaused
                ? '◈ OPERATIONS PAUSED — HOLDING CURRENT CONFIGURATION.'
                : '◈ RESUMING MISSION OPERATIONS.');
        }
        updateUI();
    },

    // Appends a message to the mission log and refreshes the UI.
    // Also trims the log to the last 120 entries to prevent memory growth.
    addLog(msg) {
        state.log.push(msg);
        if (state.log.length > 120) state.log.shift(); // Remove oldest entry
        updateUI();
    },

    // ---- [GAME:TICK] The core simulation step ----
    // Called every 500 ms by setInterval in the Bootstrap section.
    // Each call is one "tick":
    //   1. Drain resources based on the current phase's consumption rates
    //   2. Roll for random background events
    //   3. Roll for interactive decision events
    //   4. Check for failure conditions (any resource at 0)
    //   5. Advance distance and time
    tick() {
        // Skip if paused, waiting for a decision, or in a terminal phase
        if (state.isPaused || state.isDecisionPending) return;
        if (state.phase === 'MISSION_COMPLETE' || state.phase === 'MISSION_FAILED') return;

        const config = PHASE_CONFIG[state.phase];
        if (!config) return;

        // Drain resources according to this phase's consumption rates.
        // Dividing by 10 because there are ~10 ticks per in-game time unit.
        // Math.max(0, ...) clamps to 0 (resources never go negative).
        Object.entries(config.consumption).forEach(([key, value]) => {
            state.resources[key] = Math.max(0, state.resources[key] - value / 10);
        });

        // Small constant life-support drain regardless of phase
        // (crew always breathes and uses power, even while coasting)
        state.resources.oxygen  = Math.max(0, state.resources.oxygen  - 0.025);
        state.resources.battery = Math.max(0, state.resources.battery - 0.015);

        // ~0.8% chance per tick of a random background event (solar flare, etc.)
        if (Math.random() < 0.008) {
            const ev = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
            ev.impact(state.resources);
            this.addLog(ev.msg);
        }

        // ~1% chance per tick of a player decision event, only during active flight (phases 1–8)
        const phaseIdx = PHASES.indexOf(state.phase);
        if (Math.random() < 0.01 && phaseIdx >= 1 && phaseIdx <= 8) {
            this.triggerDecision();
        }

        // ---- Failure checks ----
        // If any resource hits zero, the mission is over.
        const { fuel, oxygen, integrity, battery } = state.resources;
        if (fuel <= 0 || oxygen <= 0 || integrity <= 0 || battery <= 0) {
            const reason =
                fuel      <= 0 ? 'Propellant tanks empty. Main engine shutdown.'       :
                oxygen    <= 0 ? 'Life support failure — O₂ reserves exhausted.'       :
                integrity <= 0 ? 'Catastrophic structural failure — hull breach.'       :
                                 'Total power failure — all EPS buses dead.';
            state.phase    = 'MISSION_FAILED';
            state.isPaused = true;
            this.showOverlay('Mission Failure', reason);
            return; // Stop processing this tick
        }

        // ---- Distance and time advancement ----
        if (state.totalDistance > 0) {
            // Phases with a non-zero distance: advance by 1% of total distance per tick.
            // This means each distance phase takes roughly 100 ticks = 50 seconds at 500 ms/tick.
            state.distanceTraveled += (state.totalDistance / 100);
            state.day += 0.04; // Advance mission day counter

            // Phase completion when distance is reached
            if (state.distanceTraveled >= state.totalDistance) {
                state.distanceTraveled = state.totalDistance; // Clamp — don't overshoot

                if (state.phase === 'RE_ENTRY') {
                    // RE_ENTRY auto-advances to MISSION_COMPLETE (no DSKY code needed)
                    this.advancePhase();
                    return;
                }

                // All other phases: pause and wait for the player to enter the DSKY code
                state.isPaused = true;
                const code = PHASE_CONFIG[state.phase]?.code;
                this.addLog(`◈ PHASE COMPLETE: ${config.label.toUpperCase()}`);
                if (code) {
                    this.addLog(`◈ ENTER DSKY CODE: ${code} TO PROCEED TO NEXT PHASE.`);
                }
            }
        } else {
            // Zero-distance phases (PRE_LAUNCH, LUNAR_SURFACE): time passes but no distance
            state.day += 0.01;
        }

        updateUI(); // Refresh the HUD after every tick
    },

    // ---- [GAME:DECISION] Show a random interactive event modal ----
    // Picks a random event from INTERACTIVE_EVENTS, populates the modal
    // HTML with its title/description/options, then displays it.
    // Sets isDecisionPending = true to pause the tick while awaiting input.
    triggerDecision() {
        state.isDecisionPending = true;
        const event = INTERACTIVE_EVENTS[Math.floor(Math.random() * INTERACTIVE_EVENTS.length)];

        document.getElementById('decision-title').innerText = event.title;
        document.getElementById('decision-desc').innerText  = event.description;

        // Build the option buttons with onclick handlers that call game.makeDecision()
        const optionsContainer = document.getElementById('decision-options');
        optionsContainer.innerHTML = event.options.map((opt, i) => `
            <button onclick="game.makeDecision('${event.id}', ${i})"
                class="group bg-white/5 border border-white/20 p-4 rounded-lg text-left
                       hover:bg-white/10 transition-all">
                <div class="font-mono text-white text-sm uppercase mb-1 group-hover:text-yellow-400">${opt.label}</div>
                <div class="font-mono text-white/40 text-[10px] uppercase tracking-wider">${opt.desc}</div>
            </button>
        `).join('');

        document.getElementById('decision-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    // ---- [GAME:MAKE_DECISION] Apply the player's chosen option ----
    // Finds the matching event and option by id/index, runs its action
    // function, clears the pending flag, and hides the modal.
    makeDecision(eventId, optionIndex) {
        const event  = INTERACTIVE_EVENTS.find(e => e.id === eventId);
        if (!event) return;
        const option = event.options[optionIndex];
        if (!option) return;

        option.action(state); // Apply resource changes and log messages
        state.isDecisionPending = false;
        document.getElementById('decision-modal').classList.add('hidden');
        updateUI();
    },

    // ---- [GAME:OVERLAY] Show the win/loss full-screen overlay ----
    // `title` — large header (e.g. "Mission Success" / "Mission Failure")
    // `desc`  — multi-line body text
    showOverlay(title, desc) {
        document.getElementById('overlay-title').innerText = title;
        document.getElementById('overlay-desc').innerText  = desc;
        document.getElementById('overlay').classList.remove('hidden');
        // Color the title green on success, red on failure
        document.getElementById('overlay-title').className =
            `text-4xl font-mono uppercase tracking-tighter mb-4 ${
                state.phase === 'MISSION_COMPLETE' ? 'text-green-400' : 'text-red-500'
            }`;
    }
};


// ============================================================
// [GAME:BOOTSTRAP] — Page load entry point
// ============================================================
// window.onload fires once the entire page (HTML, CSS, scripts) has loaded.
// This is where everything starts:
//
//   initThree()          — Create the Three.js scene and all 3D objects
//   animate()            — Start the 60 fps animation loop
//   updateUI()           — Render initial HUD state
//   setInterval(tick, 500) — Start the game simulation at 2 ticks/second
//
// The tick interval (500 ms = 0.5 seconds) controls how fast resources
// drain and how often events fire. Changing 500 to 250 doubles the speed;
// changing it to 1000 halves it.

window.onload = () => {
    initThree();                           // Build the 3D scene
    animate();                             // Start the render loop
    updateUI();                            // Paint the initial HUD
    setInterval(() => game.tick(), 500);   // Simulation tick every 500 ms
};
