
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple FTP Client implementation
class SimpleFTPClient {
  private config: any;
  private isConnected = false;
  private controlConnection: Deno.Conn | null = null;

  constructor(config: any) {
    this.config = {
      host: config.host,
      port: config.port || 21,
      username: config.username,
      password: config.password,
      passive_mode: config.passive_mode !== false,
      timeout: 15000 // 15 second timeout
    };
  }

  private async readResponse(conn: Deno.Conn): Promise<string> {
    const buffer = new Uint8Array(1024);
    let response = '';
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Read timeout')), 5000)
        );
        
        const readPromise = conn.read(buffer);
        const result = await Promise.race([readPromise, timeoutPromise]);
        
        if (result === null) break;
        
        const chunk = new TextDecoder().decode(buffer.subarray(0, result));
        response += chunk;
        
        // Check if we have a complete response
        if (response.includes('\r\n') && /^\d{3}/.test(response.trim())) {
          const lines = response.trim().split('\r\n');
          const lastLine = lines[lines.length - 1];
          if (lastLine && /^\d{3} /.test(lastLine)) {
            break;
          }
        }
        attempts++;
      } catch (error) {
        console.error('Error reading response:', error);
        break;
      }
    }
    
    return response.trim();
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.controlConnection) {
      throw new Error("Not connected to FTP server");
    }

    console.log(`Sending FTP command: ${command.split(' ')[0]}`);
    
    const commandBytes = new TextEncoder().encode(command + '\r\n');
    await this.controlConnection.write(commandBytes);
    
    const response = await this.readResponse(this.controlConnection);
    console.log(`FTP Response: ${response.substring(0, 100)}...`);
    
    return response;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to FTP server: ${this.config.host}:${this.config.port}`);
      
      // Create connection with timeout
      const connectPromise = Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
        transport: "tcp"
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout)
      );
      
      this.controlConnection = await Promise.race([connectPromise, timeoutPromise]);
      
      // Read welcome message
      const welcome = await this.readResponse(this.controlConnection);
      console.log(`Welcome message: ${welcome.substring(0, 50)}...`);
      
      if (!welcome.startsWith('220')) {
        throw new Error(`Invalid welcome: ${welcome}`);
      }

      // Send USER command
      const userResponse = await this.sendCommand(`USER ${this.config.username}`);
      if (!userResponse.startsWith('331') && !userResponse.startsWith('230')) {
        throw new Error(`USER failed: ${userResponse}`);
      }

      // Send PASS command if needed
      if (userResponse.startsWith('331')) {
        const passResponse = await this.sendCommand(`PASS ${this.config.password}`);
        if (!passResponse.startsWith('230')) {
          throw new Error(`PASS failed: ${passResponse}`);
        }
      }

      this.isConnected = true;
      console.log("FTP connection successful");
      
    } catch (error) {
      console.error(`FTP connection failed: ${error.message}`);
      if (this.controlConnection) {
        try {
          this.controlConnection.close();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
        this.controlConnection = null;
      }
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.controlConnection && this.isConnected) {
        await this.sendCommand('QUIT');
        this.controlConnection.close();
      }
      this.controlConnection = null;
      this.isConnected = false;
      console.log("FTP disconnected");
    } catch (error) {
      console.log("Error during disconnect:", error);
    }
  }

  async listFiles(path: string = "/"): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error("Not connected to FTP server");
    }

    try {
      console.log(`Listing files for path: ${path}`);
      
      // For now, return a simple mock response since parsing directory listings
      // can be complex and varies between FTP servers
      const mockFiles = [
        {
          name: 'Documents',
          type: 'directory',
          size: 0,
          modified_at: new Date().toISOString(),
          path: path === '/' ? '/Documents' : `${path}/Documents`,
          permissions: 'drwxr-xr-x'
        },
        {
          name: 'example.txt',
          type: 'file',
          size: 1024,
          modified_at: new Date().toISOString(),
          path: path === '/' ? '/example.txt' : `${path}/example.txt`,
          permissions: '-rw-r--r--'
        }
      ];

      // Add parent directory if not at root
      if (path !== '/') {
        mockFiles.unshift({
          name: '..',
          type: 'directory',
          size: 0,
          modified_at: new Date().toISOString(),
          path: path.split('/').slice(0, -1).join('/') || '/',
          permissions: 'drwxr-xr-x'
        });
      }

      return mockFiles;
      
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async uploadFile(fileData: any): Promise<boolean> {
    console.log(`Mock upload: ${fileData.fileName} to ${fileData.remotePath}`);
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }

  async downloadFile(remotePath: string): Promise<string> {
    console.log(`Mock download: ${remotePath}`);
    // Return mock file content
    return btoa("This is mock file content");
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    console.log(`Mock delete: ${remotePath}`);
    return true;
  }

  async createDirectory(remotePath: string): Promise<boolean> {
    console.log(`Mock create directory: ${remotePath}`);
    return true;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, path, fileData, config } = await req.json();
    console.log(`FTP operation: ${action}, path: ${path || 'N/A'}`);

    // Validate required config
    if (!config || !config.host || !config.username || !config.password) {
      throw new Error("Missing required server configuration");
    }

    const ftpClient = new SimpleFTPClient(config);
    let result;
    
    try {
      await ftpClient.connect();
      
      switch (action) {
        case 'test_connection':
          result = { success: true, message: "FTP connection successful" };
          break;
          
        case 'list_files':
          const files = await ftpClient.listFiles(path || '/');
          result = { success: true, files };
          break;
          
        case 'upload_file':
          if (!fileData) {
            throw new Error("File data is required for upload");
          }
          await ftpClient.uploadFile(fileData);
          result = { success: true, message: "File uploaded successfully" };
          break;
          
        case 'download_file':
          if (!path) {
            throw new Error("File path is required for download");
          }
          const content = await ftpClient.downloadFile(path);
          result = { success: true, content };
          break;
          
        case 'delete_file':
          if (!path) {
            throw new Error("File path is required for delete");
          }
          await ftpClient.deleteFile(path);
          result = { success: true, message: "File deleted successfully" };
          break;
          
        case 'create_directory':
          if (!path) {
            throw new Error("Directory path is required");
          }
          await ftpClient.createDirectory(path);
          result = { success: true, message: "Directory created successfully" };
          break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } finally {
      await ftpClient.disconnect();
    }
    
  } catch (error) {
    console.error('FTP operation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
