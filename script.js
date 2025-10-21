/* Simple Boxing Game
   - Two boxers with attributes: strength, agility, stamina.
   - Multi-round simulation with exchanges per round.
   - Auto or manual mode. Manual: click a boxer to make them throw a punch.
*/

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const resetBtn = document.getElementById('resetBtn');
const autoFight = document.getElementById('autoFight');
const roundsInput = document.getElementById('roundsInput');
const exchangesInput = document.getElementById('exchangesInput');

const roundNumberEl = document.getElementById('roundNumber');
const totalRoundsEl = document.getElementById('totalRounds');
const exchangeCountEl = document.getElementById('exchangeCount');
const exchangesPerRoundEl = document.getElementById('exchangesPerRound');

const hpRedEl = document.getElementById('hpRed');
const hpGreenEl = document.getElementById('hpGreen');
const hpRedText = document.getElementById('hpRedText');
const hpGreenText = document.getElementById('hpGreenText');
const statsRedEl = document.getElementById('statsRed');
const statsGreenEl = document.getElementById('statsGreen');
const logEl = document.getElementById('log');

const boxerRed = document.getElementById('boxerRed');
const boxerGreen = document.getElementById('boxerGreen');
const referee = document.getElementById('referee');

let state = {
  roundsTotal: parseInt(roundsInput.value, 10),
  exchangesPerRound: parseInt(exchangesInput.value, 10),
  currentRound: 1,
  exchange: 0,
  running: false,
  paused: false,
  timer: null,
  auto: autoFight.checked,
  intervalMs: 650
};

// boxer model
function createBoxer(name, colorClass, attributes){
  return {
    name,
    colorClass,
    maxHp: 100,
    hp: 100,
    // attributes: strength (damage), agility (hit chance / dodge), stamina (resource)
    strength: attributes.strength,
    agility: attributes.agility,
    stamina: attributes.stamina,
    staminaMax: attributes.stamina,
    knockedOut: false
  };
}

// You can customize starting attributes here or randomize
let red = createBoxer('Red', 'boxer-red', {strength: 8, agility: 7, stamina: 100});
let green = createBoxer('Green', 'boxer-green', {strength: 7, agility: 8, stamina: 100});

function log(msg){
  const now = new Date().toLocaleTimeString();
  logEl.textContent = `[${now}] ${msg}\n` + logEl.textContent;
}

// UI update
function renderStats(){
  totalRoundsEl.textContent = state.roundsTotal;
  exchangesPerRoundEl.textContent = state.exchangesPerRound;
  roundNumberEl.textContent = state.currentRound;
  exchangeCountEl.textContent = state.exchange;

  // HP bars
  hpRedEl.style.width = Math.max(0, red.hp) + '%';
  hpGreenEl.style.width = Math.max(0, green.hp) + '%';
  hpRedText.textContent = Math.round(red.hp);
  hpGreenText.textContent = Math.round(green.hp);

  // stats text
  statsRedEl.innerHTML = `
    <div class="stat-line"><span>Strength</span><strong>${red.strength}</strong></div>
    <div class="stat-line"><span>Agility</span><strong>${red.agility}</strong></div>
    <div class="stat-line"><span>Stamina</span><strong>${Math.round(red.stamina)}</strong></div>
  `;
  statsGreenEl.innerHTML = `
    <div class="stat-line"><span>Strength</span><strong>${green.strength}</strong></div>
    <div class="stat-line"><span>Agility</span><strong>${green.agility}</strong></div>
    <div class="stat-line"><span>Stamina</span><strong>${Math.round(green.stamina)}</strong></div>
  `;

  // KO visuals
  boxerRed.classList.toggle('ko', red.knockedOut);
  boxerGreen.classList.toggle('ko', green.knockedOut);
}

// Core mechanics:
// - Hit chance depends on attacker's agility, defender's agility and stamina.
// - Damage depends on strength and remaining stamina (more stamina -> more damage).
// - Stamina drains each attack and recovers between rounds.
function computeHitChance(attacker, defender){
  // base ratio from agility
  const base = attacker.agility / (attacker.agility + defender.agility);
  // stamina modifies accuracy: low stamina reduces accuracy
  const staminaFactor = 0.4 + 0.6 * (attacker.stamina / attacker.staminaMax); // between 0.4 and 1.0
  // small randomness
  const chance = base * staminaFactor;
  return Math.min(0.98, Math.max(0.05, chance));
}

function computeDamage(attacker){
  // strength * random * stamina factor
  const staminaFactor = 0.5 + 0.5 * (attacker.stamina / attacker.staminaMax); // 0.5 - 1.0
  const damage = (attacker.strength * (4 + Math.random()*4)) * staminaFactor;
  return Math.max(3, Math.round(damage));
}

