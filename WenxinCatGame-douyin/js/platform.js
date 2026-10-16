const structuredClone = value => JSON.parse(JSON.stringify(value));
const crypto = { randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {const n = Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);}), getRandomValues: array => {for(let i=0;i<array.length;i++)array[i]=Math.floor(Math.random()*256);return array;} };
module.exports = { structuredClone, crypto };
