// Boxing Game: strength, agility, stamina influence outcome.
// Manual (keys/click) or Auto mode. Multiple rounds, exchanges per round.
// Controls: Start, Pause, Reset. Manual keys when auto is off:
// Red: A (light), S (heavy)
// Green: K (light), L (heavy)

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const autoModeEl = document.getElementById('autoMode');
const roundsInput = document.getElementById('roundsInput');
const exchangesInput = document.getElementById('exchangesInput');

const roundDisplay = document.getElementById('roundDisplay');
const roundNum = document.getElementById('roundNum');
const exchangesPerRoundEl = document.getElementById('exchangesPerRound');
const exchangeNum = document.getElementById('exchangeNum');

const hpRedEl = document.getElementById('hpRed');
const hpGreenEl = document.getElementById('hpGreen');
const hpRedText = document.getElementById('hpRedText');
const hpGreenText = document.getElementById('hpGreenText');

const staminaRedEl = document.getElementById('staminaRed');
const staminaGreenEl = document.getElementById('staminaGreen');
const staminaRedText = document.getElementById('staminaRedText');
const staminaGreenText = document.getElementById('staminaGreenText');

const statsRed = document.getElementById('statsRed');
const statsGreen = document.getElementById('statsGreen');

const pointsRedEl = document.getElementById('pointsRed');
const pointsGreenEl = document.getElementById('pointsGreen');

const messageEl = document.getElementById('message');
const logEl = document.getElementById('log');
const refereeEl = document.getElementById('referee');

const boxerRedEl = document.getElementById('boxerRed');
const boxerGreenEl = document.getElementById('boxerGreen');

let state = {
  roundsTotal: parseInt(roundsInput.value, 10),
  exchangesPerRound: parseInt(exchangesInput.value, 10),
  currentRound: 1,
  exchange: 0,
  running: false,
  paused: false,
  auto: autoModeEl.checked,
  timer: null,
  tickMs: 700
};

// Boxer model with attributes
function Boxer(name, attrs){
  this.name = name;
  this.maxHp = 100;
  this.hp = 100;
  this.strength = attrs.strength; // damage influence
  this.agility = attrs.agility;   // accuracy / dodge
  this.staminaMax = attrs.stamina;
  this.stamina = attrs.stamina;
  this.points = 0;
  this.knockedOut = false;
  // manual cooldowns to prevent spamming
  this.lastPunch = 0;
}
let red = new Boxer('Red', {strength: 8, agility: 7, stamina: 100});
let green = new Boxer('Green', {strength: 7, agility: 8, stamina: 100});

// Utility logging
function log(s){
  const ts = new Date().toLocaleTimeString();
  logEl.textContent = `[${ts}] ${s}\n` + logEl.textContent;
}

// UI render
function renderUI(){
  roundDisplay.textContent = state.currentRound;
  roundNum.textContent = state.currentRound;
  exchangesPerRoundEl.textContent = state.exchangesPerRound;
  exchangeNum.textContent = state.exchange;

  hpRedEl.style.width = Math.max(0, red.hp) + '%';
  hpGreenEl.style.width = Math.max(0, green.hp) + '%';
  hpRedText.textContent = Math.round(red.hp);
  hpGreenText.textContent = Math.round(green.hp);

  staminaRedEl.style.width = (Math.max(0, red.stamina) / red.staminaMax * 100) + '%';
  staminaGreenEl.style.width = (Math.max(0, green.stamina) / green.staminaMax * 100) + '%';
  staminaRedText.textContent = Math.round(red.stamina);
  staminaGreenText.textContent = Math.round(green.stamina);

  statsRed.innerHTML = `
    <div class="row"><span>Strength</span><strong>${red.strength}</strong></div>
    <div class="row"><span>Agility</span><strong>${red.agility}</strong></div>
    <div class="row"><span>Stamina</span><strong>${Math.round(red.stamina)}</strong></div>
  `;
  statsGreen.innerHTML = `
    <div class="row"><span>Strength</span><strong>${green.strength}</strong></div>
    <div class="row"><span>Agility</span><strong>${green.agility}</strong></div>
    <div class="row"><span>Stamina</span><strong>${Math.round(green.stamina)}</strong></div>
  `;

  pointsRedEl.textContent = red.points;
  pointsGreenEl.textContent = green.points;

  boxerRedEl.classList.toggle('ko', red.knockedOut);
  boxerGreenEl.classList.toggle('ko', green.knockedOut);
}

