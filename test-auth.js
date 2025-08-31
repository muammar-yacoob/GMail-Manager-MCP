#!/usr/bin/env node

import { spawn } from 'child_process';

const mcp = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

// Send initialize request
const initRequest = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {}
    },
    id: requestId++
};

// Send list tools request
const listToolsRequest = {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: requestId++
};

// Try to use a tool without credentials
const searchEmailsRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
        name: "search_emails",
        arguments: {
            query: "is:unread",
            maxResults: 5
        }
    },
    id: requestId++
};

let buffer = '';

mcp.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                console.log('Response:', JSON.stringify(response, null, 2));
                
                if (response.id === 1) {
                    // After init, list tools
                    console.log('\nSending list tools request...');
                    mcp.stdin.write(JSON.stringify(listToolsRequest) + '\n');
                } else if (response.id === 2) {
                    // After listing tools, try to search emails
                    console.log('\nAttempting to search emails without credentials...');
                    mcp.stdin.write(JSON.stringify(searchEmailsRequest) + '\n');
                } else if (response.id === 3) {
                    // Check the response
                    if (response.error) {
                        console.log('\n✅ Expected behavior: Got authentication prompt');
                        console.log('Error message:', response.error.message);
                    } else {
                        console.log('\n❌ Unexpected: Tool succeeded without credentials');
                    }
                    process.exit(0);
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }
});

mcp.stderr.on('data', (data) => {
    console.error('Stderr:', data.toString());
});

// Send initialize request
console.log('Sending initialize request...');
mcp.stdin.write(JSON.stringify(initRequest) + '\n');

// Timeout after 10 seconds
setTimeout(() => {
    console.log('\n❌ Test timed out');
    mcp.kill();
    process.exit(1);
}, 10000);