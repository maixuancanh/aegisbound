export function createRoundState(initialBalance) {
 let balance=initialBalance, phase='ready';
 return {
  get balance(){return balance;}, get phase(){return phase;},
  start(wager,formation){
   if(phase!=='ready') throw new Error('A round is already running.');
   if(typeof wager!=='bigint'||wager<100n||wager>balance||wager>10n**24n) throw new Error('Choose a wager within your balance.');
   if(![0,1].includes(formation)) throw new Error('Choose a formation.');
   balance-=wager; phase='running';
  },
  settle(payout){
   if(phase!=='running'||typeof payout!=='bigint'||payout<0n) throw new Error('Invalid settlement.');
   balance+=payout; phase='ready';
  }
 };
}
export function sampleOutcome(nextWord=()=>crypto.getRandomValues(new Uint32Array(1))[0]) {
 const limit=Math.floor(2**32/729)*729;
 let value; do {value=nextWord();} while(value>=limit);
 return value%729;
}