function drainStamina(attacker){
  // stamina cost depends on strength and randomness
  const cost = 6 + Math.floor(Math.random() * 6);
  attacker.stamina = Math.max(0, attacker.stamina - cost);
}

// single exchange: attacker attempts to hit defender
function exchange(attacker, defender, actorEl, targetEl){
  if(attacker.knockedOut || defender.knockedOut) return null;

  // small step-in animation
  actorEl.classList.add('punch');
  setTimeout(()=> actorEl.classList.remove('punch'), 300);

  const hitChance = computeHitChance(attacker, defender);
  const roll = Math.random();
  let hit = roll < hitChance;

  if(hit){
    const dmg = computeDamage(attacker);
    // defender's agility gives chance to partially evade
    const evade = Math.random() < (0.06 * defender.agility); // small chance to evade partly
    const finalDmg = evade ? Math.max(1, Math.round(dmg * 0.45)) : dmg;
    defender.hp = Math.max(0, defender.hp - finalDmg);

    // knockdown if HP reduced below threshold
    if(defender.hp <= 0){
      defender.knockedOut = true;
      log(`${attacker.name} scores a KO!`);
    } else {
      log(`${attacker.name} hits ${defender.name} for ${finalDmg} damage.`);
    }
    // visual flash
    targetEl.style.filter = 'brightness(1.4)';
    setTimeout(()=> targetEl.style.filter = '', 180);
  } else {
    log(`${attacker.name} misses ${defender.name}.`);
  }

  // stamina drain always occurs when attacking
  drainStamina(attacker);

  renderStats();

  return hit;
}

// fight loop for an exchange sequence
function fightTick(){
  if(!state.running || state.paused) return;

  // if either knocked out -> end match
  if(red.knockedOut || green.knockedOut){
    endMatch();
    return;
  }

  // if exchanges for current round completed
  if(state.exchange >= state.exchangesPerRound){
    endRound();
    return;
  }

  // choose attacker based on agility and stamina (weighted random)
  const redScore = Math.random() * (red.agility + red.stamina / 20);
  const greenScore = Math.random() * (green.agility + green.stamina / 20);
  const attacker = redScore >= greenScore ? red : green;
  const defender = attacker === red ? green : red;
  const actorEl = attacker === red ? boxerRed : boxerGreen;
  const targetEl = defender === red ? boxerRed : boxerGreen;

  exchange(attacker, defender, actorEl, targetEl);

  state.exchange += 1;
  exchangeCountEl.textContent = state.exchange;

  // check KO
  if(red.knockedOut || green.knockedOut){
    endMatch();
    return;
  }
}

// round handling
function endRound(){
  log(`Round ${state.currentRound} ends.`);
  // small rest: recover stamina (not HP)
  const recover = 20 + Math.floor(Math.random()*12);
  red.stamina = Math.min(red.staminaMax, red.stamina + recover);
  green.stamina = Math.min(green.staminaMax, green.stamina + recover);
  renderStats();

  // enable Next Round button if manual stepping, otherwise automatically proceed
  nextRoundBtn.disabled = false;
  pauseBtn.disabled = true;

  state.running = false;
  clearInterval(state.timer);

  // if match over by rounds
  if(state.currentRound >= state.roundsTotal){
    decideOnPoints();
  } else {
    log(`Corner rest: both boxers recover ${recover} stamina.`);
  }
}

// proceed to next round (called by button)
function startNextRound(){
  if(red.knockedOut || green.knockedOut){
    endMatch();
    return;
  }
  state.currentRound += 1;
  state.exchange = 0;
  state.running = true;
  state.paused = false;
  nextRoundBtn.disabled = true;
  pauseBtn.disabled = false;
  roundNumberEl.textContent = state.currentRound;
  exchangeCountEl.textContent = state.exchange;
  state.timer = setInterval(fightTick, state.intervalMs);
  log(`Round ${state.currentRound} starts.`);
}

// decide winner by remaining HP if no KO
function decideOnPoints(){
  log('Match went the distance. Deciding on points...');
  if(red.hp > green.hp){
    log('Red wins on points!');
  } else if(green.hp > red.hp){
    log('Green wins on points!');
  } else {
    log("It's a draw!");
  }
  // stop everything
  endMatch();
}

function endMatch(){
  state.running = false;
  clearInterval(state.timer);
  pauseBtn.disabled = true;
  nextRoundBtn.disabled = true;
  startBtn.disabled = false;
  log('Match finished.');
  // referee animation: small text change
  referee.textContent = 'Referee - Match Over';
}

