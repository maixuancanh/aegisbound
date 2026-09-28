function precision(decimals){if(!Number.isInteger(decimals)||decimals<0||decimals>36)throw Error('Unsupported token precision.');}
export function parseAmount(text,decimals){
 precision(decimals);
 if(typeof text!=='string'||!/^\d+(\.\d+)?$/.test(text))throw Error('Enter a decimal amount.');
 const [whole,fraction='']=text.split('.');
 if(fraction.length>decimals)throw Error(`Use at most ${decimals} decimal places.`);
 return BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
}
export function formatAmount(value,decimals){
 precision(decimals);const base=10n**BigInt(decimals),n=BigInt(value);
 const fraction=(n%base).toString().padStart(decimals,'0').replace(/0+$/,'');
 return `${n/base}${fraction?'.'+fraction:''}`;
}
