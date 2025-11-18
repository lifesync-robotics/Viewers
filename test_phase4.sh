#!/bin/bash

###############################################################################
# Phase 4 Test Suite: Frontend Integration
# Tests the OHIF Viewer tracking panel with Phase 3 backend
###############################################################################

# Note: Not using 'set -e' because we want to continue testing even if some tests fail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}TEST $TESTS_TOTAL: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   $2${NC}"
    ((TESTS_FAILED++))
}

run_test() {
    ((TESTS_TOTAL++))
    print_test "$1"
}

###############################################################################
# Test 1: Verify PanelTracking Component Exists
###############################################################################

test_panel_tracking_exists() {
    run_test "PanelTracking component file exists"

    if [ -f "extensions/cornerstone/src/panels/PanelTracking.tsx" ]; then
        print_success "PanelTracking.tsx found"
    else
        print_failure "PanelTracking.tsx not found" \
            "Expected: extensions/cornerstone/src/panels/PanelTracking.tsx"
    fi
}

###############################################################################
# Test 2: Check Phase 4 Enhancements
###############################################################################

test_phase4_enhancements() {
    run_test "PanelTracking has Phase 4 enhancements"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        # Check for Phase 4 interfaces
        if grep -q "interface PatientReferenceStatus" "$FILE" && \
           grep -q "interface ToolTrackingData" "$FILE" && \
           grep -q "interface TrackingFrame" "$FILE"; then
            print_success "Phase 4 TypeScript interfaces present"
        else
            print_failure "Phase 4 interfaces missing" \
                "Expected: PatientReferenceStatus, ToolTrackingData, TrackingFrame"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check for Phase 4 enhancements"
    fi
}

###############################################################################
# Test 3: Check WebSocket Integration
###############################################################################

test_websocket_integration() {
    run_test "WebSocket integration code present"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        if grep -q "connectWebSocket" "$FILE" && \
           grep -q "wsRef" "$FILE" && \
           grep -q "WebSocket" "$FILE"; then
            print_success "WebSocket connection logic present"
        else
            print_failure "WebSocket logic missing" \
                "Expected: connectWebSocket, wsRef, WebSocket"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check WebSocket integration"
    fi
}

###############################################################################
# Test 4: Check Patient Reference Status Widget
###############################################################################

test_pr_status_widget() {
    run_test "Patient Reference Status widget present"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        if grep -q "Patient Reference Status" "$FILE" && \
           grep -q "patient_reference.visible" "$FILE" && \
           grep -q "patient_reference.quality" "$FILE" && \
           grep -q "patient_reference.moved" "$FILE"; then
            print_success "PR Status widget with all fields present"
        else
            print_failure "PR Status widget incomplete" \
                "Expected: visible, quality, moved fields"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check PR Status widget"
    fi
}

###############################################################################
# Test 5: Check Tool Coordinates Display
###############################################################################

test_tool_coordinates() {
    run_test "Tool Coordinates display present"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        if grep -q "Tool Coordinates" "$FILE" && \
           grep -q "coordinateSystem" "$FILE" && \
           grep -q "PR-Relative" "$FILE" && \
           grep -q "Tracker" "$FILE"; then
            print_success "Tool Coordinates display with toggle present"
        else
            print_failure "Tool Coordinates display incomplete" \
                "Expected: coordinateSystem, PR-Relative, Tracker toggle"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check Tool Coordinates display"
    fi
}

###############################################################################
# Test 6: Check Alert System
###############################################################################

test_alert_system() {
    run_test "Alert system present"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        if grep -q "alerts" "$FILE" && \
           grep -q "severity" "$FILE" && \
           grep -q "alert.message" "$FILE"; then
            print_success "Alert system present"
        else
            print_failure "Alert system incomplete" \
                "Expected: alerts state, severity handling, message display"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check Alert system"
    fi
}

###############################################################################
# Test 7: Check API URL Configuration
###############################################################################

