import { v5 as uuidv5 } from 'uuid';

// Fast navnerum, så seed, tests og benchmark får de samme id'er hver gang (determinisme og stabil input_hash).
const NAVNERUM = '6f1c2f4e-3b2a-4c5d-9e8f-1a2b3c4d5e6f';

export function stabilId(type: string, noegle: string): string {
  return uuidv5(`${type}:${noegle}`, NAVNERUM);
}
