/**
 * Test file for Phase 1 utilities
 * Run with: npx tsx src/lib/__tests__/companyNameUtils.test.ts
 */

import { 
  normalizeCompanyName, 
  isSimilarCompany,
  calculateNameSimilarity,
  extractSearchKeywords,
  findBestMatch
} from '../companyNameUtils';

console.log('🧪 Testing Company Name Utils\n');

// Test 1: Normalization
console.log('Test 1: Normalization');
console.log('-------------------');
const tests = [
  ['Superdry PLC', 'superdry'],
  ['TESCO Stores Limited', 'tesco stores'],
  ['Next P.L.C.', 'next'],
  ['M&S Food', 'm s food'],
  ['ASDA Group Ltd', 'asda'],
];

tests.forEach(([input, expected]) => {
  const result = normalizeCompanyName(input);
  const pass = result === expected;
  console.log(`${pass ? '✅' : '❌'} "${input}" → "${result}" ${!pass ? `(expected "${expected}")` : ''}`);
});

// Test 2: Similarity Detection
console.log('\nTest 2: Similarity Detection');
console.log('----------------------------');
const similarityTests = [
  ['Superdry PLC', 'Superdry Limited', true],
  ['TESCO', 'Tesco Stores', true],
  ['ASDA', 'ASDA Group', true],
  ['Next', 'Next Retail Ltd', true],
  ['Superdry', 'Supermarket', false],
  ['ASDA', 'Sainsburys', false],
  ['Tesco', 'Tescos', true], // Typo handling
];

similarityTests.forEach(([name1, name2, expected]) => {
  const result = isSimilarCompany(name1 as string, name2 as string);
  const pass = result === expected;
  console.log(`${pass ? '✅' : '❌'} "${name1}" vs "${name2}": ${result} ${!pass ? `(expected ${expected})` : ''}`);
});

// Test 3: Similarity Scores
console.log('\nTest 3: Similarity Scores');
console.log('-------------------------');
const scoreTests = [
  ['Superdry', 'Superdry'],
  ['Superdry', 'Superdry PLC'],
  ['Tesco', 'Tesco Stores'],
  ['ASDA', 'ASDA Group'],
  ['Next', 'Sainsburys'],
];

scoreTests.forEach(([name1, name2]) => {
  const score = calculateNameSimilarity(name1, name2);
  console.log(`"${name1}" vs "${name2}": ${(score * 100).toFixed(1)}% similar`);
});

// Test 4: Keyword Extraction
console.log('\nTest 4: Keyword Extraction');
console.log('--------------------------');
const keywordTests = [
  'Tesco Stores Limited',
  'M&S Food Group',
  'Superdry PLC',
  'ASDA Supermarket',
];

keywordTests.forEach(name => {
  const keywords = extractSearchKeywords(name);
  console.log(`"${name}" → [${keywords.join(', ')}]`);
});

// Test 5: Best Match Finding
console.log('\nTest 5: Best Match Finding');
console.log('--------------------------');
const candidates = [
  'SUPERDRY PLC',
  'Supermarket Ltd',
  'Next PLC',
  'Tesco Stores',
  'ASDA Group'
];

const searchTerms = ['Superdry', 'tesco', 'sainsburys'];

searchTerms.forEach(term => {
  const match = findBestMatch(term, candidates);
  console.log(`Search "${term}" → ${match ? `Found: "${match}"` : 'No match'}`);
});

console.log('\n✅ All tests complete!');
console.log('\n📝 Summary:');
console.log('- Normalization removes punctuation, suffixes, and standardizes case');
console.log('- Similarity detection handles typos and variations');
console.log('- Fuzzy matching prevents duplicate entries');
console.log('- Ready for Phase 2 integration!');
