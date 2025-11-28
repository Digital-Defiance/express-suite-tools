#!/bin/bash

# Script to update all test files to use PROPERTY_TEST_CONFIG

FILES=(
  "tools/audit/tests/parsers/typescript-parser.test.ts"
  "tools/audit/tests/parsers/example-extractor.test.ts"
  "tools/audit/tests/parsers/markdown-parser.test.ts"
  "tools/audit/tests/analyzers/cross-package-analyzer.test.ts"
  "tools/audit/tests/analyzers/test-quality-analyzer.test.ts"
  "tools/audit/tests/analyzers/documentation-analyzer.test.ts"
  "tools/audit/tests/analyzers/ecies-analyzer.test.ts"
  "tools/audit/tests/analyzers/coverage-analyzer.test.ts"
  "tools/audit/tests/validators/export-validator.test.ts"
  "tools/audit/tests/validators/reference-validator.test.ts"
  "tools/audit/tests/validators/test-utils-validator.test.ts"
  "tools/audit/tests/validators/signature-validator.test.ts"
  "tools/audit/tests/validators/testing-approach-validator.test.ts"
  "tools/audit/tests/validators/example-validator.test.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    
    # Add import if not present
    if ! grep -q "PROPERTY_TEST_CONFIG" "$file"; then
      # Find the last import line and add after it
      sed -i "/^import.*from/a import { PROPERTY_TEST_CONFIG } from '../test-config';" "$file" | head -1
      # Clean up - only add once at the end of imports
      awk '/^import.*from/ {imports[NR]=$0; next} 
           !seen && NF && !/^import/ {
             for(i in imports) print imports[i]; 
             if(!added) {print "import { PROPERTY_TEST_CONFIG } from '\''../test-config'\'';"; added=1}
             seen=1
           } 
           {if(seen || /^import/) print}' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
    
    # Replace numRuns values
    sed -i 's/{ numRuns: 100 }/{ numRuns: PROPERTY_TEST_CONFIG.SIMPLE }/g' "$file"
    sed -i 's/{ numRuns: 50 }/{ numRuns: PROPERTY_TEST_CONFIG.STANDARD }/g' "$file"
    sed -i 's/{ numRuns: 30 }/{ numRuns: PROPERTY_TEST_CONFIG.EXPENSIVE }/g' "$file"
    sed -i 's/{ numRuns: 20 }/{ numRuns: PROPERTY_TEST_CONFIG.EXPENSIVE }/g' "$file"
  fi
done

echo "Done!"
