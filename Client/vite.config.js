import { defineConfig } from 'vite';

export default defineConfig({
    // Cấu hình cho môi trường phát triển (Development)
    optimizeDeps: {
        include: [
            // Bắt buộc phải thêm các module mà bạn import trực tiếp
            '@modelcontextprotocol/sdk/client',
            '@mcp-ui/client/ui-resource-renderer.wc.js',
        ],
    },
    
    // Cấu hình cho quá trình Build
    build: {
        // Cần thiết nếu các dependencies sử dụng cú pháp CommonJS
        commonjsOptions: {
            include: [/node_modules/],
        },
        // Đảm bảo output directory là 'dist'
        outDir: 'dist',
    },
    
    // Cấu hình Dev Server
    server: {
        // Server của bạn đang chạy ở port 8080 như trong package.json
        port: 8080,
    },
    
});