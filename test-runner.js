#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Test Runner for E2E Tests
 * Automatically discovers and runs all .test-e2e.js files in the test directory
 */
class TestRunner {
    constructor() {
        this.testDir = path.join(__dirname, 'test');
        this.testFiles = [];
        this.passedTests = 0;
        this.failedTests = 0;
        this.totalTests = 0;
    }

    /**
     * Discover all test files in the test directory
     */
    discoverTests() {
        try {
            const files = fs.readdirSync(this.testDir);
            this.testFiles = files
                .filter(file => file.endsWith('.test.js'))
                .map(file => path.join(this.testDir, file));
            
            console.log(`🔍 Discovered ${this.testFiles.length} test files:`);
            this.testFiles.forEach(file => {
                console.log(`   - ${path.basename(file)}`);
            });
            console.log('');
        } catch (error) {
            console.error('❌ Error discovering test files:', error.message);
            process.exit(1);
        }
    }

    /**
     * Run a single test file
     */
    async runTest(testFile) {
        return new Promise((resolve) => {
            const testName = path.basename(testFile);
            console.log(`🧪 Running ${testName}...`);
            
            const startTime = Date.now();
            const testProcess = spawn('node', [testFile], {
                stdio: 'pipe',
                cwd: __dirname
            });

            let stdout = '';
            let stderr = '';

            testProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            testProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            testProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                
                if (code === 0) {
                    console.log(`✅ ${testName} PASSED (${duration}ms)`);
                    this.passedTests++;
                } else {
                    console.log(`❌ ${testName} FAILED (${duration}ms)`);
                    this.failedTests++;
                    
                    // Show error output for failed tests
                    if (stderr) {
                        console.log(`   Error: ${stderr.trim()}`);
                    }
                    if (stdout) {
                        console.log(`   Output: ${stdout.trim()}`);
                    }
                }
                
                console.log(''); // Empty line for readability
                resolve();
            });

            testProcess.on('error', (error) => {
                console.log(`❌ ${testName} ERROR: ${error.message}`);
                this.failedTests++;
                resolve();
            });
        });
    }

    /**
     * Run all discovered tests sequentially
     */
    async runAllTests() {
        console.log('🚀 Starting test execution...\n');
        
        this.totalTests = this.testFiles.length;
        
        for (const testFile of this.testFiles) {
            await this.runTest(testFile);
        }
    }

    /**
     * Display test summary
     */
    displaySummary() {
        console.log('📊 Test Summary:');
        console.log('═'.repeat(50));
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`Passed: ${this.passedTests}`);
        console.log(`Failed: ${this.failedTests}`);
        console.log('═'.repeat(50));
        
        if (this.failedTests === 0) {
            console.log('🎉 All tests passed!');
            process.exit(0);
        } else {
            console.log('💥 Some tests failed!');
            process.exit(1);
        }
    }

    /**
     * Main execution method
     */
    async run() {
        console.log('🧪 AI Stock Test Runner');
        console.log('═'.repeat(50));
        
        try {
            this.discoverTests();
            
            if (this.testFiles.length === 0) {
                console.log('⚠️  No test files found in test directory');
                process.exit(0);
            }
            
            await this.runAllTests();
            this.displaySummary();
            
        } catch (error) {
            console.error('❌ Test runner error:', error.message);
            process.exit(1);
        }
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node test-runner.js [options]

Options:
  --help, -h     Show this help message
  
This test runner will automatically discover and run all .test-e2e.js files
in the test directory sequentially.
    `);
    process.exit(0);
}

// Run the test runner
const runner = new TestRunner();
runner.run();