// Mechanics:
// Two punch types: light and heavy
const PUNCH = {
  LIGHT: {name:'light', accBonus: 0.12, dmgMult: 0.8, staminaCost: 6, points: 1, cooldown: 450},
  HEAVY: {name:'heavy', accBonus: -0.12, dmgMult: 1.6, staminaCost: 14, points: 2, cooldown: 900}
};

// Hit chance depends on agility, stamina, and punch modifiers
function hitChance(attacker, defender, punch){
  const base = attacker.agility / (attacker.agility + defender.agility);
  const staminaFactor = 0.45 + 0.55 * (Math.max(0, attacker.stamina) / attacker.staminaMax);
  const chance = base * staminaFactor + punch.accBonus;
  return Math.min(0.98, Math.max(0.05, chance));
}

// Damage depends on strength, random factor, punch multiplier and stamina
function computeDamage(attacker, punch){
  const rand = (3 + Math.random()*4); // 3..7
  const staminaFactor = 0.55 + 0.45 * (Math.max(0, attacker.stamina) / attacker.staminaMax);
  const dmg = Math.round(attacker.strength * rand * staminaFactor * punch.dmgMult);
  return Math.max(1, dmg);
}

function drainStamina(attacker, punch){
  attacker.stamina = Math.max(0, attacker.stamina - punch.staminaCost);
}

// perform a single punch attempt
function performPunch(attacker, defender, attackerEl, defenderEl, punchType){
  if(attacker.knockedOut || defender.knockedOut) return null;

  const now = Date.now();
  if(now - attacker.lastPunch < punchType.cooldown) {
    // too fast, ignore attempt
    return {ok:false, reason:'cooldown'};
  }
  attacker.lastPunch = now;

  // animate
  attackerEl.classList.add('punch');
  setTimeout(()=> attackerEl.classList.remove('punch'), 300);

  const chance = hitChance(attacker, defender, punchType);
  const roll = Math.random();
  const hit = roll < chance;

  if(hit){
    const dmg = computeDamage(attacker, punchType);
    // defender has small chance to partially evade based on agility
    const partialEvade = Math.random() < (0.05 * defender.agility);
    const finalDmg = partialEvade ? Math.max(1, Math.round(dmg * 0.45)) : dmg;
    defender.hp = Math.max(0, defender.hp - finalDmg);

    // award points (use punchType.points)
    attacker.points += punchType.points;

    // visual
    defenderEl.style.filter = 'brightness(1.4)';
    setTimeout(()=> defenderEl.style.filter = '', 160);

    log(`${attacker.name} ${punchType.name} hits ${defender.name} for ${finalDmg} damage (+${punchType.points} pts).`);
    // KO?
    if(defender.hp <= 0){
      defender.knockedOut = true;
      log(`${attacker.name} KO!`);
    }
  } else {
    log(`${attacker.name} ${punchType.name} misses ${defender.name}.`);
  }

  // stamina drain
  drainStamina(attacker, punchType);

  renderUI();
  return {ok:true, hit};
}

// Fight loop (auto mode): pick attacker influenced by agility and stamina
function fightTick(){
  if(!state.running || state.paused) return;

  if(red.knockedOut || green.knockedOut){
    finishMatch();
    return;
  }

  if(state.exchange >= state.exchangesPerRound){
    endRound();
    return;
  }

  // weighted selection
  const rScore = Math.random() * (red.agility + red.stamina/25 + 1);
  const gScore = Math.random() * (green.agility + green.stamina/25 + 1);
  const attacker = rScore >= gScore ? red : green;
  const defender = attacker === red ? green : red;
  const attackerEl = attacker === red ? boxerRedEl : boxerGreenEl;
  const defenderEl = defender === red ? boxerRedEl : boxerGreenEl;

  // choose punch: use stamina and random; if low stamina favor light
  const heavyProb = 0.32 * (attacker.stamina / attacker.staminaMax);
  const punchType = Math.random() < heavyProb ? PUNCH.HEAVY : PUNCH.LIGHT;

  performPunch(attacker, defender, attackerEl, defenderEl, punchType);

  state.exchange += 1;
  exchangeNum.textContent = state.exchange;

  if(red.knockedOut || green.knockedOut){
    finishMatch();
    return;
  }
}

