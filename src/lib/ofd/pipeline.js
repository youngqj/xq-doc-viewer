/*
 * Pipeline utility for ofd.js
 * Adapted: replaced Array.prototype pollution with standalone function
 */

async function pipelineReduce(arr, callback) {
  let value;
  for (let index = 0; index < arr.length; ++index) {
    value = await callback(value, arr[index], index, arr);
  }
  return value;
}

export const pipeline = function (...funcs) {
  return pipelineReduce(funcs, (a, b) => b(a));
}
