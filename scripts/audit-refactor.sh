#!/bin/bash

# AntHill Refactor Audit Script
# Finds opportunities to improve code consistency

echo "🔍 AntHill Refactor Audit"
echo "=========================="
echo ""

# Check for hardcoded colors
echo "📊 Hardcoded Colors Found:"
echo "--------------------------"
grep -rn "backgroundColor.*#\|color.*#" src/screens src/components --include="*.tsx" --include="*.ts" | \
  grep -v "node_modules\|\.d\.ts\|colors\.ts\|tokens\.ts" | \
  wc -l | \
  xargs -I {} echo "  {} instances"
echo ""

# Check for raw React Native Text usage (should use UI library)
echo "📝 Raw <Text> Usage (should use UI library):"
echo "--------------------------------------------"
grep -rn "import.*{.*Text.*}.*from.*['\"]react-native['\"]" src/screens --include="*.tsx" | \
  wc -l | \
  xargs -I {} echo "  {} files"
echo ""

# Check for raw View with inline styles
echo "📦 Views with Inline Styles:"
echo "----------------------------"
grep -rn "<View style={{" src/screens --include="*.tsx" | \
  wc -l | \
  xargs -I {} echo "  {} instances"
echo ""

# Check for hardcoded spacing (should use tokens)
echo "📏 Hardcoded Spacing Values:"
echo "----------------------------"
grep -rn "padding:.*[0-9]\|margin:.*[0-9]" src/screens --include="*.tsx" | \
  grep -v "Spacing\." | \
  wc -l | \
  xargs -I {} echo "  {} instances"
echo ""

# Check for ActivityIndicator (should use LoadingScreen)
echo "⏳ Raw ActivityIndicator Usage:"
echo "-------------------------------"
grep -rn "ActivityIndicator" src/screens --include="*.tsx" | \
  wc -l | \
  xargs -I {} echo "  {} instances"
echo ""

# Check for TouchableOpacity (could use Button)
echo "🔘 TouchableOpacity Usage (check if Button is better):"
echo "-------------------------------------------------------"
grep -rn "TouchableOpacity" src/screens --include="*.tsx" | \
  wc -l | \
  xargs -I {} echo "  {} instances"
echo ""

# Find screens without useTheme hook
echo "🎨 Screens Missing useTheme Hook:"
echo "----------------------------------"
for file in src/screens/**/*.tsx; do
  if [ -f "$file" ]; then
    if ! grep -q "useTheme" "$file"; then
      echo "  - $file"
    fi
  fi
done
echo ""

# Summary
echo "💡 Next Steps:"
echo "--------------"
echo "1. Review files with hardcoded colors - replace with theme"
echo "2. Check raw Text usage - migrate to UI library Text component"
echo "3. Replace inline styles with design tokens"
echo "4. Use LoadingScreen instead of ActivityIndicator"
echo "5. Add useTheme() hook to screens that need it"
echo ""
echo "See QUICK_START_REFACTOR.md for detailed instructions"
echo ""