// rounds and match management
function startMatch(){
  state.roundsTotal = Math.max(1, Math.min(12, parseInt(roundsInput.value,10) || 5));
  state.exchangesPerRound = Math.max(1, Math.min(40, parseInt(exchangesInput.value,10) || 10));
  state.auto = autoModeEl.checked;

  // if match ended previously, reset hp/flags but keep attributes
  if(red.hp <= 0 || green.hp <= 0 || red.knockedOut || green.knockedOut){
    resetMatch(false);
  }

  state.currentRound = 1;
  state.exchange = 0;
  state.running = true;
  state.paused = false;

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  autoModeEl.disabled = true;
  roundsInput.disabled = true;
  exchangesInput.disabled = true;

  roundDisplay.textContent = state.currentRound;
  roundNum.textContent = state.currentRound;
  exchangesPerRoundEl.textContent = state.exchangesPerRound;
  exchangeNum.textContent = state.exchange;

  messageEl.textContent = `Round ${state.currentRound} started`;
  log(`Match started. Auto: ${state.auto ? 'ON' : 'OFF'}. Rounds: ${state.roundsTotal}, Exchanges/Round: ${state.exchangesPerRound}`);

  if(state.auto){
    state.timer = setInterval(fightTick, state.tickMs);
  } else {
    // manual: no interval; players punch via keys/click
    log('Manual mode: use keys or click boxers to attack.');
  }
}

function endRound(){
  log(`Round ${state.currentRound} ends. Corner recovery.`);
  // both recover stamina
  const rec = 18 + Math.floor(Math.random()*10);
  red.stamina = Math.min(red.staminaMax, red.stamina + rec);
  green.stamina = Math.min(green.staminaMax, green.stamina + rec);
  renderUI();

  // stop auto timer for a pause between rounds
  if(state.timer) { clearInterval(state.timer); state.timer = null; }

  state.running = false;
  // if last round
  if(state.currentRound >= state.roundsTotal){
    decideByPoints();
  } else {
    // allow short automatic transition to next round or wait for "Start" again
    messageEl.textContent = `Round ${state.currentRound} finished. Recovering ${rec} stamina. Press Start to continue.`;
    log(`Both recovered ${rec} stamina.`);
    // enable Start to progress to next round
    startBtn.disabled = false;
    autoModeEl.disabled = false;
    roundsInput.disabled = false;
    exchangesInput.disabled = false;
  }
}

function startNextRound(){
  if(red.knockedOut || green.knockedOut) { finishMatch(); return; }
  state.currentRound += 1;
  state.exchange = 0;
  state.running = true;
  state.paused = false;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  autoModeEl.disabled = true;
  roundsInput.disabled = true;
  exchangesInput.disabled = true;
  roundDisplay.textContent = state.currentRound;
  roundNum.textContent = state.currentRound;
  exchangeNum.textContent = state.exchange;
  messageEl.textContent = `Round ${state.currentRound} started`;
  if(state.auto) state.timer = setInterval(fightTick, state.tickMs);
  log(`Round ${state.currentRound} starts.`);
}

function decideByPoints(){
  log('Match went the distance. Deciding by points...');
  if(red.points > green.points){
    log('Red wins on points!');
  } else if(green.points > red.points){
    log('Green wins on points!');
  } else {
    // tiebreaker: higher remaining HP
    if(red.hp > green.hp) log('Red wins on tiebreaker (HP).');
    else if(green.hp > red.hp) log('Green wins on tiebreaker (HP).');
    else log("It's a draw!");
  }
  finishMatch();
}

function finishMatch(){
  state.running = false;
  state.paused = false;
  clearInterval(state.timer);
  state.timer = null;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  autoModeEl.disabled = false;
  roundsInput.disabled = false;
  exchangesInput.disabled = false;
  messageEl.textContent = 'Match Over';
  refereeEl.textContent = 'Referee — Match Over';
  log('Match finished.');
}

