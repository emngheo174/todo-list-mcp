import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const app = express();
const port = 3000;

// CORS Configuration
app.use(cors({
    origin: '*',
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'mcp-protocol-version'],
    exposedHeaders: ['mcp-session-id'],
    credentials: true,
}));

// CRITICAL: Must use express.json() to parse body
app.use(express.json());

// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// In-memory todo storage (shared across sessions)
const todos: Array<{ id: number; text: string; completed: boolean; createdAt: number }> = [];
let todoIdCounter = 1;

/**
 * Create and configure MCP server with todo tools
 */
function createMcpServer(): McpServer {
    const server = new McpServer({
        name: 'minimal-todo-server',
        version: '1.0.0',
    });

    // Tool 1: Create Todo
    server.tool(
        'todo_create',
        'Create a new todo item',
        { 
            text: z.string().min(1).describe('The todo text/description')
        },
        async ({ text }) => {
            const newTodo = {
                id: todoIdCounter++,
                text: text,
                completed: false,
                createdAt: Date.now()
            };
            todos.push(newTodo);
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: 'Todo created successfully',
                        data: newTodo
                    })
                }]
            };
        }
    );

    // Tool 2: List Todos
    server.tool(
        'todo_list',
        'List all todos',
        {},
        async () => {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        data: todos
                    })
                }]
            };
        }
    );

    // Tool 3: Update Todo
    server.tool(
        'todo_update',
        'Update an existing todo',
        {
            id: z.number().describe('The ID of the todo to update'),
            text: z.string().optional().describe('New text for the todo'),
            completed: z.boolean().optional().describe('New completion status')
        },
        async ({ id, text, completed }) => {
            const todo = todos.find(t => t.id === id);
            
            if (!todo) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `Todo with id ${id} not found`
                        })
                    }]
                };
            }

            if (text !== undefined) {
                todo.text = text;
            }
            if (completed !== undefined) {
                todo.completed = completed;
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: 'Todo updated successfully',
                        data: todo
                    })
                }]
            };
        }
    );

    // Tool 4: Delete Todo
    server.tool(
        'todo_delete',
        'Delete a todo',
        {
            id: z.number().describe('The ID of the todo to delete')
        },
        async ({ id }) => {
            const index = todos.findIndex(t => t.id === id);
            
            if (index === -1) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `Todo with id ${id} not found`
                        })
                    }]
                };
            }

            const deletedTodo = todos.splice(index, 1)[0];
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: 'Todo deleted successfully',
                        data: deletedTodo
                    })
                }]
            };
        }
    );

    return server;
}

// Handle POST requests
app.post('/mcp', async (req, res) => {
    try {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        
        console.log('📨 POST /mcp');
        console.log('  Session ID:', sessionId || 'NEW');

        let transport: StreamableHTTPServerTransport;

        // Check for existing session
        if (sessionId && transports[sessionId]) {
            console.log('  Using existing transport');
            transport = transports[sessionId];
        } 
        // Create new session if this is an initialize request
        else if (!sessionId && isInitializeRequest(req.body)) {
            console.log('  Creating new session');
            
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sid) => {
                    transports[sid] = transport;
                    console.log(`  ✅ Session initialized: ${sid}`);
                },
            });

            transport.onclose = () => {
                if (transport.sessionId) {
                    console.log(`  ❌ Session closed: ${transport.sessionId}`);
                    delete transports[transport.sessionId];
                }
            };

            const server = createMcpServer();
            await server.connect(transport);
        } 
        else {
            console.log('  ❌ Invalid request');
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Invalid Request' },
                id: null,
            });
        }

        console.log('  Calling handleRequest...');
        await transport.handleRequest(req, res, req.body);
        console.log('  ✅ Request handled');

    } catch (error) {
        console.error('❌ Error handling POST:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                    data: error instanceof Error ? error.message : String(error),
                },
                id: null,
            });
        }
    }
});

// Handle GET requests (for SSE streaming)
app.get('/mcp', async (req, res) => {
    try {
        const sessionId = req.headers['mcp-session-id'] as string;
        
        console.log('📥 GET /mcp - Session:', sessionId);
        
        const transport = transports[sessionId];
        if (!transport) {
            console.log('  ❌ Session not found');
            return res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null,
            });
        }

        await transport.handleRequest(req, res);
    } catch (error) {
        console.error('❌ Error handling GET:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
});

// Handle DELETE requests (close session)
app.delete('/mcp', async (req, res) => {
    try {
        const sessionId = req.headers['mcp-session-id'] as string;
        
        console.log('🗑️  DELETE /mcp - Session:', sessionId);
        
        const transport = transports[sessionId];
        if (!transport) {
            return res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null,
            });
        }

        await transport.handleRequest(req, res);
        delete transports[sessionId];
    } catch (error) {
        console.error('❌ Error handling DELETE:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
});

app.listen(port, () => {
    console.log(`🚀 Minimal Todo MCP Server`);
    console.log(`📡 Listening at: http://localhost:${port}/mcp`);
    console.log(`\n📚 Available Tools:`);
    console.log(`   - todo_create: Create a new todo`);
    console.log(`   - todo_list: List all todos`);
    console.log(`   - todo_update: Update a todo`);
    console.log(`   - todo_delete: Delete a todo`);
});