import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const SERVER_URL = 'http://localhost:3000/mcp';

let mcpClient = null;
let transport = null;
let todos = [];

// Initialize MCP connection
async function initConnection() {
    const statusDiv = document.getElementById('connection-status');
    statusDiv.textContent = '🔄 Connecting to MCP server...';
    statusDiv.className = 'text-yellow-600 font-semibold';
    
    try {
        mcpClient = new Client({
            name: "todo-ui-client",
            version: "1.0.0",
        });

        transport = new StreamableHTTPClientTransport(new URL(SERVER_URL));
        
        await mcpClient.connect(transport);
        
        statusDiv.textContent = '✅ Connected to MCP server';
        statusDiv.className = 'text-green-600 font-semibold';
        
        // Load todos after connection
        await loadTodos();
        
    } catch (e) {
        console.error('Connection error:', e);
        statusDiv.textContent = `❌ Connection failed: ${e.message}`;
        statusDiv.className = 'text-red-600 font-semibold';
    }
}

// Call MCP tool
async function callTool(toolName, args = {}) {
    try {
        const resp = await mcpClient.callTool({ name: toolName, arguments: args });
        const result = JSON.parse(resp.content[0].text);
        return result;
    } catch (error) {
        console.error(`Error calling ${toolName}:`, error);
        throw error;
    }
}

// Load todos
async function loadTodos() {
    const result = await callTool('todo_list');
    if (result.success) {
        todos = result.data;
        renderTodos();
    }
}

// Render todos
function renderTodos() {
    const container = document.getElementById('todos-container');
    
    if (todos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <p class="text-lg font-semibold">No todos yet!</p>
                <p class="text-sm mt-2">Create your first todo above</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = todos.map(todo => `
        <div class="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border-l-4 ${todo.completed ? 'border-green-500' : 'border-blue-500'} hover:shadow-md transition-shadow">
            <div class="flex-1" id="todo-text-${todo.id}">
                <p class="${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'} font-medium">
                    ${escapeHtml(todo.text)}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                    #${todo.id} · ${new Date(todo.createdAt).toLocaleString()}
                </p>
            </div>
            <button 
                onclick="startEdit(${todo.id})"
                class="px-6 py-3 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600 transition-colors"
                title="Edit"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            </button>
            <button 
                onclick="deleteTodo(${todo.id})"
                class="px-6 py-3 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                title="Delete"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `).join('');
    
    // Update stats
    document.getElementById('stats').textContent = `${todos.length} total`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create todo
window.createTodo = async function() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    
    if (!text) {
        alert('Please enter a todo text');
        return;
    }
    
    const result = await callTool('todo_create', { text });
    
    if (result.success) {
        input.value = '';
        await loadTodos();
    } else {
        alert('Failed to create todo: ' + result.message);
    }
};

// Toggle todo
window.toggleTodo = async function(id, completed) {
    const result = await callTool('todo_update', { id, completed });
    
    if (result.success) {
        await loadTodos();
    } else {
        alert('Failed to update todo: ' + result.message);
    }
};

// Start edit
window.startEdit = function(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    const container = document.getElementById(`todo-text-${id}`);
    container.innerHTML = `
        <input 
            type="text" 
            id="edit-input-${id}" 
            value="${escapeHtml(todo.text)}"
            class="w-full px-3 py-2 border-2 border-blue-500 rounded focus:outline-none"
        />
        <div class="flex gap-2 mt-2">
            <button onclick="saveEdit(${id})" class="px-6 py-3 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors">Save</button>
            <button onclick="loadTodos()" class="px-6 py-3 bg-gray-500 text-white text-xs font-semibold rounded-lg hover:bg-gray-600 transition-colors">Cancel</button>
        </div>
    `;
    document.getElementById(`edit-input-${id}`).focus();
};

// Save edit
window.saveEdit = async function(id) {
    const input = document.getElementById(`edit-input-${id}`);
    const text = input.value.trim();
    
    if (!text) {
        alert('Todo text cannot be empty');
        return;
    }
    
    const result = await callTool('todo_update', { id, text });
    
    if (result.success) {
        await loadTodos();
    } else {
        alert('Failed to update todo: ' + result.message);
    }
};

// Delete todo
window.deleteTodo = async function(id) {
    if (!confirm('Are you sure you want to delete this todo?')) {
        return;
    }
    
    const result = await callTool('todo_delete', { id });
    
    if (result.success) {
        await loadTodos();
    } else {
        alert('Failed to delete todo: ' + result.message);
    }
};

// Initialize on load
initConnection();