// manual attack handlers (clicks and keypresses)
function manualAttack(attacker, defender, attackerEl, defenderEl, punchType){
  if(!state.running || state.paused) return;
  if(state.auto) return;
  if(attacker.knockedOut || defender.knockedOut) return;

  const res = performPunch(attacker, defender, attackerEl, defenderEl, punchType);
  if(res && res.ok){
    state.exchange += 1;
    exchangeNum.textContent = state.exchange;
    if(state.exchange >= state.exchangesPerRound){
      endRound();
    }
    if(defender.knockedOut) finishMatch();
  }
}

// keyboard controls
document.addEventListener('keydown', (e) => {
  if(!state.running || state.paused || state.auto) return;
  const key = e.key.toLowerCase();
  if(key === 'a'){ manualAttack(red, green, boxerRedEl, boxerGreenEl, PUNCH.LIGHT); }
  if(key === 's'){ manualAttack(red, green, boxerRedEl, boxerGreenEl, PUNCH.HEAVY); }
  if(key === 'k'){ manualAttack(green, red, boxerGreenEl, boxerRedEl, PUNCH.LIGHT); }
  if(key === 'l'){ manualAttack(green, red, boxerGreenEl, boxerRedEl, PUNCH.HEAVY); }
});

// click handlers
boxerRedEl.addEventListener('click', ()=>{
  if(!state.running || state.paused || state.auto) return;
  // default to light punch on click
  manualAttack(red, green, boxerRedEl, boxerGreenEl, PUNCH.LIGHT);
});
boxerGreenEl.addEventListener('click', ()=>{
  if(!state.running || state.paused || state.auto) return;
  manualAttack(green, red, boxerGreenEl, boxerRedEl, PUNCH.LIGHT);
});

// Control buttons
startBtn.addEventListener('click', ()=>{
  // If a round already finished but not progressed, start next round
  if(!state.running && (state.exchange >= state.exchangesPerRound) && state.currentRound < state.roundsTotal){
    startNextRound();
    return;
  }
  startMatch();
});

pauseBtn.addEventListener('click', ()=>{
  if(!state.running) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  if(state.paused){
    if(state.timer){ clearInterval(state.timer); state.timer = null; }
    log('Paused');
    messageEl.textContent = 'Paused';
  } else {
    log('Resumed');
    messageEl.textContent = `Round ${state.currentRound}`;
    if(state.auto) state.timer = setInterval(fightTick, state.tickMs);
  }
});

resetBtn.addEventListener('click', ()=>{
  resetMatch(true);
});

// reset match; fullReset=true randomizes attributes, false only resets hp/stamina/points
function resetMatch(fullReset = true){
  clearInterval(state.timer);
  state.timer = null;
  state.running = false;
  state.paused = false;

  state.currentRound = 1;
  state.exchange = 0;
  state.roundsTotal = Math.max(1, Math.min(12, parseInt(roundsInput.value,10) || 5));
  state.exchangesPerRound = Math.max(1, Math.min(40, parseInt(exchangesInput.value,10) || 10));
  state.auto = autoModeEl.checked;

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  messageEl.textContent = 'Ready';
  refereeEl.textContent = 'Referee';

  if(fullReset){
    // randomize attributes but keep them reasonable
    red = new Boxer('Red', {
      strength: 6 + Math.floor(Math.random()*6), // 6..11
      agility: 6 + Math.floor(Math.random()*6),
      stamina: 90 + Math.floor(Math.random()*40)
    });
    green = new Boxer('Green', {
      strength: 6 + Math.floor(Math.random()*6),
      agility: 6 + Math.floor(Math.random()*6),
      stamina: 90 + Math.floor(Math.random()*40)
    });
    log('Match reset and attributes randomized.');
  } else {
    red.hp = red.maxHp; green.hp = green.maxHp;
    red.stamina = red.staminaMax; green.stamina = green.staminaMax;
    red.points = 0; green.points = 0;
    red.knockedOut = false; green.knockedOut = false;
    log('Match reset (attributes kept).');
  }

  renderUI();
}

// initial setup
resetMatch(true);
renderUI();