test_api_urls() {
    run_test "API URLs configured correctly"

    FILE="extensions/cornerstone/src/panels/PanelTracking.tsx"

    if [ -f "$FILE" ]; then
        # Check for dynamic API base URL
        if grep -q "window.location.port" "$FILE" && \
           grep -q "localhost:3001" "$FILE"; then
            print_success "Dynamic API URL configuration present"
        else
            print_failure "API URL configuration missing" \
                "Expected: Dynamic URL based on window.location.port"
        fi
    else
        print_failure "PanelTracking.tsx not found" \
            "Cannot check API URLs"
    fi
}

###############################################################################
# Test 8: Check TypeScript Compilation (if available)
###############################################################################

test_typescript_compilation() {
    run_test "TypeScript compilation check"

    if command -v tsc &> /dev/null; then
        cd "$SCRIPT_DIR"
        if tsc --noEmit extensions/cornerstone/src/panels/PanelTracking.tsx 2>&1 | grep -q "error TS"; then
            print_failure "TypeScript compilation errors found" \
                "Run: tsc --noEmit extensions/cornerstone/src/panels/PanelTracking.tsx"
        else
            print_success "No TypeScript compilation errors"
        fi
    else
        echo -e "${YELLOW}⚠️  SKIP: TypeScript compiler not available${NC}"
        ((TESTS_TOTAL--))  # Don't count as a test
    fi
}

###############################################################################
# Test 9: Check Services Running (Integration Test)
###############################################################################

test_services_running() {
    run_test "Backend services availability"

    # Check SyncForge API
    if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ SyncForge API running (port 3001)${NC}"

        # Check tracking config endpoint
        if curl -s http://localhost:3001/api/tracking/config | grep -q "coordinate_output"; then
            print_success "SyncForge API with Phase 3 tracking endpoints"
        else
            print_failure "SyncForge API missing Phase 3 endpoints" \
                "Check /api/tracking/config response"
        fi
    else
        echo -e "${YELLOW}⚠️  SKIP: SyncForge API not running (start with: cd ../AsclepiusPrototype/00_SyncForgeAPI && npm start)${NC}"
        ((TESTS_TOTAL--))  # Don't count as a test
    fi
}

###############################################################################
# Test 10: Check OHIF Build
###############################################################################

test_ohif_build() {
    run_test "OHIF Viewer build check"

    if [ -f "package.json" ]; then
        if grep -q "\"name\": \"@ohif/app\"" package.json || \
           grep -q "\"name\": \"ohif-viewer\"" package.json; then
            print_success "OHIF package.json valid"
        else
            print_failure "OHIF package.json invalid" \
                "Check package.json name field"
        fi
    else
        print_failure "package.json not found" \
            "Are you in the Viewers directory?"
    fi
}

###############################################################################
# Main Test Execution
###############################################################################

main() {
    print_header "PHASE 4 TEST SUITE: Frontend Integration"

    echo "Testing Phase 4 enhancements..."
    echo "- PanelTracking component updates"
    echo "- WebSocket integration"
    echo "- Patient Reference status display"
    echo "- Tool coordinates display"
    echo "- Alert system"
    echo "- API configuration"
    echo ""

    # Run all tests
    test_panel_tracking_exists
    test_phase4_enhancements
    test_websocket_integration
    test_pr_status_widget
    test_tool_coordinates
    test_alert_system
    test_api_urls
    test_typescript_compilation
    test_services_running
    test_ohif_build

    # Print summary
    print_header "TEST SUMMARY"
    echo -e "Total Tests: ${BLUE}$TESTS_TOTAL${NC}"
    echo -e "Passed:      ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed:      ${RED}$TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! Phase 4 is ready.${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Start SyncForge API: cd ../AsclepiusPrototype/00_SyncForgeAPI && npm start"
        echo "2. Start Tracking Simulator: cd ../AsclepiusPrototype/04_Tracking && python3 tracking_simulator.py"
        echo "3. Start OHIF: yarn dev"
        echo "4. Open http://localhost:3000 and test the Tracking Control panel"
        return 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED. Please fix the issues above.${NC}"
        return 1
    fi
}

# Run main function
main
