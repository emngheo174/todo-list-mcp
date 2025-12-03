import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import "@mcp-ui/client/ui-resource-renderer.wc.js";

const SERVER_URL = "http://localhost:3000/mcp";

let mcpClient = null;
let transport = null;
let todos = [];
let mcpResource = null;

// Initialize MCP connection
async function initConnection() {
  const statusDiv = document.getElementById("connection-status");
  statusDiv.textContent = "🔄 Connecting to MCP server...";
  statusDiv.className = "text-yellow-600 font-semibold";

  try {
    mcpClient = new Client({
      name: "todo-ui-client",
      version: "1.0.0",
    });

    transport = new StreamableHTTPClientTransport(new URL(SERVER_URL));

    await mcpClient.connect(transport);

    statusDiv.textContent = "✅ Connected to MCP server";
    statusDiv.className = "text-green-600 font-semibold";

    // Load todos after connection
    await loadTodos();
  } catch (e) {
    console.error("Connection error:", e);
    statusDiv.textContent = `❌ Connection failed: ${e.message}`;
    statusDiv.className = "text-red-600 font-semibold";
  }
}

// Call MCP tool
async function callTool(toolName, args = {}) {
  try {
    const resp = await mcpClient.callTool({ name: toolName, arguments: args });
    const result = resp.content[0];
    return result;
  } catch (error) {
    console.error(`Error calling ${toolName}:`, error);
    throw error;
  }
}

// Load todos
async function loadTodos() {
  const result = await callTool("todo_list");
  console.log("res", result);

  if (result) {
    todos = result;
    renderTodos(todos);
  }
}

// Render todos
function renderTodos(resource) {
  const renderer = document.getElementById("todos-container");
  mcpResource = resource;
  renderer.setAttribute("resource", JSON.stringify(mcpResource.resource));
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Create todo
window.createTodo = async function () {
  const input = document.getElementById("todo-input");
  const text = input.value.trim();

  if (!text) {
    alert("Please enter a todo text");
    return;
  }

  const result = await callTool("todo_create", { text });
  if (result) {
    input.value = "";
    await loadTodos();
  } else {
    alert("Failed to create todo: " + result.message);
  }
};

// Toggle todo
window.toggleTodo = async function (id, completed) {
  const result = await callTool("todo_update", { id, completed });

  if (result.success) {
    await loadTodos();
  } else {
    alert("Failed to update todo: " + result.message);
  }
};

// Save edit
window.saveEdit = async function (id, newText) {
  const input = document.getElementById(`edit-input-${id}`);
  console.log(input);
  
  const text = newText.trim();

  if (!text) {
    alert("Todo text cannot be empty");
    return;
  }

    await callTool("todo_update", { id, text });
    await loadTodos();
};

// Delete todo
window.deleteTodo = async function (id) {
  if (!confirm("Are you sure you want to delete this todo?")) {
    return;
  }

    await callTool("todo_delete", { id: id });
    await loadTodos();
};

window.addEventListener("DOMContentLoaded", () => {
  const renderer = document.getElementById("todos-container");

  if (renderer) {
    // Set the resource property
    // renderer.setAttribute('resource', JSON.stringify(mcpResource.resource));

    // Listen for events
    window.addEventListener("message", (event) => {
      console.log("User action:", event);
      const message = event.data;
      if (!message.messageId) {
        return;
      }

      console.log(message);
      switch (message.payload.toolName) {
        case "todo_delete":
          deleteTodo(message.payload.id);
          break;
        case "todo_update":
          console.log("Received response:", message);
          saveEdit(message.payload.id, message.payload.text);
          break;
      }
    });
  }
});
// Initialize on load
initConnection();