// start match
function startMatch(){
  // apply settings
  state.roundsTotal = Math.max(1, Math.min(12, parseInt(roundsInput.value, 10) || 8));
  state.exchangesPerRound = Math.max(1, Math.min(30, parseInt(exchangesInput.value, 10) || 10));
  exchangesPerRoundEl.textContent = state.exchangesPerRound;
  totalRoundsEl.textContent = state.roundsTotal;
  state.auto = autoFight.checked;

  // If previously finished, do not reset HP unless user clicked Reset; starting resumes new match
  state.running = true;
  state.paused = false;
  state.exchange = 0;
  state.currentRound = 1;

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  nextRoundBtn.disabled = true;
  renderStats();
  log(`Match started. Auto: ${state.auto ? 'ON' : 'OFF'}. Rounds: ${state.roundsTotal}, Exchanges/round: ${state.exchangesPerRound}`);

  // run loop
  if(state.auto){
    state.timer = setInterval(fightTick, state.intervalMs);
  } else {
    // manual: run only when user clicks Next Exchange (we make clicking a boxer trigger an attack)
    // but we'll still enable a "Next Round" after exchanges complete
    log('Manual mode: click a boxer to make them attack, or enable Auto to let it run.');
  }
}

// manual attack handler (when Auto is off)
boxerRed.addEventListener('click', ()=>{
  if(!state.running || state.paused) return;
  if(state.auto) return;
  // make red attack green
  exchange(red, green, boxerRed, boxerGreen);
  state.exchange += 1;
  exchangeCountEl.textContent = state.exchange;
  if(state.exchange >= state.exchangesPerRound) endRound();
  if(green.knockedOut) endMatch();
});

boxerGreen.addEventListener('click', ()=>{
  if(!state.running || state.paused) return;
  if(state.auto) return;
  exchange(green, red, boxerGreen, boxerRed);
  state.exchange += 1;
  exchangeCountEl.textContent = state.exchange;
  if(state.exchange >= state.exchangesPerRound) endRound();
  if(red.knockedOut) endMatch();
});

// controls
startBtn.addEventListener('click', ()=>{
  // If a match already finished and HP are zero, reset automatically
  if(red.hp <= 0 || green.hp <= 0 || (red.knockedOut || green.knockedOut) || (red.hp === 100 && green.hp === 100 && state.currentRound > 1)){
    // keep existing attributes but reset state
    resetMatch(false); // don't randomize attributes
  }
  startMatch();
  // if Auto was enabled mid-run, start interval
  if(state.auto && state.timer == null){
    state.timer = setInterval(fightTick, state.intervalMs);
  }
});

pauseBtn.addEventListener('click', ()=>{
  if(!state.running) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  if(state.paused){
    clearInterval(state.timer);
    log('Match paused.');
  } else {
    if(state.auto){
      state.timer = setInterval(fightTick, state.intervalMs);
    }
    log('Match resumed.');
  }
});

nextRoundBtn.addEventListener('click', ()=>{
  startNextRound();
});

resetBtn.addEventListener('click', ()=>{
  resetMatch(true);
});

// reset match. If fullReset = true, regenerate attributes randomly.
function resetMatch(fullReset = true){
  clearInterval(state.timer);
  state.running = false;
  state.paused = false;
  state.currentRound = 1;
  state.exchange = 0;
  state.auto = autoFight.checked;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  nextRoundBtn.disabled = true;
  referee.textContent = 'Referee';

  if(fullReset){
    // randomize attributes within a pleasant range so matches vary
    red = createBoxer('Red','boxer-red',{
      strength: 6 + Math.floor(Math.random()*6), // 6..11
      agility: 6 + Math.floor(Math.random()*6),
      stamina: 90 + Math.floor(Math.random()*30)
    });
    green = createBoxer('Green','boxer-green',{
      strength: 6 + Math.floor(Math.random()*6),
      agility: 6 + Math.floor(Math.random()*6),
      stamina: 90 + Math.floor(Math.random()*30)
    });
  } else {
    // reset HP/states but keep attributes
    red.hp = red.maxHp;
    green.hp = green.maxHp;
    red.stamina = red.staminaMax;
    green.stamina = green.staminaMax;
    red.knockedOut = false;
    green.knockedOut = false;
  }

  state.roundsTotal = Math.max(1, Math.min(12, parseInt(roundsInput.value,10) || 8));
  state.exchangesPerRound = Math.max(1, Math.min(30, parseInt(exchangesInput.value,10) || 10));

  totalRoundsEl.textContent = state.roundsTotal;
  exchangesPerRoundEl.textContent = state.exchangesPerRound;
  roundNumberEl.textContent = state.currentRound;
  exchangeCountEl.textContent = state.exchange;

  renderStats();
  log('Match reset. Attributes ' + (fullReset ? 'randomized.' : 'kept.'));
}

// initialize
resetMatch(true);
renderStats();