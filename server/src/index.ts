import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createUIResource, RESOURCE_URI_META_KEY } from "@mcp-ui/server";
import { z } from "zod";
import { randomUUID } from "crypto";

const app = express();
const port = 3000;

// CORS Configuration
app.use(
	cors({
		origin: "*",
		allowedHeaders: ["Content-Type", "mcp-session-id", "mcp-protocol-version"],
		exposedHeaders: ["mcp-session-id"],
		credentials: true,
	})
);

app.use(express.json());

// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// In-memory todo storage (shared across sessions)
const todos: Array<{
	id: number;
	name: string;
	createdAt: number;
}> = [];
let todoIdCounter = 1;

/**
 * Generate interactive HTML for Todo List with embedded JavaScript
 */
function generateTodoHTML() {
	return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 0;
        }
        
        .container {
          background: white;
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .header p {
          opacity: 0.9;
          font-size: 14px;
        }
        
        .stats {
          display: flex;
          justify-content: space-around;
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 2px solid #e9ecef;
        }
        
        .stat-item {
          text-align: center;
        }
        
        .stat-number {
          font-size: 32px;
          font-weight: 700;
          color: #667eea;
        }
        
        .stat-label {
          font-size: 11px;
          color: #6c757d;
          margin-top: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        
        .todo-list {
          padding: 20px;
          max-height: 600px;
          overflow-y: auto;
        }
        
        .todo-item {
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s ease;
        }
        
        .todo-item:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
          transform: translateY(-2px);
        }
        
        .todo-content {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .todo-text {
          font-size: 16px;
          color: #212529;
          font-weight: 500;
        }
        
        .todo-item.completed .todo-text {
          text-decoration: line-through;
          color: #6c757d;
        }
        
        .todo-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }
        
        .todo-info {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .todo-id {
          font-size: 11px;
          color: #6c757d;
          background: #e9ecef;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: 700;
        }
        
        .todo-date {
          font-size: 12px;
          color: #6c757d;
        }
        
        .todo-actions {
          display: flex;
          gap: 8px;
        }
        
        .btn {
          padding: 10px 18px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .btn-toggle {
          background: #667eea;
          color: white;
        }
        
        .btn-toggle:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        
        .btn-delete {
          background: #dc3545;
          color: white;
        }
        
        .btn-delete:hover {
          background: #c82333;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #6c757d;
        }
        
        .empty-state svg {
          width: 100px;
          height: 100px;
          margin: 0 auto 20px;
          opacity: 0.3;
        }
        
        .empty-state h3 {
          font-size: 24px;
          margin-bottom: 10px;
          color: #495057;
          font-weight: 600;
        }
        
        .empty-state p {
          font-size: 14px;
          color: #6c757d;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .todo-item {
          animation: fadeIn 0.3s ease;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Todo Management</h1>
          <p>Keep track of your tasks efficiently</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-number">${todos.length}</div>
            <div class="stat-label">Total Tasks</div>
          </div>
        </div>
        
        <div class="todo-list">
          ${todos.length === 0
			? `
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              <h3>No Todos Yet</h3>
              <p>Create your first todo to get started!</p>
            </div>
          `
			: todos
				.map(
					(todo, index) => `
            <div class="todo-item" style="animation-delay: ${index * 0.05}s">
              <div id="todo-text-${todo.id}" class="todo-content">
                <div class="todo-info">
                  <span class="todo-id">#${todo.id}</span>
                </div>
                <div id="view-mode-${todo.id}" class="todo-text">${escapeHtml(
						todo.name
					)}</div>
                <div id="edit-mode-${todo.id
						}" class="todo-content" style="display: none; flex: 1;">
                    <input 
                        type="text" 
                        id="edit-input-${todo.id}" 
                        value="${escapeHtml(todo.name)}"
                        class="todo-text"
                        style="width: 100%; padding: 8px; border: 2px solid #667eea; border-radius: 8px; font-size: 16px;"
                    />
                </div>
              </div>
              
              <div class="todo-meta">
                <div class="todo-actions">
                    <div id="edit-actions-${todo.id
						}" class="todo-actions" style="display: none;">
                        <button class="btn btn-toggle" onclick="saveEdit(${todo.id
						})">
                        ✅ Save
                        </button>
                        <button class="btn btn-delete" onclick="cancelEdit(${todo.id
						}, '${escapeHtml(todo.name).replace(/'/g, "\\'")}')">
                        ❌ Cancel
                        </button>
                    </div>
                    <div id="view-actions-${todo.id}" class="todo-actions">
                    <button class="btn btn-toggle" onclick="startEdit(${todo.id
						}, '${todo.name}')">
                        Edit
                    </button>
                    <button class="btn btn-delete" onclick="deleteTodo(${todo.id
						})">
                        🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `
				)
				.join("")
		}
        </div>
      </div>
      
      <script>
        const TODOS_DATA = ${JSON.stringify(todos)};
        function startEdit(id, newText) {
            console.log('Editing todo:', 'todo-text-'+id);

            const container = document.getElementById('todo-text-'+id);
            if (!container) return;

            document.getElementById('view-mode-' + id).style.display = 'none';
            document.getElementById('view-actions-' + id).style.display = 'none';
            
            document.getElementById('edit-mode-' + id).style.display = 'flex';
            document.getElementById('edit-actions-' + id).style.display = 'flex';
            
            var input = document.getElementById('edit-input-' + id);
            if (input) {
                input.focus();
                input.select();
            }
        };
        function cancelEdit(id, originalText) {
            var input = document.getElementById('edit-input-' + id);
            if (input) {
                input.value = originalText;
            }
            
            document.getElementById('edit-mode-' + id).style.display = 'none';
            document.getElementById('edit-actions-' + id).style.display = 'none';
            
            document.getElementById('view-mode-' + id).style.display = 'flex';
            document.getElementById('view-actions-' + id).style.display = 'flex';
        };
        // Use postMessage to communicate with parent window (client)
        function sendToParent(type, payload) {
            console.log('Sending message to parent:', type, payload);
            const messageId = 'msg-' + Date.now();

            window.parent.postMessage({ type, messageId, payload }, '*');
            return messageId;
        }
        
        // Update todo
        function saveEdit(id) {
            var input = document.getElementById('edit-input-' + id);
            var newText = input ? input.value.trim() : '';
            sendToParent('prompt', { toolName: 'todo_update', id: id, text: newText, prompt: 'Call todo_update tool with id=' + id + ' and text="' + newText + '"' });
        }
        // Delete todo
        function deleteTodo(id) {
            sendToParent('prompt', { toolName: 'todo_delete', id: id, prompt: 'Delete #' + id });
        }
        document.addEventListener('keydown', function(e) {
            if (e.target && e.target.id && e.target.id.startsWith('edit-input-')) {
            var id = parseInt(e.target.id.replace('edit-input-', ''));
            
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit(id);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                var todo = TODOS_DATA.find(function(t) { return t.id === id; });
                if (todo) {
                    cancelEdit(id, todo.name);
                }
            }
            }
        });
        console.log('📝 Todo UI initialized with ${todos.length} items');
      </script>
    </body>
    </html>
  `;
}
function escapeHtml(text: string): string {
	const map: { [key: string]: string } = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Create and configure MCP server with todo tools
 */
function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "minimal-todo-server",
		version: "1.0.0",
	});

	// Tool 1: Create Todo
	server.tool(
		"todo_create",
		"Create a new todo item",
		{
			text: z.string().min(1).describe("The todo text/description"),
		},
		async ({ text }) => {
			const newTodo = {
				id: todoIdCounter++,
				name: text,
				createdAt: Date.now(),
			};
			todos.push(newTodo);

			const html = generateTodoHTML();
			const resourceBlock = createUIResource({
				uri: "ui://todo/list",
				encoding: "text",
				content: { type: "rawHtml", htmlString: html },
				metadata: {
					title: "📝 Todo List",
					description: "Your updated todo list",
					preferredRenderContext: "main-panel",
				},
			});

			return {
				content: [resourceBlock],
			};
		}
	);

	// Tool 2: List Todos
	server.tool("todo_list", "List all todos", {}, async () => {
		const html = generateTodoHTML();

		const resourceBlock = createUIResource({
			uri: "ui://todo/list",
			content: { type: "rawHtml", htmlString: html },
			encoding: "text",
			metadata: {
				title: "📝 Todo List",
				description: "All your todos in one place",
				preferredRenderContext: "main-panel",
			},
		});

		return {
			content: [resourceBlock],
		};
	});

	// Tool 3: Update Todo
	server.tool(
		"todo_update",
		"Update an existing todo text by ID or old text",
		{
			id: z.number().describe("The ID of the todo to update"),
			text: z.string().optional().describe("New text for the todo"),
		},
		async ({ id, text }) => {
			const todo = todos.find((t) => t.id === id);
			if (!todo) {
				return {
					content: [{ type: "text", text: `❌ Todo with ID ${id} not found` }],
				};
			}

			if (text !== undefined) todo.name = text;

			const html = generateTodoHTML();
			const resourceBlock = createUIResource({
				uri: "ui://todo/list",
				content: { type: "rawHtml", htmlString: html },
				encoding: "text",
				metadata: {
					title: "📝 Todo List",
					description: "Updated todo list",
					preferredRenderContext: "main-panel",
				},
			});

			return {
				content: [resourceBlock],
			};
		}
	);

	// Tool 4: Delete Todo
	server.tool(
		"todo_delete",
		"Delete a todo item by ID or text",
		{
			id: z.number().describe("The ID of the todo to delete"),
		},
		async ({ id }) => {
			const index = todos.findIndex((t) => t.id === id);
			if (index === -1) {
				return {
					content: [{ type: "text", text: `❌ Todo with ID ${id} not found` }],
				};
			}

			todos.splice(index, 1);

			const html = generateTodoHTML();
			const resourceBlock = createUIResource({
				uri: "ui://todo/list",
				content: { type: "rawHtml", htmlString: html },
				encoding: "text",
				metadata: {
					title: "📝 Todo List",
					description: "Updated todo list after deletion",
					preferredRenderContext: "main-panel",
				},
			});

			return {
				content: [resourceBlock],
			};
		}
	);

	return server;
}

// Handle POST requests
app.post("/mcp", async (req, res) => {
	try {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;

		console.log("📨 POST /mcp");
		console.log("  Session ID:", sessionId || "NEW");

		let transport: StreamableHTTPServerTransport;

		if (sessionId && transports[sessionId]) {
			console.log("  Using existing transport");
			transport = transports[sessionId];
		} else if (!sessionId && isInitializeRequest(req.body)) {
			console.log("  Creating new session");

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
		} else {
			console.log("  ❌ Invalid request");
			return res.status(400).json({
				jsonrpc: "2.0",
				error: { code: -32600, message: "Invalid Request" },
				id: null,
			});
		}

		console.log("  Calling handleRequest...");
		await transport.handleRequest(req, res, req.body);
		console.log("  ✅ Request handled");
	} catch (error) {
		console.error("❌ Error handling POST:", error);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: {
					code: -32603,
					message: "Internal server error",
					data: error instanceof Error ? error.message : String(error),
				},
				id: null,
			});
		}
	}
});

// Handle GET requests (for SSE streaming)
app.get("/mcp", async (req, res) => {
	try {
		const sessionId = req.headers["mcp-session-id"] as string;

		console.log("📥 GET /mcp - Session:", sessionId);

		const transport = transports[sessionId];
		if (!transport) {
			console.log("  ❌ Session not found");
			return res.status(404).json({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Session not found" },
				id: null,
			});
		}

		await transport.handleRequest(req, res);
	} catch (error) {
		console.error("❌ Error handling GET:", error);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: { code: -32603, message: "Internal server error" },
				id: null,
			});
		}
	}
});

// Handle DELETE requests (close session)
app.delete("/mcp", async (req, res) => {
	try {
		const sessionId = req.headers["mcp-session-id"] as string;

		console.log("🗑️  DELETE /mcp - Session:", sessionId);

		const transport = transports[sessionId];
		if (!transport) {
			return res.status(404).json({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Session not found" },
				id: null,
			});
		}

		await transport.handleRequest(req, res);
		delete transports[sessionId];
	} catch (error) {
		console.error("❌ Error handling DELETE:", error);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: { code: -32603, message: "Internal server error" },
				id: null,
			});
		}
	}
});

app.listen(port, () => {
	console.log(`🚀 MCP Todo Server with Interactive UI`);
	console.log(`📡 Listening at: http://localhost:${port}/mcp`);
	console.log(`\n📚 Available Tools:`);
	console.log(`   - todo_create: Create a new todo with interactive UI`);
	console.log(`   - todo_list: Display all todos with interactive UI`);
	console.log(`   - todo_update: Update todo text or completion status`);
	console.log(`   - todo_delete: Delete a todo item`);
	console.log(`\n✨ All buttons in UI communicate via postMessage!`);
});
